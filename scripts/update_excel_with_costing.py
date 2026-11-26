import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

EXCEL_PATH = r"d:\SPpro\Consolidated_Sales_Purchase_Analysis_Report.xlsx"

# Full Recipe, Size, Material & Costing dictionary
ITEM_COSTING_MAP = {
    # Beverages
    'coffee 25': {'size': 'Small (250ml)', 'material': 'Coffee Pouch (15) + Glass 1.5 + Straw 0.3', 'cost': 16.80, 'profit': 8.20, 'margin': '32.8%'},
    'Coffee 30': {'size': 'Medium (300ml)', 'material': 'Coffee Pouch (15) + Glass 5.0 + Straw 0.3', 'cost': 20.30, 'profit': 9.70, 'margin': '32.3%'},
    'Coffee 35': {'size': 'Large (350ml)', 'material': 'Coffee Pouch (20.45) + Glass 5.0 + Straw 0.3', 'cost': 25.75, 'profit': 9.25, 'margin': '26.4%'},
    'Chocolate 29': {'size': 'Regular (250ml)', 'material': 'Chocolate Pouch (15) + Glass 1.5 + Straw 0.3', 'cost': 16.80, 'profit': 12.20, 'margin': '42.1%'},
    'Cold Chocolate Parcel': {'size': 'Parcel (350ml)', 'material': 'Chocolate Pouch (20.45) + Glass 5.0 + Straw 0.3', 'cost': 25.75, 'profit': 19.25, 'margin': '42.8%'},
    'Coffee Pouch': {'size': 'Retail Pouch (1 pac)', 'material': 'Pure Coffee Premix Dispatched Pouch', 'cost': 45.00, 'profit': 26.31, 'margin': '36.9%'},
    'HOT COFFEE': {'size': 'Regular Cup (240ml)', 'material': 'Coffee (15) + Regular Coffee Cup 1.2', 'cost': 16.20, 'profit': 18.80, 'margin': '53.7%'},
    'HOT CHOCOLATE': {'size': 'Regular Cup (240ml)', 'material': 'Chocolate (15) + Regular Cup 1.2', 'cost': 16.20, 'profit': 23.80, 'margin': '59.5%'},
    'Cold Chocolate Pouch': {'size': 'Retail Pouch', 'material': 'Chocolate Powder Dispatched Pouch', 'cost': 45.00, 'profit': 25.00, 'margin': '35.7%'},
    'Cold Choclet': {'size': 'Regular (250ml)', 'material': 'Chocolate (15) + Glass 1.5', 'cost': 16.80, 'profit': 12.20, 'margin': '42.1%'},
    'Cold Chocolate': {'size': 'Medium (300ml)', 'material': 'Chocolate (15) + Glass 5.0', 'cost': 20.30, 'profit': 9.70, 'margin': '32.3%'},
    'Frappe with Choco': {'size': 'Large (350ml)', 'material': 'Coffee + Choco + Glass 5.0', 'cost': 28.50, 'profit': 21.50, 'margin': '43.0%'},
    'Mango 50': {'size': 'Large (350ml)', 'material': 'Mango Milkshake (20) + Glass 5.0', 'cost': 25.30, 'profit': 24.70, 'margin': '49.4%'},
    'Mango Milkshake': {'size': 'Medium (300ml)', 'material': 'Mango (20) + Glass 5.0', 'cost': 25.30, 'profit': 24.70, 'margin': '49.4%'},
    'Mango Milkshake Parcel': {'size': 'Parcel (350ml)', 'material': 'Mango (20.45) + Glass 5.0', 'cost': 25.75, 'profit': 24.25, 'margin': '48.5%'},
    'Mango 45': {'size': 'Medium (300ml)', 'material': 'Mango Flavored Milk + Glass 5.0', 'cost': 22.00, 'profit': 23.00, 'margin': '51.1%'},
    'Mango Pouch': {'size': 'Retail Pouch', 'material': 'Mango Dispatched Pouch', 'cost': 35.00, 'profit': 15.00, 'margin': '30.0%'},
    'Pineapple 45': {'size': 'Medium (300ml)', 'material': 'Pineapple Syrup + Glass 5.0', 'cost': 22.00, 'profit': 23.00, 'margin': '51.1%'},
    'WATER': {'size': 'Packaged Bottle', 'material': 'Mineral Water Bottle', 'cost': 10.00, 'profit': 10.00, 'margin': '50.0%'},
    'Water': {'size': 'Packaged Bottle', 'material': 'Mineral Water Bottle', 'cost': 10.00, 'profit': 10.00, 'margin': '50.0%'},
    'Bottle': {'size': 'Packaged Bottle', 'material': 'Mineral Water Bottle', 'cost': 10.00, 'profit': 10.00, 'margin': '50.0%'},

    # Burgers - Without Cheese
    'Veg Burger': {'size': 'Standard 30', 'material': 'Without Cheese (Bread 6, Tikki 6, Mayo 1.5, Dish 0.8, Ketchup 1)', 'cost': 18.30, 'profit': 11.70, 'margin': '39.0%'},
    'Chatpata burger': {'size': 'Standard 30', 'material': 'Without Cheese (Bread 6, Tikki 6, Chatpata Mayo 2, Dish 0.8)', 'cost': 18.80, 'profit': 11.20, 'margin': '37.3%'},
    'Tangy Burger': {'size': 'Standard 30', 'material': 'Without Cheese (Bread 6, Tikki 6, Tangy Mayo 2, Dish 0.8)', 'cost': 18.80, 'profit': 11.20, 'margin': '37.3%'},
    'Tandoori Veg Burger': {'size': 'Premium 40', 'material': 'Without Cheese (Bread 6, Tikki 6, Tandoori Mayo 2.4, Wafers 4.2)', 'cost': 22.60, 'profit': 17.40, 'margin': '43.5%'},
    'Peri Peri Veg Burger': {'size': 'Premium 40', 'material': 'Without Cheese (Bread 6, Tikki 6, Peri Mayo 2.4, Wafers 4.2)', 'cost': 22.60, 'profit': 17.40, 'margin': '43.5%'},
    'Schezwan Chutney Burger': {'size': 'Deluxe 50', 'material': 'Without Cheese (Bread 6, Tikki 6, Schezwan 8, Wafers 4.2)', 'cost': 29.70, 'profit': 20.30, 'margin': '40.6%'},
    'GREEN INFERNO BURGER': {'size': 'Deluxe 50', 'material': 'Without Cheese (Bread 6, Tikki 6, Chutney 3, Wafers 4.2)', 'cost': 24.70, 'profit': 25.30, 'margin': '50.6%'},
    'JAIN VEG BURGER': {'size': 'Standard 30', 'material': 'Without Cheese (Bread 6, Jain Tikki 6, Mayo 1.5, Dish 0.8)', 'cost': 18.30, 'profit': 11.70, 'margin': '39.0%'},

    # Burgers - With Cheese (Cheezy)
    'Cheesy Tangy Burger': {'size': 'Cheesy 40', 'material': 'With Cheese (Bread 6, Tikki 6, Tangy 2, Cheese 2, Dish 1.5)', 'cost': 19.60, 'profit': 20.40, 'margin': '51.0%'},
    'Chatpata cheese burger': {'size': 'Cheesy 40', 'material': 'With Cheese (Bread 6, Tikki 6, Mayo 2, Cheese 2.69, Wafers 4.2)', 'cost': 24.89, 'profit': 15.11, 'margin': '37.8%'},
    'Veg Cheesy Burger': {'size': 'Cheesy 40', 'material': 'With Cheese (Bread 6, Tikki 6, Mayo 2, Cheese 2.69, Dish 1.5)', 'cost': 21.00, 'profit': 19.00, 'margin': '47.5%'},
    'Cheezy Tandoori  Burger': {'size': 'Cheesy 50', 'material': 'With Cheese (Bread 6, Tikki 6, Tandoori 2.4, Cheese 2.69, Wafers 4.2)', 'cost': 25.29, 'profit': 24.71, 'margin': '49.4%'},
    'Cheezy Peri Peri  Burger': {'size': 'Cheesy 50', 'material': 'With Cheese (Bread 6, Tikki 6, Peri Mayo 2.4, Cheese 2.69, Wafers 4.2)', 'cost': 25.29, 'profit': 24.71, 'margin': '49.4%'},
    'Cheezy Schezwan Chutney': {'size': 'Cheesy 60', 'material': 'With Cheese (Bread 6, Tikki 6, Mayo & Schezwan 9.5, Cheese 2.69)', 'cost': 32.39, 'profit': 27.61, 'margin': '46.0%'},
    'Cheesy Green Infreno Burger': {'size': 'Cheesy 60', 'material': 'With Cheese (Bread 6, Tikki 6, Mayo & Green 4.5, Cheese 2.69)', 'cost': 27.39, 'profit': 32.61, 'margin': '54.4%'},
    'Jain Cheesy Tangy Burger': {'size': 'Cheesy 40', 'material': 'With Cheese (Bread 6, Jain Tikki 6, Tangy 2, Cheese 2)', 'cost': 19.60, 'profit': 20.40, 'margin': '51.0%'},

    # Double Patty Burgers
    'Double Cheesy Tangy Burger': {'size': 'Double Cheesy 50', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Tangy 2.4)', 'cost': 28.50, 'profit': 21.56, 'margin': '43.1%'},
    'Double Cheese Chatpata Burger': {'size': 'Double Cheesy 50', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Chatpata 2.4)', 'cost': 28.50, 'profit': 21.63, 'margin': '43.1%'},
    'Double Cheesy Veggies Burger': {'size': 'Double Cheesy 50', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Mayo 2.4)', 'cost': 28.50, 'profit': 21.78, 'margin': '43.3%'},
    'Double Cheesy Peri Peri Burger': {'size': 'Double Cheesy 60', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Peri Mayo 2.4)', 'cost': 31.80, 'profit': 28.80, 'margin': '47.5%'},
    'Double Cheesy Tandoori Burger': {'size': 'Double Cheesy 60', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Tandoori 2.4)', 'cost': 31.80, 'profit': 28.48, 'margin': '47.2%'},
    'Double Cheesy Schezwan Chutney': {'size': 'Double Cheesy 70', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Schezwan 9.5)', 'cost': 35.80, 'profit': 35.10, 'margin': '49.5%'},
    'Double Cheesy Green Inferno<br>\nBurger': {'size': 'Double Cheesy 70', 'material': 'Double Patty & Cheese (Double Tikki 12, Cheese 2.69, Green Chutney 4.5)', 'cost': 33.50, 'profit': 36.50, 'margin': '52.1%'},

    # Pizzas
    'Veg Pizza': {'size': 'Standard 50', 'material': 'With Mozzarella (Base 7, Puree 1.7, Veg 2, Cheese 2.69, Mozzarella 11.76)', 'cost': 27.95, 'profit': 22.05, 'margin': '44.1%'},
    'Pizza Margherita': {'size': 'Standard 50', 'material': 'With Mozzarella (Base 7, Puree 1.7, Cheese 2.69, Mozzarella 11.76)', 'cost': 25.95, 'profit': 24.05, 'margin': '48.1%'},
    'Schezwan Chutney Pizza': {'size': 'Deluxe 80', 'material': 'With Mozzarella (Base 7, Schezwan 10, Veg 2, Cheese 2.69, Mozzarella 11.76)', 'cost': 36.25, 'profit': 43.75, 'margin': '54.7%'},
    'GREEN INFERNO PIZZA': {'size': 'Deluxe 80', 'material': 'With Mozzarella (Base 7, Chutney 3.75, Veg 2, Cheese 2.69, Mozzarella 11.76)', 'cost': 30.00, 'profit': 50.00, 'margin': '62.5%'},
    'Tandoori Pizza': {'size': 'Premium 100', 'material': 'With Mozzarella & Paneer (Base 7, Paneer 9.2, Mayo 2.4, Mozzarella 12.6)', 'cost': 36.69, 'profit': 63.31, 'margin': '63.3%'},
    'Corn Capsicum Pizza': {'size': 'Premium 100', 'material': 'With Mozzarella & Corn (Base 7, Corn 1.8, Cheese 4.48, Mozzarella 12.6)', 'cost': 31.08, 'profit': 68.92, 'margin': '68.9%'},

    # Sandwiches
    'Cheese Mayo Sandwich': {'size': 'Cheesy 65', 'material': 'With Cheese (Bread 12, Butter 10.08, Chutney 4.5, Mayo 3.25, Cheese 17, Wafers 4.4)', 'cost': 54.03, 'profit': 10.97, 'margin': '16.9%'},
    'Cheese Mayo Sandwich (Spl.)': {'size': 'Cheesy 65 (Spl)', 'material': 'With Cheese (Bread 12, Butter 10.08, Chutney 4.5, Cheese 17, Wafers 4.4)', 'cost': 54.03, 'profit': 10.97, 'margin': '16.9%'},
    'Mayo Sandwich': {'size': 'Standard 45', 'material': 'Without Cheese (Bread 12, Butter 10.08, Chutney 4.5, Mayo 3.25, Wafers 4.4)', 'cost': 37.03, 'profit': 7.97, 'margin': '17.7%'},
    'Peri Peri Mayo Sandwich': {'size': 'Premium 75', 'material': 'Without Cheese (Bread 12, Butter 10.08, Peri Mayo 7.2, Wafers 4.4)', 'cost': 39.73, 'profit': 35.27, 'margin': '47.0%'},
    'Tandoori Mayo Sandwich': {'size': 'Premium 75', 'material': 'Without Cheese (Bread 12, Butter 10.08, Tandoori Mayo 7.2, Wafers 4.4)', 'cost': 39.73, 'profit': 35.27, 'margin': '47.0%'},
    'Bread Butter Sandwich': {'size': 'Simple 30', 'material': 'Without Cheese (Bread 12, Butter 10.08, Dish 1.8, Ketchup 1)', 'cost': 24.88, 'profit': 5.12, 'margin': '17.1%'},
    'Bread Butter Chutney Sandwich': {'size': 'Simple 35', 'material': 'Without Cheese (Bread 12, Butter 10.08, Chutney 4.5, Dish 1.8, Ketchup 1)', 'cost': 29.38, 'profit': 5.62, 'margin': '16.1%'},

    # Garlic Bread
    'PLAIN GARLIC BREAD': {'size': 'Standard 59', 'material': 'Without Cheese (Garlic Bread 36.25, Dish 1.8, Herbs)', 'cost': 36.25, 'profit': 22.75, 'margin': '38.6%'},
    'VEG CHEESE GARLIC BREAD': {'size': 'Cheesy 78', 'material': 'With Cheese (Garlic Bread + Mozzarella Cheese 36.60)', 'cost': 36.60, 'profit': 41.40, 'margin': '53.1%'},

    # French Fries
    'Salted Fries': {'size': 'Standard 45', 'material': 'Plain Salted (Fries 15.6, Oil 4, Dish 0.8, Ketchup 1)', 'cost': 21.40, 'profit': 23.60, 'margin': '52.4%'},
    'Peri Peri Fries': {'size': 'Seasoned 55', 'material': 'Peri Peri Masala (Fries 15.6, Masala 2.56, Oil 4, Dish 1.8, Ketchup 1)', 'cost': 24.96, 'profit': 30.04, 'margin': '54.6%'}
}

