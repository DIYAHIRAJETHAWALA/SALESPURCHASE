"""
Redesigned individual outlet Excel reports.
SUMMARY sheet:  Outlet (rows) × Size-variant columns (Small/Big/Bigger with prices) + Purchase + RMD%
Per-item sheet: Same pivot — Outlet rows, Size columns, Purchase, RMD%
"""

import csv, os, shutil, zipfile
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CSV_PATH   = "d:/SPpro/sample_data/Location Wise Item Sales Report 20-11-2026 16_42.csv"
ORDER_PATH = "d:/SPpro/sample_data/order-report-From-01-11-2026-to-07-11-2026.xlsx"
OUT_DIR    = "d:/SPpro/outlet_reports"
ZIP_PATH   = "d:/SPpro/Outlet_Item_Reports.zip"
DL_ZIP     = os.path.join(os.path.expanduser("~"), "Downloads", "Outlet_Item_Reports.zip")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Styles ─────────────────────────────────────────────────────────────────
def mk_fill(hex_): return PatternFill("solid", fgColor=hex_)
def mk_font(bold=False, color="000000", sz=11, italic=False):
    return Font(name="Calibri", size=sz, bold=bold, color=color, italic=italic)

H_FILL   = mk_fill("1F4E78"); H_FONT   = mk_font(True,"FFFFFF",11)
S1_FILL  = mk_fill("2E75B6"); S1_FONT  = mk_font(True,"FFFFFF",11)   # size col 1
S2_FILL  = mk_fill("2E75B6"); S2_FONT  = mk_font(True,"FFFFFF",11)   # size col 2
S3_FILL  = mk_fill("2E75B6"); S3_FONT  = mk_font(True,"FFFFFF",11)   # size col 3
S4_FILL  = mk_fill("4472C4"); S4_FONT  = mk_font(True,"FFFFFF",11)   # size col 4
T_FILL   = mk_fill("D9E1F2"); T_FONT   = mk_font(True,"000000",11)
TI_FONT  = mk_font(True,"1F4E78",14)
SU_FONT  = mk_font(italic=True, color="595959", sz=10)
ALT_FILL = mk_fill("EBF3FB")
BORDER   = Border(left=Side(style="thin",color="BFBFBF"),right=Side(style="thin",color="BFBFBF"),
                  top=Side(style="thin",color="BFBFBF"),bottom=Side(style="thin",color="BFBFBF"))

SIZE_FILLS = [mk_fill("2E75B6"), mk_fill("2F5597"), mk_fill("1F4E78"), mk_fill("4472C4")]

def apply_hdr(ws, row, ncol, fill=H_FILL, font=H_FONT):
    for c in range(1, ncol+1):
        cell = ws.cell(row, c)
        cell.fill = fill; cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 36

def apply_tot(ws, row, ncol):
    for c in range(1, ncol+1):
        cell = ws.cell(row, c)
        cell.fill = T_FILL; cell.font = T_FONT; cell.border = BORDER

def dc(ws, r, c, v, fmt=None, alt=False, center=False):
    cell = ws.cell(r, c, v)
    cell.border = BORDER
    if fmt: cell.number_format = fmt
    if alt: cell.fill = ALT_FILL
    cell.alignment = Alignment(vertical="center", horizontal="center" if center else "left")
    return cell

def auto_fit(ws, min_w=12, max_w=42):
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        mx = max((len(str(cell.value or "")) for cell in col if cell.row > 2), default=min_w)
        ws.column_dimensions[letter].width = min(max_w, max(min_w, mx + 3))

# ── Load CSV ───────────────────────────────────────────────────────────────
def load_csv():
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    outlets = [(i, rows[5][i].strip()) for i in range(3, len(rows[5]), 2)
               if rows[5][i].strip() and rows[5][i].strip().lower() not in ("warehouse","total")]
    items = {}; item_order = []
    for r in rows[7:]:
        if len(r) <= 1 or not r[1].strip(): continue
        name = " ".join(r[1].replace("\n"," ").replace("<br>"," ").split())
        if name not in items: items[name] = {}; item_order.append(name)
        for col_i, o_name in outlets:
            qty = float(r[col_i]) if col_i < len(r) and r[col_i] else 0.0
            items[name][o_name] = items[name].get(o_name, 0.0) + qty
    return [o for _, o in outlets], items, item_order

