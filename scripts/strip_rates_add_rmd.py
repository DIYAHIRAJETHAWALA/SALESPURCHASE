"""Strip rate/revenue/cost/profit/margin columns from all three Excel workbooks
and add RMD % (Sales Qty / Purchase Qty) with clean Excel formulas.
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
TOTAL_FILL = PatternFill("solid", fgColor="D9E1F2")
TOTAL_FONT = Font(name="Calibri", size=11, bold=True, color="000000")
TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="1F4E78")
SUBTITLE_FONT = Font(name="Calibri", size=10, italic=True, color="595959")
SECTION_FONT = Font(name="Calibri", size=11, bold=True, color="1F4E78")
THIN_BORDER = Border(
    left=Side(style="thin", color="D9D9D9"),
    right=Side(style="thin", color="D9D9D9"),
    top=Side(style="thin", color="D9D9D9"),
    bottom=Side(style="thin", color="D9D9D9"),
)

# Category-level purchase totals from Consolidated_Sales_Purchase_Analysis_Report.xlsx
# (Raw Material, Total Packs, Total Units)
RAW_MATERIAL_MAP = {
    "Coffee": ("COFFEE POUCH", 332, 332 * 32),
    "Chocolate": ("COLD CHOCOLATE", 94, 94 * 32),
    "Mango": ("MANGO FLAVORED MILK", 1672, 1672),
    "Burgers": ("BURGER BUN", 7297, 7297 * 6),
    "Pizzas": ("PIZZA BASE", 3406, 3406 * 4),
    "Sandwiches": ("SANDWICH BREAD", 958, 958 * 4),
    "Garlic Bread": ("GARLIC BREAD", 319, 319 * 15),
    "French Fries": ("FRENCH FRIES (kg)", 349, 349 * 2.5),
}


def auto_fit(ws, min_w=10, max_w=48):
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row <= 2:
                continue
            val = str(cell.value or "")
            if val.startswith("="):
                val = "123,456.0%"
            max_len = max(max_len, len(val))
        ws.column_dimensions[col_letter].width = max(min_w, min(max_w, max_len + 3))


def style_header_row(ws, row_idx, max_col):
    for c in range(1, max_col + 1):
        cell = ws.cell(row_idx, c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    ws.row_dimensions[row_idx].height = 28


def style_total_row(ws, row_idx, max_col):
    for c in range(1, max_col + 1):
        cell = ws.cell(row_idx, c)
        cell.fill = TOTAL_FILL
        cell.font = TOTAL_FONT
        cell.border = THIN_BORDER


def get_purchase_info(category, subcat, item_name, other_food_lookup):
    low = item_name.lower()
    if item_name in other_food_lookup:
        return other_food_lookup[item_name]
    if "coffee" in low:
        return RAW_MATERIAL_MAP["Coffee"]
    if "choc" in low or "frappe" in low:
        return RAW_MATERIAL_MAP["Chocolate"]
    if "mango" in low:
        return RAW_MATERIAL_MAP["Mango"]
    if category in RAW_MATERIAL_MAP:
        return RAW_MATERIAL_MAP[category]
    return ("Not Tracked", 0, 0)


def update_individual_items_report():
    path = "d:/SPpro/Individual_Items_Size_And_Material_Report.xlsx"
    wb = openpyxl.load_workbook(path, data_only=False)

    # Read Other Food & Add-ons purchase mapping first
    ws_other_old = wb["Other Food & Add-ons"]
    other_rows = []
    other_food_lookup = {}
    for r in range(5, ws_other_old.max_row):
        cat = ws_other_old.cell(r, 1).value
        if not cat or "total" in str(cat).lower():
            continue
        item = ws_other_old.cell(r, 2).value
        size = ws_other_old.cell(r, 3).value
        mat = ws_other_old.cell(r, 4).value
        pm = ws_other_old.cell(r, 5).value or "Not Tracked"
        pqty = ws_other_old.cell(r, 6).value or 0
        sqty = ws_other_old.cell(r, 7).value or 0
        other_rows.append((cat, item, size, mat, sqty, pm, pqty))
        other_food_lookup[item] = (pm, pqty, pqty)

    # Read All Items Master
    ws_master_old = wb["All Items Master"]
    master_rows = []
    for r in range(5, ws_master_old.max_row):
        cat = ws_master_old.cell(r, 1).value
        if not cat or "total" in str(cat).lower():
            continue
        subcat = ws_master_old.cell(r, 2).value
        item = ws_master_old.cell(r, 3).value
        size = ws_master_old.cell(r, 4).value
        mat = ws_master_old.cell(r, 5).value
        sqty = ws_master_old.cell(r, 7).value or 0
        pm, p_packs, p_units = get_purchase_info(cat, subcat, item, other_food_lookup)
        master_rows.append((cat, subcat, item, size, mat, sqty, pm, p_packs, p_units))

    # Read Beverages (Coffee vs Other)
    ws_bev_old = wb["Beverages (Coffee vs Other)"]
    bev_rows = []
    for r in range(5, ws_bev_old.max_row):
        grp = ws_bev_old.cell(r, 1).value
        if not grp or "total" in str(grp).lower():
            continue
        item = ws_bev_old.cell(r, 2).value
        size = ws_bev_old.cell(r, 3).value
        mat = ws_bev_old.cell(r, 4).value
        sqty = ws_bev_old.cell(r, 6).value or 0
        pm, p_packs, p_units = get_purchase_info("Beverages", grp, item, other_food_lookup)
        bev_rows.append((grp, item, size, mat, sqty, pm, p_packs, p_units))

    # Rebuild All Items Master
    wb.remove(wb["All Items Master"])
    ws_m = wb.create_sheet("All Items Master", 0)
    ws_m["A1"] = "ALL INDIVIDUAL BEVERAGES & FOOD ITEMS – SALES QTY, PURCHASE QTY & RMD %"
    ws_m["A1"].font = TITLE_FONT
    ws_m["A2"] = "Size/Variant, Material Spec, Sales Qty, Purchase Qty & RMD % (Sales Qty / Purchase Units)"
    ws_m["A2"].font = SUBTITLE_FONT
    headers_m = [
        "Category", "Sub-Category / Material Type", "Item Name", "Size / Variant",
        "Material & Ingredients Formulation", "Individual Sales Qty",
        "Purchase Raw Material", "Purchase Qty (Packs)", "Purchase Qty (Units)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(headers_m, 1):
        ws_m.cell(4, c, h)
    style_header_row(ws_m, 4, len(headers_m))
    for idx, row_vals in enumerate(master_rows, 5):
        for c, v in enumerate(row_vals, 1):
            cell = ws_m.cell(idx, c, v)
            cell.border = THIN_BORDER
            if c in (6, 8, 9):
                cell.number_format = "#,##0"
        rmd_cell = ws_m.cell(idx, 10, f"=IF(I{idx}>0, F{idx}/I{idx}, 0)")
        rmd_cell.number_format = "0.0%"
        rmd_cell.border = THIN_BORDER
    tot_r = 5 + len(master_rows)
    ws_m.cell(tot_r, 1, "GRAND TOTAL (ALL INDIVIDUAL ITEMS)")
    ws_m.cell(tot_r, 6, f"=SUM(F5:F{tot_r-1})").number_format = "#,##0"
    style_total_row(ws_m, tot_r, len(headers_m))
    ws_m.auto_filter.ref = f"A4:J{tot_r-1}"
    auto_fit(ws_m)

    # Rebuild Beverages (Coffee vs Other)
    wb.remove(wb["Beverages (Coffee vs Other)"])
    ws_b = wb.create_sheet("Beverages (Coffee vs Other)", 1)
    ws_b["A1"] = "ALL BEVERAGES – SALES QTY, PURCHASE QTY & RMD %"
    ws_b["A1"].font = TITLE_FONT
    ws_b["A2"] = "Coffee vs Other Beverages (Chocolate, Mango, Pineapple, Water) – Quantity & RMD Analysis"
    ws_b["A2"].font = SUBTITLE_FONT
    headers_b = [
        "Beverage Group", "Item Name", "Size / Variant", "Material & Glass/Cup",
        "Individual Sales Qty", "Purchase Raw Material", "Purchase Qty (Packs)",
        "Purchase Qty (Units)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(headers_b, 1):
        ws_b.cell(4, c, h)
    style_header_row(ws_b, 4, len(headers_b))
    for idx, row_vals in enumerate(bev_rows, 5):
        for c, v in enumerate(row_vals, 1):
            cell = ws_b.cell(idx, c, v)
            cell.border = THIN_BORDER
            if c in (5, 7, 8):
                cell.number_format = "#,##0"
        rmd_cell = ws_b.cell(idx, 9, f"=IF(H{idx}>0, E{idx}/H{idx}, 0)")
        rmd_cell.number_format = "0.0%"
        rmd_cell.border = THIN_BORDER
    tot_b = 5 + len(bev_rows)
    ws_b.cell(tot_b, 1, "Total All Beverages")
    ws_b.cell(tot_b, 5, f"=SUM(E5:E{tot_b-1})").number_format = "#,##0"
    style_total_row(ws_b, tot_b, len(headers_b))
    ws_b.auto_filter.ref = f"A4:I{tot_b-1}"
    auto_fit(ws_b)

    # Rebuild Other Food & Add-ons
    wb.remove(wb["Other Food & Add-ons"])
    ws_o = wb.create_sheet("Other Food & Add-ons", 2)
    ws_o["A1"] = "OTHER FOOD ITEMS, SNACKS, DIPS & ADD-ONS – SALES QTY, PURCHASE QTY & RMD %"
    ws_o["A1"].font = TITLE_FONT
    ws_o["A2"] = "Momos, Corn Balls, Time Pass Bites, Sabudana Vada, Dips, Extra Cheese/Mayo & Carry Bags"
    ws_o["A2"].font = SUBTITLE_FONT
    headers_o = [
        "Category", "Item Name", "Size / Variant", "Material & Ingredients",
        "Sales Qty", "Purchase Raw Material", "Purchase Qty (Packs)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(headers_o, 1):
        ws_o.cell(4, c, h)
    style_header_row(ws_o, 4, len(headers_o))
    for idx, row_vals in enumerate(other_rows, 5):
        for c, v in enumerate(row_vals, 1):
            cell = ws_o.cell(idx, c, v)
            cell.border = THIN_BORDER
            if c in (5, 7):
                cell.number_format = "#,##0"
        rmd_cell = ws_o.cell(idx, 8, f"=IF(G{idx}>0, E{idx}/G{idx}, 0)")
        rmd_cell.number_format = "0.0%"
        rmd_cell.border = THIN_BORDER
    tot_o = 5 + len(other_rows)
    ws_o.cell(tot_o, 1, "Total Other Food & Add-ons")
    ws_o.cell(tot_o, 5, f"=SUM(E5:E{tot_o-1})").number_format = "#,##0"
    style_total_row(ws_o, tot_o, len(headers_o))
    ws_o.auto_filter.ref = f"A4:H{tot_o-1}"
    auto_fit(ws_o)

    wb.save(path)
    print("Updated:", path)


def update_other_beverages_report():
    path = "d:/SPpro/Other_Beverages_Sales_Purchase_Analysis.xlsx"
    wb = openpyxl.load_workbook(path, data_only=False)

    # 1. Other Beverages Summary
    ws_sum = wb["Other Beverages Summary"]
    # Cols currently: 1=Sub-Category, 2=Item Name, 3=Size, 4=Material, 5=Unit Cost, 6=Ind Qty, 7=Combo Qty, 8=Total Qty, 9=Rev, 10=Avg Price, 11=Profit, 12=Margin
    # Remove cols 12, 11, 10, 9, 5 (delete from right to left)
    for col_idx in [12, 11, 10, 9, 5]:
        ws_sum.delete_cols(col_idx)
    # Now cols: 1=Sub-Cat, 2=Item, 3=Size, 4=Material, 5=Ind Qty, 6=Combo Qty, 7=Total Qty
    # Add Purchase Qty & RMD %
    ws_sum.cell(4, 8, "Purchase Raw Material")
    ws_sum.cell(4, 9, "Purchase Qty (Units)")
    ws_sum.cell(4, 10, "RMD % (Sales / Purchase)")
    style_header_row(ws_sum, 4, 10)
    for r in range(5, 21):
        ws_sum.cell(r, 7, f"=E{r}+F{r}").number_format = "#,##0"
        sub = str(ws_sum.cell(r, 1).value or "")
        if "Chocolate" in sub:
            pm, pu = "COLD CHOCOLATE", 94 * 32
        elif "Mango" in sub:
            pm, pu = "MANGO FLAVORED MILK", 1672
        else:
            pm, pu = "Not Tracked", 0
        ws_sum.cell(r, 8, pm).border = THIN_BORDER
        ws_sum.cell(r, 9, pu).number_format = "#,##0"
        ws_sum.cell(r, 9).border = THIN_BORDER
        ws_sum.cell(r, 10, f"=IF(I{r}>0, G{r}/I{r}, 0)").number_format = "0.0%"
        ws_sum.cell(r, 10).border = THIN_BORDER
    ws_sum.cell(21, 5, "=SUM(E5:E20)").number_format = "#,##0"
    ws_sum.cell(21, 6, "=SUM(F5:F20)").number_format = "#,##0"
    ws_sum.cell(21, 7, "=SUM(G5:G20)").number_format = "#,##0"
    ws_sum.cell(21, 8, "-")
    ws_sum.cell(21, 9, "-")
    ws_sum.cell(21, 10, "-")
    style_total_row(ws_sum, 21, 10)
    auto_fit(ws_sum)

    # 2. Chocolate Beverages
    ws_ch = wb["Chocolate Beverages"]
    # Section A (R5..R15): cols 1..8 -> 5=Unit Cost, 6=Sales Qty, 7=Revenue, 8=Avg Price
    # Section B (R18..R69): 1=Outlet, 2=Ind Qty, 3=Combo Qty, 4=Total Qty, 5=Purchase Packs, 6=Purchase Pouches, 7=Variance, 8=Rev?
    # Let's inspect R18 of Chocolate Beverages dynamically
    for r in range(5, 15):
        ws_ch.cell(r, 5, ws_ch.cell(r, 6).value)  # move Sales Qty to col 5
        ws_ch.cell(r, 6).value = None
        ws_ch.cell(r, 7).value = None
        ws_ch.cell(r, 8).value = None
    ws_ch.cell(5, 5, "Sales Qty")
    for c in [6, 7, 8]:
        ws_ch.cell(5, c).value = None
    style_header_row(ws_ch, 5, 5)
    ws_ch.cell(15, 5, "=SUM(E6:E14)").number_format = "#,##0"
    for c in [6, 7, 8]:
        ws_ch.cell(15, c).value = None
    style_total_row(ws_ch, 15, 5)

    # Section B in Chocolate Beverages: check col 7 & 8
    ws_ch.cell(18, 7, "RMD % (Sales / Purchase)")
    ws_ch.cell(18, 8, "Variance (Sales - Purchase)")
    style_header_row(ws_ch, 18, 8)
    for r in range(19, 69):
        ws_ch.cell(r, 4, f"=B{r}+C{r}").number_format = "#,##0"
        ws_ch.cell(r, 7, f"=IF(F{r}>0, D{r}/F{r}, 0)").number_format = "0.0%"
        ws_ch.cell(r, 7).border = THIN_BORDER
        ws_ch.cell(r, 8, f"=D{r}-F{r}").number_format = "#,##0"
        ws_ch.cell(r, 8).border = THIN_BORDER
    ws_ch.cell(69, 4, "=SUM(D19:D68)").number_format = "#,##0"
    ws_ch.cell(69, 7, "=IF(F69>0, D69/F69, 0)").number_format = "0.0%"
    ws_ch.cell(69, 8, "=D69-F69").number_format = "#,##0"
    style_total_row(ws_ch, 69, 8)
    auto_fit(ws_ch)

    # 3. Mango & Fruit Shakes
    ws_mg = wb["Mango & Fruit Shakes"]
    # Section A (R5..R12): 1=Item, 2=Size, 3=Mat, 4=Cost, 5=Sales Qty, 6=Rev, 7=Avg, 8=Profit, 9=Margin
    ws_mg.cell(5, 4, "Sales Qty")
    for c in range(5, 11):
        ws_mg.cell(5, c).value = None
    style_header_row(ws_mg, 5, 4)
    for r in range(6, 12):
        ws_mg.cell(r, 4, ws_mg.cell(r, 5).value).number_format = "#,##0"
        for c in range(5, 11):
            ws_mg.cell(r, c).value = None
    ws_mg.cell(12, 4, "=SUM(D6:D11)").number_format = "#,##0"
    for c in range(5, 11):
        ws_mg.cell(12, c).value = None
    style_total_row(ws_mg, 12, 4)
    # Section B (R15..R64): check if col 10 is Revenue or Variance
    # Add RMD % in col 10 (replacing Revenue if any)
    ws_mg.cell(15, 10, "RMD % (Sales / Purchase)")
    style_header_row(ws_mg, 15, 10)
    for r in range(16, 64):
        ws_mg.cell(r, 10, f"=IF(I{r}>0, G{r}/I{r}, 0)").number_format = "0.0%"
        ws_mg.cell(r, 10).border = THIN_BORDER
    ws_mg.cell(64, 10, "=IF(I64>0, G64/I64, 0)").number_format = "0.0%"
    style_total_row(ws_mg, 64, 10)
    auto_fit(ws_mg)

    # 4. Water & Packaged
    ws_wt = wb["Water & Packaged"]
    ws_wt.cell(5, 4, "Sales Qty")
    for c in [5, 6, 7]:
        ws_wt.cell(5, c).value = None
    style_header_row(ws_wt, 5, 4)
    for r in range(6, 9):
        ws_wt.cell(r, 4, ws_wt.cell(r, 5).value).number_format = "#,##0"
        for c in [5, 6, 7]:
            ws_wt.cell(r, c).value = None
    ws_wt.cell(9, 4, "=SUM(D6:D8)").number_format = "#,##0"
    for c in [5, 6, 7]:
        ws_wt.cell(9, c).value = None
    style_total_row(ws_wt, 9, 4)
    # Section B (R12..R61): remove col 6/7 if revenue
    if ws_wt.cell(12, 6).value and "rev" in str(ws_wt.cell(12, 6).value).lower():
        for r in range(12, 62):
            ws_wt.cell(r, 6).value = None
    auto_fit(ws_wt)

    # 5. Outlet Summary (Other Bev)
    ws_os = wb["Outlet Summary (Other Bev)"]
    # Cols: 1=Outlet, 2=Choc, 3=Mango, 4=Water, 5=Total Other Bev Qty, 6=Cold Choc Packs, 7=Cold Choc Pouches, 8=Mango Packs, 9=Revenue
    ws_os.cell(4, 9, "Total Purchase Units")
    ws_os.cell(4, 10, "RMD % (Sales / Purchase)")
    style_header_row(ws_os, 4, 10)
    for r in range(5, 53):
        ws_os.cell(r, 9, f"=G{r}+H{r}").number_format = "#,##0"
        ws_os.cell(r, 9).border = THIN_BORDER
        ws_os.cell(r, 10, f"=IF(I{r}>0, E{r}/I{r}, 0)").number_format = "0.0%"
        ws_os.cell(r, 10).border = THIN_BORDER
    ws_os.cell(53, 9, "=SUM(I5:I52)").number_format = "#,##0"
    ws_os.cell(53, 10, "=IF(I53>0, E53/I53, 0)").number_format = "0.0%"
    style_total_row(ws_os, 53, 10)
    auto_fit(ws_os)

    # 6. Recipe & Material Details
    ws_rec = wb["Recipe & Material Details"]
    for col_idx in [10, 9, 8, 7]:
        ws_rec.delete_cols(col_idx)
    auto_fit(ws_rec)

    wb.save(path)
    print("Updated:", path)


def update_consolidated_report():
    path = "d:/SPpro/Consolidated_Sales_Purchase_Analysis_Report.xlsx"
    wb = openpyxl.load_workbook(path, data_only=False)

    # 1. Six category sheets
    cat_specs = {
        "Beverages": (6, 26, 27, 30, 31, 78, 79),
        "Burgers": (6, 28, 29, 32, 33, 80, 81),
        "Pizzas": (6, 11, 12, 15, 16, 63, 64),
        "Sandwiches": (6, 12, 13, 16, 17, 64, 65),
        "Garlic Bread": (6, 7, 8, 11, 12, 59, 60),
        "French Fries": (6, 7, 8, 11, 12, 59, 60),
    }
    for sname, (a_start, a_end, a_tot, b_hdr, b_start, b_end, b_tot) in cat_specs.items():
        ws = wb[sname]
        # Section A: keep cols 1, 2, 3, and move Col 5 (Individual Sales Qty) -> Col 4; clear cols 5..9
        ws.cell(5, 4, "Individual Sales Qty")
        for c in range(5, 10):
            ws.cell(5, c).value = None
        style_header_row(ws, 5, 4)
        for r in range(a_start, a_end + 1):
            ws.cell(r, 4, ws.cell(r, 5).value).number_format = "#,##0"
            for c in range(5, 10):
                ws.cell(r, c).value = None
        ws.cell(a_tot, 2).value = None
        ws.cell(a_tot, 3).value = None
        ws.cell(a_tot, 4, f"=SUM(D{a_start}:D{a_end})").number_format = "#,##0"
        for c in range(5, 10):
            ws.cell(a_tot, c).value = None
        style_total_row(ws, a_tot, 4)

        # Section B: Col 1=Outlet, 2=Ind Qty, 3=Combo Qty, 4=Total Qty, 5=Purchase Packs, 6=Purchase Units, 7=RMD %, 8=Variance
        ws.cell(b_hdr, 7, "RMD % (Sales / Purchase)")
        ws.cell(b_hdr, 8, "Variance (Sales - Purchase Units)")
        ws.cell(b_hdr, 9).value = None
        style_header_row(ws, b_hdr, 8)
        for r in range(b_start, b_end + 1):
            ws.cell(r, 4, f"=B{r}+C{r}").number_format = "#,##0"
            ws.cell(r, 7, f"=IF(F{r}>0, D{r}/F{r}, 0)").number_format = "0.0%"
            ws.cell(r, 7).border = THIN_BORDER
            ws.cell(r, 8, f"=D{r}-F{r}").number_format = "#,##0"
            ws.cell(r, 8).border = THIN_BORDER
            ws.cell(r, 9).value = None
        ws.cell(b_tot, 4, f"=SUM(D{b_start}:D{b_end})").number_format = "#,##0"
        ws.cell(b_tot, 7, f"=IF(F{b_tot}>0, D{b_tot}/F{b_tot}, 0)").number_format = "0.0%"
        ws.cell(b_tot, 8, f"=D{b_tot}-F{b_tot}").number_format = "#,##0"
        ws.cell(b_tot, 9).value = None
        style_total_row(ws, b_tot, 8)
        auto_fit(ws)

    # 2. Combos: remove cols 4 (Total Sales Amount) and 5 (Avg Price)
    ws_c = wb["Combos"]
    ws_c.delete_cols(5)
    ws_c.delete_cols(4)
    # Re-fix totals in R24 (cols 3..11)
    for c in range(3, 12):
        col_l = get_column_letter(c)
        ws_c.cell(24, c, f"=SUM({col_l}5:{col_l}23)").number_format = "#,##0"
    style_total_row(ws_c, 24, 11)
    auto_fit(ws_c)

    # 3. Recipe Details: remove ₹ rate/price/profit/margin cols in Section B (cols 5..17 -> keep 1..4)
    ws_rec = wb["Recipe Details"]
    for r in range(44, ws_rec.max_row + 1):
        for c in range(5, 18):
            ws_rec.cell(r, c).value = None
    auto_fit(ws_rec)

    # 4. Outlet Summary: remove col 2 (Total Sales Amount (₹)), add RMD % columns
    ws_os = wb["Outlet Summary"]
    ws_os.delete_cols(2)
    # Now cols: 1=Outlet, 2=Ind Qty, 3=Combo Qty, 4=Total Sold, 5=Burgers, 6=Buns, 7=Pizzas, 8=Bases,
    # 9=Sandwiches, 10=Bread, 11=Fries, 12=Fries kg, 13=GB, 14=GB Purch, 15=Beverages
    for r in range(5, 53):
        ws_os.cell(r, 4, f"=B{r}+C{r}").number_format = "#,##0"
    for c in range(2, 16):
        col_l = get_column_letter(c)
        ws_os.cell(53, c, f"=SUM({col_l}5:{col_l}52)").number_format = "#,##0"
    # Add RMD % columns at cols 16..20
    rmd_specs = [
        (16, "Burgers RMD %", "E", "F"),
        (17, "Pizzas RMD %", "G", "H"),
        (18, "Sandwiches RMD %", "I", "J"),
        (19, "Fries RMD %", "K", "L"),
        (20, "Garlic Bread RMD %", "M", "N"),
    ]
    for col_i, title, s_col, p_col in rmd_specs:
        ws_os.cell(4, col_i, title)
        for r in range(5, 54):
            c = ws_os.cell(r, col_i, f"=IF({p_col}{r}>0, {s_col}{r}/{p_col}{r}, 0)")
            c.number_format = "0.0%"
            c.border = THIN_BORDER
    style_header_row(ws_os, 4, 20)
    style_total_row(ws_os, 53, 20)
    auto_fit(ws_os)

    # 5. Grand Summary: remove cols 5 (Total Sales Amount), 6 (Avg Price), 8 (% Contribution Revenue)
    ws_gs = wb["Grand Summary"]
    ws_gs.delete_cols(8)
    ws_gs.delete_cols(6)
    ws_gs.delete_cols(5)
    # Now cols: 1=Category, 2=Item, 3=Type, 4=Total Sales Qty, 5=% Contribution (Qty)
    for r in range(5, 100):
        ws_gs.cell(r, 5, f"=IF(D$100>0, D{r}/D$100, 0)").number_format = "0.0%"
    ws_gs.cell(100, 4, "=SUM(D5:D99)").number_format = "#,##0"
    ws_gs.cell(100, 5, "=SUM(E5:E99)").number_format = "0.0%"
    style_header_row(ws_gs, 4, 5)
    style_total_row(ws_gs, 100, 5)
    auto_fit(ws_gs)

    wb.save(path)
    print("Updated:", path)


if __name__ == "__main__":
    update_individual_items_report()
    update_other_beverages_report()
    update_consolidated_report()