def update_workbook():
    wb = openpyxl.load_workbook(EXCEL_PATH)
    
    h_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sub_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    font_h = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_b = Font(name="Calibri", size=9, bold=True)
    font_r = Font(name="Calibri", size=9)
    border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB')
    )

    categories = ['Beverages', 'Burgers', 'Pizzas', 'Sandwiches', 'Garlic Bread', 'French Fries']

    for cat in categories:
        if cat not in wb.sheetnames:
            continue
        ws = wb[cat]
        ws.views.sheetView[0].showGridLines = True

        # Update Section A Headers at Row 5
        headers = [
            "Item Name",
            "Size / Variant",
            "Material & Cheese Formulation",
            "Unit Making Cost (₹)",
            "Individual Sales Qty",
            "Total Revenue (₹)",
            "Avg Selling Price (₹)",
            "Unit Profit (₹)",
            "Margin %"
        ]
        
        for c_idx, h_text in enumerate(headers, start=1):
            cell = ws.cell(5, c_idx, h_text)
            cell.fill = sub_fill
            cell.font = font_h
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        # Update items rows
        reading = False
        for r in range(6, ws.max_row + 1):
            c1 = ws.cell(r, 1).value
            if c1 and ('B. OUTLET-WISE ANALYSIS' in str(c1) or 'Total Individual' in str(c1)):
                break
            if not c1:
                continue

            raw_name = str(c1).strip()
            cost_info = ITEM_COSTING_MAP.get(raw_name) or ITEM_COSTING_MAP.get(raw_name.replace('<br>\n', ' '))
            if not cost_info:
                # Fuzzy fallback
                for k, v in ITEM_COSTING_MAP.items():
                    if k.lower() in raw_name.lower() or raw_name.lower() in k.lower():
                        cost_info = v
                        break

            # Col 2: Size / Variant
            ws.cell(r, 2, cost_info['size'] if cost_info else 'Standard').font = font_r
            # Col 3: Material & Cheese Formulation
            ws.cell(r, 3, cost_info['material'] if cost_info else 'Standard Ingredients').font = font_r
            # Col 4: Unit Making Cost (₹)
            ws.cell(r, 4, cost_info['cost'] if cost_info else 0.0).font = font_b
            ws.cell(r, 4).number_format = "₹#,##0.00"

            # Col 5: Individual Sales Qty (preserve existing qty or cell)
            # Col 6: Total Revenue (₹)
            # Col 7: Avg Selling Price (₹)
            # Col 8: Unit Profit (₹)
            ws.cell(r, 8, cost_info['profit'] if cost_info else 0.0).font = font_b
            ws.cell(r, 8).number_format = "₹#,##0.00"

            # Col 9: Margin %
            ws.cell(r, 9, cost_info['margin'] if cost_info else '0.0%').font = font_b
            ws.cell(r, 9).alignment = Alignment(horizontal="center")

            for col_i in range(1, 10):
                ws.cell(r, col_i).border = border

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col[:35])
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # -------------------------------------------------------------
    # Update Sheet 8: Recipe Details with Full Unit Costing & BOM Matrix
    # -------------------------------------------------------------
    if "Recipe Details" in wb.sheetnames:
        ws_rc = wb["Recipe Details"]
        ws_rc.views.sheetView[0].showGridLines = True
        
        # Add Unit Costing & Margin Matrix below existing raw material table
        start_cost_r = ws_rc.max_row + 3
        ws_rc.cell(start_cost_r, 1, "B. DETAILED RECIPE BILL OF MATERIALS (BOM), UNIT COSTING & MARGIN ANALYSIS").font = Font(name="Calibri", size=13, bold=True, color="1E3A8A")
        ws_rc.cell(start_cost_r + 1, 1, "Ingredient costs, bread/buns, cheese/mozzarella formulations, packaging dish/glass, making cost, sale price, profit and margin %").font = Font(name="Calibri", size=10, italic=True, color="4B5563")

        cost_headers = [
            "Category", "Item Name", "Size / Variant", "Cheese / Mozzarella Spec",
            "Bread / Base (₹)", "Tikki / Patty (₹)", "Oil (₹)", "Veg / Puree (₹)",
            "Mayo / Sauce (₹)", "Dish / Glass (₹)", "Cheese Cost (₹)", "Mozzarella (₹)",
            "Unit Making Cost (₹)", "Sale Price (₹)", "Unit Profit (₹)", "Margin %", "Margin Classification"
        ]

        h_r = start_cost_r + 3
        for ci, ch in enumerate(cost_headers, start=1):
            cell = ws_rc.cell(h_r, ci, ch)
            cell.fill = h_fill
            cell.font = font_h
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        cur_r = h_r + 1

        # Read from item_recipe_costing.csv
        import csv
        with open(r"d:\SPpro\data\item_recipe_costing.csv", "r", encoding="utf-8") as f:
            reader = list(csv.DictReader(f))

        for row in reader:
            cat = row["Category"]
            name = row["Item_Name"]
            size = row["Variant_Size"]
            cheese = row["Cheese_Type"]
            bread = float(row["Bread_Base_Cost"] or 0)
            tikki = float(row["Tikki_Cost"] or 0)
            oil = float(row["Oil_Cost"] or 0)
            veg = float(row["Veg_Onion_Tomato_Cost"] or 0)
            mayo = float(row["Mayo_Sauce_Cost"] or 0)
            dish = float(row["Dish_Glass_Wafers_Cost"] or 0)
            cheese_c = float(row["Cheese_Cost"] or 0)
            mozz_c = float(row["Mozzarella_Cost"] or 0)
            making = float(row["Making_Cost"] or 0)
            sale = float(row["Sale_Price"] or 0)
            profit = float(row["Profit"] or 0)
            margin = row["Margin_Pct"]

            margin_val = float(margin.replace("%", "").strip() or 0)
            margin_class = "High Margin" if margin_val >= 48.0 else ("Medium Margin" if margin_val >= 35.0 else "Low Margin")

            vals = [
                cat, name, size, cheese,
                bread, tikki, oil, veg,
                mayo, dish, cheese_c, mozz_c,
                making, sale, profit, margin, margin_class
            ]

            for ci, val in enumerate(vals, start=1):
                c = ws_rc.cell(cur_r, ci, val)
                c.font = font_r
                c.border = border
                if ci in range(5, 16):
                    c.number_format = "₹#,##0.00"
                if ci == 17:
                    c.font = font_b
                    c.alignment = Alignment(horizontal="center")
                    if margin_class == "High Margin":
                        c.fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                    elif margin_class == "Low Margin":
                        c.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")

            cur_r += 1

        for col in ws_rc.columns:
            max_len = max(len(str(cell.value or '')) for cell in col[:cur_r])
            col_letter = get_column_letter(col[0].column)
            ws_rc.column_dimensions[col_letter].width = max(max_len + 3, 11)

    wb.save(EXCEL_PATH)
    print("Successfully updated Consolidated_Sales_Purchase_Analysis_Report.xlsx with Size, Material & Costing columns!")

if __name__ == "__main__":
    update_workbook()