# ── Load Purchase ──────────────────────────────────────────────────────────
def load_purchases(csv_outlets):
    wb = openpyxl.load_workbook(ORDER_PATH, data_only=True)
    ws = wb["Sales Report"]
    rows_all = list(ws.iter_rows(values_only=True))
    ord_labels = [(ci, str(v or "").replace("\n"," ").strip())
                  for ci, v in enumerate(rows_all[2]) if ci > 0 and v]
    mat_data = {}
    for row in rows_all[3:]:
        mat = row[0]
        if not mat or "total" in str(mat).lower(): continue
        mat = str(mat).strip().upper()
        mat_data[mat] = {}
        for ci, lbl in ord_labels:
            try: mat_data[mat][lbl] = int(float(str(row[ci] if ci < len(row) else 0) or 0))
            except: mat_data[mat][lbl] = 0

    def fuzzy(csv_name, ord_names):
        words = set(csv_name.lower().replace("(","").replace(")","").replace("-"," ").split())
        best, score = None, 0
        for on in ord_names:
            s = len(words & set(on.lower().replace("(","").replace(")","").replace("-"," ").split()))
            if s > score: score, best = s, on
        return best if score >= 2 else None

    ord_names = [lbl for _, lbl in ord_labels]
    CAT_SPECS = {
        "Beverages_Coffee":  ("COFFEE POUCH", 32, "Pouches"),
        "Beverages_Choc":    ("COLD CHOCOLATE", 32, "Pouches"),
        "Beverages_Mango":   ("MANGO FLAVORED MILK", 1, "Packs"),
        "Burgers":           ("BURGER BUN", 6, "Buns"),
        "Pizzas":            ("PIZZA", 4, "Bases"),
        "Sandwiches":        ("SANDWICH BREAD", 4, "Loaves"),
        "Garlic Bread":      ("GARLIC BREAD", 15, "Pieces"),
        "French Fries":      ("FRENCH FRIES", 1, "Packs"),
    }
    purch = {cat: {} for cat in CAT_SPECS}
    for csv_name in csv_outlets:
        best = fuzzy(csv_name, ord_names)
        for cat, (mat_key, pack_size, _) in CAT_SPECS.items():
            matched = {k: v for k, v in mat_data.items() if mat_key in k}
            packs = sum(d.get(best, 0) for d in matched.values()) if best else 0
            purch[cat][csv_name] = (packs, packs * pack_size)
    return purch, CAT_SPECS

# ── Item catalogue ─────────────────────────────────────────────────────────
# (item_name) -> (category, size_key, price_label, purch_cat)
ITEMS = {
    # Coffee
    "coffee 25":          ("Beverages","Small",    "Cold Coffee Small ₹25",   "Beverages_Coffee"),
    "Coffee 30":          ("Beverages","Big",       "Cold Coffee Big ₹30",    "Beverages_Coffee"),
    "Coffee 35":          ("Beverages","Bigger",    "Cold Coffee Bigger ₹35", "Beverages_Coffee"),
    "HOT COFFEE":         ("Beverages","Other",     "Hot Coffee ₹35",         "Beverages_Coffee"),
    "Coffee Pouch":       ("Beverages","Other",     "Coffee Pouch Retail",     "Beverages_Coffee"),
    # Chocolate
    "Chocolate 29":           ("Beverages","Small",  "Cold Choc Small ₹29",    "Beverages_Choc"),
    "Cold Chocolate Parcel":  ("Beverages","Bigger", "Cold Choc Bigger ₹45",   "Beverages_Choc"),
    "Cold Chocolate Pouch":   ("Beverages","Other",  "Choc Pouch Retail",       "Beverages_Choc"),
    "HOT CHOCOLATE":          ("Beverages","Other",  "Hot Chocolate ₹40",       "Beverages_Choc"),
    "Cold Choclet":           ("Beverages","Bigger", "Cold Choc Bigger ₹45",   "Beverages_Choc"),
    "Cold Chocolate":         ("Beverages","Small",  "Cold Choc Small ₹29",    "Beverages_Choc"),
    "Frappe with Choco":      ("Beverages","Bigger", "Frappe with Choco ₹59",  "Beverages_Choc"),
    # Mango / Fruit
    "Mango Milkshake":        ("Beverages","Small",  "Mango Shake Small ₹35",  "Beverages_Mango"),
    "Mango 45":               ("Beverages","Big",    "Mango Shake Big ₹45",    "Beverages_Mango"),
    "Mango Milkshake Parcel": ("Beverages","Big",    "Mango Shake Big ₹45",    "Beverages_Mango"),
    "Mango 50":               ("Beverages","Bigger", "Mango Shake Bigger ₹50", "Beverages_Mango"),
    "Mango Pouch":            ("Beverages","Other",  "Mango Pouch Retail",      "Beverages_Mango"),
    "Pineapple 45":           ("Beverages","Bigger", "Pineapple Shake ₹45",    "Beverages_Mango"),
    # Water
    "Bottle":  ("Beverages","Other","Packaged Water","Beverages_Coffee"),
    "Water":   ("Beverages","Other","Packaged Water","Beverages_Coffee"),
    "WATER":   ("Beverages","Other","Packaged Water","Beverages_Coffee"),
    # Burgers
    "Veg Burger":                     ("Burgers","Regular",      "Veggie Regular ₹30",       "Burgers"),
    "Tangy Burger":                   ("Burgers","Regular",      "Tangy Regular ₹30",        "Burgers"),
    "Chatpata burger":                ("Burgers","Regular",      "Chatpata Regular ₹30",     "Burgers"),
    "Tandoori Veg Burger":            ("Burgers","Regular",      "Flavoured Regular ₹40",    "Burgers"),
    "Peri Peri Veg Burger":           ("Burgers","Regular",      "Flavoured Regular ₹40",    "Burgers"),
    "Schezwan Chutney Burger":        ("Burgers","Regular",      "Chutney Regular ₹50",      "Burgers"),
    "GREEN INFERNO BURGER":           ("Burgers","Regular",      "Chutney Regular ₹50",      "Burgers"),
    "JAIN VEG BURGER":                ("Burgers","Regular",      "Veggie Jain ₹30",          "Burgers"),
    "Veg Cheesy Burger":              ("Burgers","Cheezy",       "Veggie Cheezy ₹40",        "Burgers"),
    "Cheesy Tangy Burger":            ("Burgers","Cheezy",       "Tangy Cheezy ₹40",         "Burgers"),
    "Chatpata cheese burger":         ("Burgers","Cheezy",       "Chatpata Cheezy ₹40",      "Burgers"),
    "Cheezy Tandoori  Burger":        ("Burgers","Cheezy",       "Flavoured Cheezy ₹50",     "Burgers"),
    "Cheezy Peri Peri  Burger":       ("Burgers","Cheezy",       "Flavoured Cheezy ₹50",     "Burgers"),
    "Cheezy Schezwan Chutney":        ("Burgers","Cheezy",       "Chutney Cheezy ₹60",       "Burgers"),
    "Cheesy Green Infreno Burger":    ("Burgers","Cheezy",       "Chutney Cheezy ₹60",       "Burgers"),
    "Jain Cheesy Tangy Burger":       ("Burgers","Cheezy",       "Jain Cheezy ₹40",          "Burgers"),
    "Double Cheesy Veggies Burger":   ("Burgers","Double Cheese","Veggie Dbl Cheese ₹50",    "Burgers"),
    "Double Cheesy Tangy Burger":     ("Burgers","Double Cheese","Tangy Dbl Cheese ₹50",     "Burgers"),
    "Double Cheese Chatpata Burger":  ("Burgers","Double Cheese","Chatpata Dbl Cheese ₹50",  "Burgers"),
    "Double Cheesy Tandoori Burger":  ("Burgers","Double Cheese","Flavoured Dbl Cheese ₹60", "Burgers"),
    "Double Cheesy Peri Peri Burger": ("Burgers","Double Cheese","Flavoured Dbl Cheese ₹60", "Burgers"),
    "Double Cheesy Schezwan Chutney": ("Burgers","Double Cheese","Chutney Dbl Cheese ₹70",   "Burgers"),
    "Double Cheesy Green Inferno Burger":("Burgers","Double Cheese","Chutney Dbl Cheese ₹70","Burgers"),
    # Pizzas
    "Pizza Margherita":        ("Pizzas","Standard (₹50)","Margherita ₹50",       "Pizzas"),
    "Veg Pizza":               ("Pizzas","Standard (₹50)","Veg Cheesy ₹50",       "Pizzas"),
    "Schezwan Chutney Pizza":  ("Pizzas","Deluxe (₹80)", "Schezwan Pizza ₹80",    "Pizzas"),
    "GREEN INFERNO PIZZA":     ("Pizzas","Deluxe (₹80)", "Green Inferno ₹80",     "Pizzas"),
    "Tandoori Pizza":          ("Pizzas","Premium (₹99)","Tandoori Paneer ₹99",   "Pizzas"),
    "Corn Capsicum Pizza":     ("Pizzas","Premium (₹99)","Corn Capsicum ₹99",     "Pizzas"),
    # Sandwiches
    "Mayo Sandwich":                 ("Sandwiches","Mayo (₹45)",         "Mayo Sandwich ₹45",         "Sandwiches"),
    "Cheese Mayo Sandwich":          ("Sandwiches","Cheese Mayo (₹65)",  "Cheese Mayo ₹65",           "Sandwiches"),
    "Cheese Mayo Sandwich (Spl.)":   ("Sandwiches","Cheese Mayo (₹65)",  "Cheese Mayo Special",       "Sandwiches"),
    "Peri Peri Mayo Sandwich":       ("Sandwiches","Flavoured (₹75)",    "Peri Peri Mayo ₹75",        "Sandwiches"),
    "Tandoori Mayo Sandwich":        ("Sandwiches","Flavoured (₹75)",    "Tandoori Mayo ₹75",         "Sandwiches"),
    "Bread Butter Sandwich":         ("Sandwiches","Bread Butter (₹30)", "Bread Butter ₹30",          "Sandwiches"),
    "Bread Butter Chutney Sandwich": ("Sandwiches","Bread Butter (₹35)", "Bread Butter Chutney ₹35",  "Sandwiches"),
    # Garlic Bread
    "PLAIN GARLIC BREAD":      ("Garlic Bread","Plain (₹59)",      "Plain Garlic Bread ₹59",      "Garlic Bread"),
    "VEG CHEESE GARLIC BREAD": ("Garlic Bread","Veg Cheese (₹79)", "Veg Cheese Garlic Bread ₹79", "Garlic Bread"),
    # French Fries
    "Salted Fries":    ("French Fries","Salted (₹45)",   "Salted Fries ₹45",   "French Fries"),
    "Peri Peri Fries": ("French Fries","Peri Peri (₹55)","Peri Peri Fries ₹55","French Fries"),
}

# Combo contributions: combo_name -> [(category, purch_cat, multiplier)]
COMBOS = {
    "(CO) Cheesy Burger+Big Cold Coffee 75":           [("Burgers","Burgers",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Cheesy Burger+Big Cold Coffee 85":           [("Burgers","Burgers",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Pizza Margherita+French Fries+Bigger Cold Chocolate":[("Pizzas","Pizzas",1),("French Fries","French Fries",1),("Beverages","Beverages_Choc",1)],
    "(CO) French Fries+Any 2 dip Of choice":           [("French Fries","French Fries",1)],
    "(CO) Tangy Burger+French Fries+Big Cold Coffee":  [("Burgers","Burgers",1),("French Fries","French Fries",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Cheesy Burger (1+1) 90":                     [("Burgers","Burgers",2)],
    "(CO) Cheesy Burger (1+1) 99":                     [("Burgers","Burgers",2)],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Coffee":     [("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Any Double Cheesy Burger+Cheese Mayo Sandwich+Big Cold Coffee": [("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Cheesy Burger+French Fries 80":              [("Burgers","Burgers",1),("French Fries","French Fries",1)],
    "(CO) Cheesy Burger+French Fries 90":              [("Burgers","Burgers",1),("French Fries","French Fries",1)],
    "(CO) Any 2cheesy Burger+French Fries+Bigger Coffee":[("Burgers","Burgers",2),("French Fries","French Fries",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Flavoured Burger+Margherita+Sandwich+French Fries+Big Cold Coffe":[("Burgers","Burgers",1),("Pizzas","Pizzas",1),("Sandwiches","Sandwiches",1),("French Fries","French Fries",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Cold Coffee 120": [("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Cold Coffee  130":[("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Any Double Cheesy Burger+Cheese Mayo Sandwich+Big Cold Chocolate":[("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Choc",1)],
    "(CO) Flavoured Cheesy Burger+Mayo Sandwich+Big Coffee": [("Burgers","Burgers",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",1)],
    "(CO) Schezwan Pizza+Mayo Sandwich+2 Big Cold Coffee":   [("Pizzas","Pizzas",1),("Sandwiches","Sandwiches",1),("Beverages","Beverages_Coffee",2)],
    "(CO) Coffee + Cookie":                            [("Beverages","Beverages_Coffee",1)],
}

# Category definitions: size_keys = ordered list, each with label+price for the column header
CAT_DEFS = {
    "Beverages": {
        "purch_key":   "Beverages_Coffee",
        "unit":        "Pouches (Coffee) / Pouches (Choc) / Packs (Mango)",
        "size_keys":   ["Small","Big","Bigger","Other"],
        "size_labels": ["Small / Regular (₹25-29)","Big (₹30-45)","Bigger / Parcel (₹35-59)","Other (Hot/Pouch/Water)"],
        "size_fills":  ["2E75B6","2F5597","1F4E78","4472C4"],
        "total_purch": "Beverages_Coffee",
    },
    "Burgers": {
        "purch_key":   "Burgers",
        "unit":        "Buns (6/pack)",
        "size_keys":   ["Regular","Cheezy","Double Cheese"],
        "size_labels": ["Regular (₹30-50)","Cheezy (₹40-60)","Double Cheese (₹50-70)"],
        "size_fills":  ["2E75B6","2F5597","1F4E78"],
        "total_purch": "Burgers",
    },
    "Pizzas": {
        "purch_key":   "Pizzas",
        "unit":        "Bases (4/pack)",
        "size_keys":   ["Standard (₹50)","Deluxe (₹80)","Premium (₹99)"],
        "size_labels": ["Standard (₹50)","Deluxe (₹80)","Premium (₹99)"],
        "size_fills":  ["2E75B6","2F5597","1F4E78"],
        "total_purch": "Pizzas",
    },
    "Sandwiches": {
        "purch_key":   "Sandwiches",
        "unit":        "Loaves (4/pack)",
        "size_keys":   ["Mayo (₹45)","Cheese Mayo (₹65)","Flavoured (₹75)","Bread Butter (₹30)","Bread Butter (₹35)"],
        "size_labels": ["Mayo (₹45)","Cheese Mayo (₹65)","Flavoured Mayo (₹75)","Bread Butter (₹30)","Bread Butter Chutney (₹35)"],
        "size_fills":  ["2E75B6","2F5597","1F4E78","4472C4","203864"],
        "total_purch": "Sandwiches",
    },
    "Garlic Bread": {
        "purch_key":   "Garlic Bread",
        "unit":        "Pieces (15/pack)",
        "size_keys":   ["Plain (₹59)","Veg Cheese (₹79)"],
        "size_labels": ["Plain Garlic Bread (₹59)","Veg Cheese Garlic Bread (₹79)"],
        "size_fills":  ["2E75B6","1F4E78"],
        "total_purch": "Garlic Bread",
    },
    "French Fries": {
        "purch_key":   "French Fries",
        "unit":        "Packs (French Fries)",
        "size_keys":   ["Salted (₹45)","Peri Peri (₹55)"],
        "size_labels": ["Salted Fries (₹45)","Peri Peri Fries (₹55)"],
        "size_fills":  ["2E75B6","1F4E78"],
        "total_purch": "French Fries",
    },
}


def build_workbook(cat_name, cat_def, all_items, item_order, outlet_names, purch_data):
    wb = openpyxl.Workbook(); wb.remove(wb.active)

    purch_key   = cat_def["purch_key"]
    size_keys   = cat_def["size_keys"]
    size_labels = cat_def["size_labels"]
    size_fills  = cat_def["size_fills"]
    unit        = cat_def["unit"]
    n_sz        = len(size_keys)

    # Items in this category
    cat_items = [(nm, ITEMS[nm][1], ITEMS[nm][2]) for nm in item_order if nm in ITEMS and ITEMS[nm][0] == cat_name]

    # Precompute: for each outlet × size_key → total sales qty (individual items)
    def outlet_size_qty(outlet, size_key):
        return sum(all_items.get(nm, {}).get(outlet, 0.0)
                   for nm in item_order if nm in ITEMS
                   and ITEMS[nm][0] == cat_name and ITEMS[nm][1] == size_key)

    def outlet_combo_qty(outlet):
        total = 0.0
        for cname, contribs in COMBOS.items():
            for (c_cat, _, c_mult) in contribs:
                if c_cat == cat_name:
                    total += all_items.get(cname, {}).get(outlet, 0.0) * c_mult
        return total

    # ── SUMMARY sheet ─────────────────────────────────────────────────────
    ws = wb.create_sheet("SUMMARY")
    ws["A1"] = f"{cat_name.upper()} – OUTLET-WISE SALES BY SIZE/VARIANT + PURCHASE QTY + RMD %"
    ws["A1"].font = TI_FONT
    ws["A2"] = (f"Category: {cat_name}  |  Sizes: {', '.join(size_labels)}  |  "
                f"Purchase Unit: {unit}  |  RMD% = Total Sales / Purchase Units")
    ws["A2"].font = SU_FONT

    # Column layout (row 4 = sub-header with size labels; row 3 = merged groups)
    # Cols: 1=Outlet | 2..n_sz+1=size sales | n_sz+2=Ind Total | n_sz+3=Combo | n_sz+4=Grand Total | n_sz+5=Purch Packs | n_sz+6=Purch Units | n_sz+7=RMD%
    COL_SZ_START = 2
    COL_IND      = COL_SZ_START + n_sz
    COL_COMBO    = COL_IND + 1
    COL_TOTAL    = COL_IND + 2
    COL_PP       = COL_IND + 3
    COL_PU       = COL_IND + 4
    COL_RMD      = COL_IND + 5
    N_COLS       = COL_RMD

    # Row 3: group headers (merge Sales Qty group, Purchase group)
    ws.cell(3, 1, "Outlet Name").font = mk_font(True)
    for i, (sk, sl, sf) in enumerate(zip(size_keys, size_labels, size_fills)):
        c = COL_SZ_START + i
        cell = ws.cell(3, c, sl)
        cell.fill = mk_fill(sf); cell.font = mk_font(True,"FFFFFF",10)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.cell(3, COL_IND,   "Individual\nSales Total").font = mk_font(True,"1F4E78",10)
    ws.cell(3, COL_COMBO, "Combo\nSales Total").font     = mk_font(True,"1F4E78",10)
    ws.cell(3, COL_TOTAL, "Grand Total\nSales Qty").font  = mk_font(True,"FFFFFF",10)
    ws.cell(3, COL_TOTAL).fill = mk_fill("375623")
    ws.cell(3, COL_PP,    "Purchase\nQty (Packs)").font   = mk_font(True,"FFFFFF",10)
    ws.cell(3, COL_PP).fill = mk_fill("843C0C")
    ws.cell(3, COL_PU,    "Purchase\nQty (Units)").font   = mk_font(True,"FFFFFF",10)
    ws.cell(3, COL_PU).fill = mk_fill("843C0C")
    ws.cell(3, COL_RMD,   "RMD %\n(Sales/Purchase)").font = mk_font(True,"FFFFFF",10)
    ws.cell(3, COL_RMD).fill = mk_fill("7B2C2C")
    for c in range(1, N_COLS+1):
        ws.cell(3, c).alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.cell(3, c).border = BORDER
    ws.row_dimensions[3].height = 40

    for ridx, outlet in enumerate(outlet_names, 4):
        alt = (ridx % 2 == 0)
        dc(ws, ridx, 1, outlet, alt=alt)
        sz_total_ind = 0.0
        for i, sk in enumerate(size_keys):
            q = outlet_size_qty(outlet, sk)
            sz_total_ind += q
            cell = dc(ws, ridx, COL_SZ_START+i, int(q), "#,##0", alt=alt, center=True)
            cell.fill = ALT_FILL if alt else mk_fill("EEF4FB")
        dc(ws, ridx, COL_IND, int(sz_total_ind), "#,##0", alt=alt, center=True)
        combo_q = outlet_combo_qty(outlet)
        dc(ws, ridx, COL_COMBO, int(combo_q), "#,##0", alt=alt, center=True)

        tc = get_column_letter(COL_IND); cc = get_column_letter(COL_COMBO)
        ws.cell(ridx, COL_TOTAL, f"={tc}{ridx}+{cc}{ridx}").number_format = "#,##0"
        ws.cell(ridx, COL_TOTAL).border = BORDER
        ws.cell(ridx, COL_TOTAL).alignment = Alignment(horizontal="center")

        pk, un = purch_data.get(purch_key, {}).get(outlet, (0, 0))
        dc(ws, ridx, COL_PP, pk, "#,##0", alt=alt, center=True)
        dc(ws, ridx, COL_PU, un, "#,##0", alt=alt, center=True)
        totl = get_column_letter(COL_TOTAL); pul = get_column_letter(COL_PU)
        ws.cell(ridx, COL_RMD, f"=IF({pul}{ridx}>0,{totl}{ridx}/{pul}{ridx},0)").number_format = "0.0%"
        ws.cell(ridx, COL_RMD).border = BORDER
        ws.cell(ridx, COL_RMD).alignment = Alignment(horizontal="center")

    # Grand total row
    gr = 4 + len(outlet_names)
    ws.cell(gr, 1, "GRAND TOTAL (All Outlets)")
    for c in range(2, N_COLS+1):
        cl = get_column_letter(c)
        if c == COL_RMD:
            pul = get_column_letter(COL_PU); totl = get_column_letter(COL_TOTAL)
            ws.cell(gr, c, f"=IF({pul}{gr}>0,{totl}{gr}/{pul}{gr},0)").number_format = "0.0%"
        else:
            ws.cell(gr, c, f"=SUM({cl}4:{cl}{gr-1})").number_format = "#,##0"
    apply_tot(ws, gr, N_COLS)
    ws.freeze_panes = "B4"
    ws.column_dimensions["A"].width = 44
    for i in range(n_sz):
        ws.column_dimensions[get_column_letter(COL_SZ_START+i)].width = 20
    for c in range(COL_IND, N_COLS+1):
        ws.column_dimensions[get_column_letter(c)].width = 18

    # ── Per-item sheets ────────────────────────────────────────────────────
    for item_name, size_key, pdf_ref in cat_items:
        sname = item_name[:28].strip()
        try: ws_i = wb.create_sheet(sname)
        except: ws_i = wb.create_sheet(sname[:25])

        ws_i["A1"] = f"{item_name}  –  Outlet-wise Sales & Purchase by Size"
        ws_i["A1"].font = TI_FONT
        ws_i["A2"] = f"Category: {cat_name}  |  Variant/Size: {size_key}  |  Menu: {pdf_ref}"
        ws_i["A2"].font = SU_FONT

        # Header row 3: Outlet | size cols | Individual Sales | Combo | Total | Purchase Packs | Purchase Units | RMD%
        ws_i.cell(3, 1, "Outlet Name").font = mk_font(True)
        for i, (sk, sl, sf) in enumerate(zip(size_keys, size_labels, size_fills)):
            c = COL_SZ_START + i
            cell = ws_i.cell(3, c, sl)
            cell.fill = mk_fill(sf); cell.font = mk_font(True,"FFFFFF",10)
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = BORDER
        ws_i.cell(3, COL_IND,   "Individual\nSales").font   = mk_font(True,"1F4E78",10)
        ws_i.cell(3, COL_COMBO, "Combo\nSales").font        = mk_font(True,"1F4E78",10)
        ws_i.cell(3, COL_TOTAL, "Total Sales\nQty").font    = mk_font(True,"FFFFFF",10)
        ws_i.cell(3, COL_TOTAL).fill = mk_fill("375623")
        ws_i.cell(3, COL_PP,    "Purchase\nPacks").font     = mk_font(True,"FFFFFF",10)
        ws_i.cell(3, COL_PP).fill = mk_fill("843C0C")
        ws_i.cell(3, COL_PU,    "Purchase\nUnits").font     = mk_font(True,"FFFFFF",10)
        ws_i.cell(3, COL_PU).fill = mk_fill("843C0C")
        ws_i.cell(3, COL_RMD,   "RMD %").font               = mk_font(True,"FFFFFF",10)
        ws_i.cell(3, COL_RMD).fill = mk_fill("7B2C2C")
        for c in range(1, N_COLS+1):
            ws_i.cell(3, c).alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws_i.cell(3, c).border = BORDER
        ws_i.row_dimensions[3].height = 40

        for ridx, outlet in enumerate(outlet_names, 4):
            alt = (ridx % 2 == 0)
            dc(ws_i, ridx, 1, outlet, alt=alt)
            ind_total = 0.0
            for i, sk in enumerate(size_keys):
                # For this item's specific size, show its qty; for other sizes of same item, show 0
                q = all_items.get(item_name, {}).get(outlet, 0.0) if sk == size_key else 0.0
                ind_total += q
                cell = dc(ws_i, ridx, COL_SZ_START+i, int(q), "#,##0", alt=alt, center=True)
                cell.fill = ALT_FILL if alt else mk_fill("EEF4FB")
            dc(ws_i, ridx, COL_IND, int(ind_total), "#,##0", alt=alt, center=True)
            # Combo: portion attributable to this category
            cbo_q = outlet_combo_qty(outlet)
            dc(ws_i, ridx, COL_COMBO, int(cbo_q), "#,##0", alt=alt, center=True)
            tc = get_column_letter(COL_IND); cc = get_column_letter(COL_COMBO)
            ws_i.cell(ridx, COL_TOTAL, f"={tc}{ridx}+{cc}{ridx}").number_format = "#,##0"
            ws_i.cell(ridx, COL_TOTAL).border = BORDER
            ws_i.cell(ridx, COL_TOTAL).alignment = Alignment(horizontal="center")
            pk, un = purch_data.get(purch_key, {}).get(outlet, (0, 0))
            dc(ws_i, ridx, COL_PP, pk, "#,##0", alt=alt, center=True)
            dc(ws_i, ridx, COL_PU, un, "#,##0", alt=alt, center=True)
            totl = get_column_letter(COL_TOTAL); pul = get_column_letter(COL_PU)
            ws_i.cell(ridx, COL_RMD, f"=IF({pul}{ridx}>0,{totl}{ridx}/{pul}{ridx},0)").number_format = "0.0%"
            ws_i.cell(ridx, COL_RMD).border = BORDER
            ws_i.cell(ridx, COL_RMD).alignment = Alignment(horizontal="center")

        gr_i = 4 + len(outlet_names)
        ws_i.cell(gr_i, 1, "GRAND TOTAL")
        for c in range(2, N_COLS+1):
            cl = get_column_letter(c)
            if c == COL_RMD:
                pul = get_column_letter(COL_PU); totl = get_column_letter(COL_TOTAL)
                ws_i.cell(gr_i, c, f"=IF({pul}{gr_i}>0,{totl}{gr_i}/{pul}{gr_i},0)").number_format = "0.0%"
            else:
                ws_i.cell(gr_i, c, f"=SUM({cl}4:{cl}{gr_i-1})").number_format = "#,##0"
        apply_tot(ws_i, gr_i, N_COLS)
        ws_i.freeze_panes = "B4"
        ws_i.column_dimensions["A"].width = 44
        for ii in range(n_sz):
            ws_i.column_dimensions[get_column_letter(COL_SZ_START+ii)].width = 20
        for c in range(COL_IND, N_COLS+1):
            ws_i.column_dimensions[get_column_letter(c)].width = 18

    return wb


def main():
    outlet_names, all_items, item_order = load_csv()
    purch_data, _ = load_purchases(outlet_names)

    output_files = []
    for cat_name, cat_def in CAT_DEFS.items():
        wb = build_workbook(cat_name, cat_def, all_items, item_order, outlet_names, purch_data)
        fname = cat_name.replace(" ", "_") + "_Outlet_Report.xlsx"
        fpath = os.path.join(OUT_DIR, fname)
        wb.save(fpath)
        n_sheets = len(wb.sheetnames)
        print(f"Saved: {fname}  ({n_sheets} sheets, {os.path.getsize(fpath)//1024} KB)")
        output_files.append(fpath)

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in output_files:
            zf.write(p, os.path.basename(p))
    shutil.copy2(ZIP_PATH, DL_ZIP)
    print(f"\nZipped  → {ZIP_PATH}  ({os.path.getsize(ZIP_PATH)//1024} KB)")
    print(f"Copied  → {DL_ZIP}")


if __name__ == "__main__":
    main()
