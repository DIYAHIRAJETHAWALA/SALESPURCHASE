"""Generate all 3 Excel workbooks aligned with the Byting Korner PDF Menu:
- Sales Quantity broken down by Small (Regular), Big, Bigger (for Beverages)
  and by menu size/variant for Burgers, Pizzas, Sandwiches, Garlic Bread, French Fries
- Purchase Quantity (Packs & Units)
- RMD % (Sales Qty / Purchase Qty)
- Zero rate/price/revenue/profit/margin columns
- Packaged into Sales_Purchase_Analysis_Reports.zip in d:/SPpro/ and Downloads.
"""
import csv
import io
import os
import shutil
import zipfile
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

CSV_PATH = "d:/SPpro/sample_data/Location Wise Item Sales Report 20-11-2026 16_42.csv"
ZIP_PATH = "d:/SPpro/Sales_Purchase_Analysis_Reports.zip"
DOWNLOADS_ZIP_PATH = os.path.join(os.path.expanduser("~"), "Downloads", "Sales_Purchase_Analysis_Reports.zip")

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


def auto_fit(ws, min_w=10, max_w=46):
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


def load_csv_data():
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    outlets = []
    for i in range(3, len(rows[5]), 2):
        name = rows[5][i].strip()
        if name and name.lower() not in ("warehouse", "total"):
            outlets.append((i, name))

    items = {}  # item_name -> {outlet_name: qty, '__total__': total_qty}
    item_order = []
    for r in rows[7:]:
        if len(r) <= 1 or not r[1].strip():
            continue
        name = r[1].replace("\n", " ").replace("<br>", " ").strip()
        # Collapse multiple spaces
        clean_name = " ".join(name.split())
        if clean_name not in items:
            items[clean_name] = {o_name: 0.0 for _, o_name in outlets}
            items[clean_name]["__total__"] = 0.0
            item_order.append(clean_name)
        for col_i, o_name in outlets:
            val = float(r[col_i]) if col_i < len(r) and r[col_i] else 0.0
            items[clean_name][o_name] += val
        tot_val = float(r[-2]) if r[-2] else 0.0
        items[clean_name]["__total__"] += tot_val

    return [o_name for _, o_name in outlets], items, item_order


def _safe_int(v):
    if v is None:
        return 0
    s = str(v).strip().replace(",", "")
    if s.startswith("="):
        return 0
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return 0


def load_purchase_by_outlet():
    """Read exact outlet-level purchase quantities from the order-report (ground truth)."""
    # Order-report packs per outlet per material (Row index -> material name from R4..R57)
    ord_wb = openpyxl.load_workbook("d:/SPpro/sample_data/order-report-From-01-11-2026-to-07-11-2026.xlsx", data_only=True)
    ws_ord = ord_wb["Sales Report"]

    # Rows 2-3: franchise / outlet headers; Row 4+ items; last row = Total
    hdr_r2 = list(ws_ord.iter_rows(min_row=2, max_row=2, values_only=True))[0]
    hdr_r3 = list(ws_ord.iter_rows(min_row=3, max_row=3, values_only=True))[0]
    # Build outlet col map: col_index -> clean outlet name
    outlet_cols = {}
    for ci, (h2, h3) in enumerate(zip(hdr_r2, hdr_r3)):
        label = str(h3 or "").replace("\n", " ").strip() if h3 else str(h2 or "").replace("\n", " ").strip()
        if label and label != "Item":
            outlet_cols[ci] = label

    # Build material -> {outlet_col: qty}
    material_qty = {}
    for row in ws_ord.iter_rows(min_row=4, values_only=True):
        mat = row[0]
        if not mat or "total" in str(mat).lower():
            continue
        mat = str(mat).strip().upper()
        material_qty[mat] = {}
        for ci, lbl in outlet_cols.items():
            material_qty[mat][lbl] = _safe_int(row[ci]) if ci < len(row) else 0

    # Category -> (raw_material, pack_size) for unit conversion
    cat_specs = {
        "Beverages":    ("COFFEE POUCH",   32),  # 32 pouches/pack
        "Burgers":      ("BURGER BUN",      6),  # 6 buns/pack
        "Pizzas":       ("PIZZA",           4),  # 4 bases/pack
        "Sandwiches":   ("SANDWICH BREAD",  4),  # 4 loaves/pack
        "Garlic Bread": ("GARLIC BREAD",   15),  # 15 pcs/pack
        "French Fries": ("FRENCH FRIES",    1),  # packs = kg (2.5 kg -> keep as packs for ratio)
        "Cold Chocolate": ("COLD CHOCOLATE", 32),
        "Mango":          ("MANGO FLAVORED MILK", 1),
    }

    purchase = {}
    for cat, (mat_key, pack_size) in cat_specs.items():
        rows_match = {k: v for k, v in material_qty.items() if mat_key in k}
        purchase[cat] = {}
        all_outlets = set()
        for d in rows_match.values():
            all_outlets.update(d.keys())
        for o_lbl in all_outlets:
            total_packs = sum(d.get(o_lbl, 0) for d in rows_match.values())
            total_units = total_packs * pack_size
            purchase[cat][o_lbl] = (total_packs, total_units)

    # Also build a CSV-name -> order-report name mapping for beverages outlet lookup
    # (CSV uses different outlet names than order-report)
    # We'll add direct CSV-name keys by fuzzy-matching on key words
    # For simplicity: also store by CSV outlet name using sum across all columns as fallback
    for cat in list(purchase.keys()):
        total_packs_all = sum(v[0] for v in purchase[cat].values())
        total_units_all = sum(v[1] for v in purchase[cat].values())
        purchase[cat]["__total_packs__"] = total_packs_all
        purchase[cat]["__total_units__"] = total_units_all

    # Load old Consolidated workbook from zip for structure reference
    zf = zipfile.ZipFile(ZIP_PATH)
    old_wb = openpyxl.load_workbook(io.BytesIO(zf.read("Consolidated_Sales_Purchase_Analysis_Report.xlsx")), data_only=False)

    # Build CSV-outlet -> packs mapping via keyword matching with order-report outlets
    # For each CSV outlet, find best matching order-report outlet
    def match_outlet(csv_name, ord_names):
        csv_low = csv_name.lower()
        best, best_score = None, 0
        for on in ord_names:
            on_low = on.lower()
            # Count common words
            words_csv = set(csv_low.replace("(", " ").replace(")", " ").replace("-", " ").split())
            words_on = set(on_low.replace("(", " ").replace(")", " ").replace("-", " ").split())
            score = len(words_csv & words_on)
            if score > best_score:
                best_score, best = score, on
        return best if best_score >= 2 else None

    ord_outlet_names = list(next(iter(purchase.values())).keys()) if purchase else []
    ord_outlet_names = [k for k in ord_outlet_names if not k.startswith("__")]

    # Load CSV outlets
    with open(CSV_PATH, "r", encoding="utf-8-sig") as f:
        csv_rows = list(csv.reader(f))
    csv_outlet_names = []
    for i in range(3, len(csv_rows[5]), 2):
        nm = csv_rows[5][i].strip()
        if nm and nm.lower() not in ("warehouse", "total"):
            csv_outlet_names.append(nm)

    # Build a lookup: csv_outlet -> packs/units per category using order-report match
    csv_purchase = {cat: {} for cat in cat_specs}
    for csv_name in csv_outlet_names:
        best = match_outlet(csv_name, ord_outlet_names)
        for cat in cat_specs:
            if best and best in purchase[cat]:
                csv_purchase[cat][csv_name] = purchase[cat][best]
            else:
                # Distribute total proportionally (fallback: equal share)
                n = len(csv_outlet_names)
                tp = purchase[cat].get("__total_packs__", 0) // n if n else 0
                tu = purchase[cat].get("__total_units__", 0) // n if n else 0
                csv_purchase[cat][csv_name] = (tp, tu)

    return csv_purchase, old_wb


# Combo disaggregation rules aligned with PDF menu:
# Each combo maps to list of (category, size_bucket, count_per_combo)
COMBO_RULES = {
    "(CO) Cheesy Burger+Big Cold Coffee 75": [
        ("Burgers", "Cheezy", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Cheesy Burger+Big Cold Coffee 85": [
        ("Burgers", "Cheezy", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Pizza Margherita+French Fries+Bigger Cold Chocolate": [
        ("Pizzas", "Standard", 1), ("French Fries", "Salted", 1), ("Beverages", "Bigger", 1), ("Chocolate", "Bigger", 1)
    ],
    "(CO) French Fries+Any 2 dip Of choice": [
        ("French Fries", "Loaded", 1)
    ],
    "(CO) Tangy Burger+French Fries+Big Cold Coffee": [
        ("Burgers", "Regular", 1), ("French Fries", "Salted", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Cheesy Burger (1+1) 90": [
        ("Burgers", "Cheezy", 2)
    ],
    "(CO) Cheesy Burger (1+1) 99": [
        ("Burgers", "Cheezy", 2)
    ],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Coffee": [
        ("Burgers", "Cheezy", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Any Double Cheesy Burger+Cheese Mayo Sandwich+Big Cold Coffee": [
        ("Burgers", "Double Cheese", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Cheesy Burger+French Fries 80": [
        ("Burgers", "Cheezy", 1), ("French Fries", "Salted", 1)
    ],
    "(CO) Cheesy Burger+French Fries 90": [
        ("Burgers", "Cheezy", 1), ("French Fries", "Salted", 1)
    ],
    "(CO) Any 2cheesy Burger+French Fries+Bigger Coffee": [
        ("Burgers", "Cheezy", 2), ("French Fries", "Salted", 1), ("Beverages", "Bigger", 1), ("Coffee", "Bigger", 1)
    ],
    "(CO) Flavoured Burger+Margherita+Sandwich+French Fries+Big Cold Coffe": [
        ("Burgers", "Regular", 1), ("Pizzas", "Standard", 1), ("Sandwiches", "Regular", 1),
        ("French Fries", "Salted", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Cold Coffee 120": [
        ("Burgers", "Cheezy", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Cheesy Burger+Mayo Sandwich+Big Cold Coffee 130": [
        ("Burgers", "Cheezy", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Any Double Cheesy Burger+Cheese Mayo Sandwich+Big Cold Chocolate": [
        ("Burgers", "Double Cheese", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Chocolate", "Big", 1)
    ],
    "(CO) Flavoured Cheesy Burger+Mayo Sandwich+Big Coffee": [
        ("Burgers", "Cheezy", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 1), ("Coffee", "Big", 1)
    ],
    "(CO) Schezwan Pizza+Mayo Sandwich+2 Big Cold Coffee": [
        ("Pizzas", "Deluxe", 1), ("Sandwiches", "Regular", 1), ("Beverages", "Big", 2), ("Coffee", "Big", 2)
    ],
    "(CO) Coffee + Cookie": [
        ("Beverages", "Other", 1), ("Coffee", "Other", 1)
    ],
}

# Individual item -> (category, size_bucket, material_desc, pdf_menu_ref)
ITEM_CLASSIFICATION = {
    # Beverages - Coffee
    "coffee 25": ("Beverages", "Small", "Coffee Pouch + Small Glass (250ml) + Straw", "Cold Coffee Regular (₹25)"),
    "Coffee 30": ("Beverages", "Big", "Coffee Pouch + Big Glass (300ml) + Straw", "Cold Coffee Big (₹30)"),
    "Coffee 35": ("Beverages", "Bigger", "Coffee Pouch (Extra) + Bigger Glass (350ml) + Straw", "Cold Coffee Bigger (₹35)"),
    "HOT COFFEE": ("Beverages", "Other", "Coffee Premix + Hot Cup", "Hot Coffee (₹35)"),
    "Coffee Pouch": ("Beverages", "Other", "Retail Coffee Premix Pouch", "Retail Pouch"),
    # Beverages - Chocolate / Frappe
    "Chocolate 29": ("Beverages", "Small", "Chocolate Pouch + Small Glass (250ml) + Straw", "Cold Chocolate Regular (₹29)"),
    "Cold Chocolate": ("Beverages", "Small", "Chocolate Pouch + Small Glass (250ml) + Straw", "Cold Chocolate Regular (₹29)"),
    "Cold Chocolate Parcel": ("Beverages", "Bigger", "Chocolate Pouch (Extra) + Bigger Glass (350ml) + Straw", "Cold Chocolate Bigger (₹45)"),
    "Cold Choclet": ("Beverages", "Bigger", "Chocolate Pouch (Extra) + Bigger Glass (350ml) + Straw", "Cold Chocolate Bigger (₹45)"),
    "Frappe with Choco": ("Beverages", "Bigger", "Coffee + Chocolate Blend + Bigger Glass (350ml) + Straw", "Frappe with Choco Bigger (₹59)"),
    "HOT CHOCOLATE": ("Beverages", "Other", "Chocolate Premix + Hot Cup", "Hot Chocolate (₹40)"),
    "Cold Chocolate Pouch": ("Beverages", "Other", "Retail Chocolate Premix Pouch", "Retail Pouch"),
    # Beverages - Mango & Pineapple
    "Mango Milkshake": ("Beverages", "Small", "Mango Flavored Milk + Small Glass (250ml) + Straw", "Mango Shake Regular (₹35)"),
    "Mango 45": ("Beverages", "Big", "Mango Flavored Milk + Big Glass (300ml) + Straw", "Mango Shake Big (₹45)"),
    "Mango Milkshake Parcel": ("Beverages", "Big", "Mango Flavored Milk + Big Parcel Glass + Straw", "Mango Shake Big (₹45)"),
    "Mango 50": ("Beverages", "Bigger", "Mango Flavored Milk + Bigger Glass (350ml) + Straw", "Mango Shake Bigger (₹50)"),
    "Mango Pouch": ("Beverages", "Other", "Retail Mango Premix Pouch", "Retail Pouch"),
    "Pineapple 45": ("Beverages", "Bigger", "Pineapple Syrup + Bigger Glass (350ml) + Straw", "Pineapple Shake Bigger (₹45)"),
    # Beverages - Water
    "Bottle": ("Beverages", "Other", "Packaged Drinking Water Bottle", "Packaged Water"),
    "Water": ("Beverages", "Other", "Packaged Drinking Water", "Packaged Water"),
    "WATER": ("Beverages", "Other", "Packaged Drinking Water", "Packaged Water"),
    # Burgers
    "Veg Burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Mayo + Ketchup", "Veggie Burger Regular (₹30)"),
    "Tangy Burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Tangy Mayo + Ketchup", "Tangy Burger Regular (₹30)"),
    "Chatpata burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Chatpata Mayo + Ketchup", "Chatpata Burger Regular (₹30)"),
    "Tandoori Veg Burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Tandoori Mayo + Wafers", "Flavoured Burger Regular (₹40)"),
    "Peri Peri Veg Burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Peri Peri Mayo + Wafers", "Flavoured Burger Regular (₹40)"),
    "Schezwan Chutney Burger": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Schezwan + Wafers", "Chutney Burger Regular (₹50)"),
    "GREEN INFERNO BURGER": ("Burgers", "Regular", "Brown Bread Bun + Veg Tikki + Green Chutney + Wafers", "Chutney Burger Regular (₹50)"),
    "JAIN VEG BURGER": ("Burgers", "Regular", "Brown Bread Bun + Jain Tikki + Mayo + Ketchup", "Veggie Burger Jain (₹30)"),
    "Veg Cheesy Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Cheesy Spread", "Veggie Burger Cheezy (₹40)"),
    "Cheesy Tangy Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Tangy Mayo + Cheesy Spread", "Tangy Burger Cheezy (₹40)"),
    "Chatpata cheese burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Chatpata Mayo + Cheesy Spread", "Chatpata Burger Cheezy (₹40)"),
    "Cheezy Tandoori Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Tandoori Mayo + Cheesy Spread", "Flavoured Burger Cheezy (₹50)"),
    "Cheezy Peri Peri Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Peri Peri Mayo + Cheesy Spread", "Flavoured Burger Cheezy (₹50)"),
    "Cheezy Schezwan Chutney": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Schezwan + Cheesy Spread", "Chutney Burger Cheezy (₹60)"),
    "Cheesy Green Infreno Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Veg Tikki + Green Chutney + Cheesy Spread", "Chutney Burger Cheezy (₹60)"),
    "Jain Cheesy Tangy Burger": ("Burgers", "Cheezy", "Brown Bread Bun + Jain Tikki + Tangy Mayo + Cheesy Spread", "Tangy Burger Jain Cheezy (₹40)"),
    "Double Cheesy Veggies Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Cheesy Spread + Cheese Slice", "Veggie Double Cheese (₹50)"),
    "Double Cheesy Tangy Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Tangy Mayo + Cheese Slice", "Tangy Double Cheese (₹50)"),
    "Double Cheese Chatpata Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Chatpata Mayo + Cheese Slice", "Chatpata Double Cheese (₹50)"),
    "Double Cheesy Tandoori Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Tandoori Mayo + Cheese Slice", "Flavoured Double Cheese (₹60)"),
    "Double Cheesy Peri Peri Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Peri Peri Mayo + Cheese Slice", "Flavoured Double Cheese (₹60)"),
    "Double Cheesy Schezwan Chutney": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Schezwan + Cheese Slice", "Chutney Double Cheese (₹70)"),
    "Double Cheesy Green Inferno Burger": ("Burgers", "Double Cheese", "Brown Bread Bun + Veg Tikki + Green Chutney + Cheese Slice", "Chutney Double Cheese (₹70)"),
    # Pizzas
    "Pizza Margherita": ("Pizzas", "Standard", "Brown Bread Pizza Base + Puree + Cheese + Mozzarella", "Pizza Margherita (₹50)"),
    "Veg Pizza": ("Pizzas", "Standard", "Brown Bread Pizza Base + Puree + Veg + Cheese + Mozzarella", "Veg Cheesy Pizza (₹50)"),
    "Schezwan Chutney Pizza": ("Pizzas", "Deluxe", "Brown Bread Pizza Base + Schezwan + Veg + Cheese + Mozzarella", "Schezwan Pizza (₹80)"),
    "GREEN INFERNO PIZZA": ("Pizzas", "Deluxe", "Brown Bread Pizza Base + Green Chutney + Veg + Cheese + Mozzarella", "Green Inferno Pizza (₹80)"),
    "Tandoori Pizza": ("Pizzas", "Premium", "Brown Bread Pizza Base + Tandoori Mayo + Paneer + Mozzarella", "Tandoori Paneer Pizza (₹99)"),
    "Corn Capsicum Pizza": ("Pizzas", "Premium", "Brown Bread Pizza Base + Corn + Capsicum + Cheese + Mozzarella", "Corn Capsicum Pizza (₹99)"),
    # Sandwiches
    "Mayo Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Green Chutney + Mayo + Sev/Wafers", "Mayo Sandwich Regular (₹45)"),
    "Cheese Mayo Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Green Chutney + Mayo + Cheese", "Cheese Mayo Sandwich Regular (₹65)"),
    "Cheese Mayo Sandwich (Spl.)": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Green Chutney + Mayo + Cheese", "Cheese Mayo Sandwich Regular (₹65)"),
    "Peri Peri Mayo Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Peri Peri Mayo + Sev/Wafers", "Flavoured Mayo Sandwich Regular (₹75)"),
    "Tandoori Mayo Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Tandoori Mayo + Sev/Wafers", "Flavoured Mayo Sandwich Regular (₹75)"),
    "Bread Butter Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter", "Bread Butter Sandwich Regular (₹30)"),
    "Bread Butter Chutney Sandwich": ("Sandwiches", "Regular", "Sandwich Bread + Butter + Green Chutney", "Bread Butter Chutney Regular (₹35)"),
    # Garlic Bread
    "PLAIN GARLIC BREAD": ("Garlic Bread", "Plain", "Garlic Bread + Garlic Butter", "Plain Garlic Bread (₹59)"),
    "VEG CHEESE GARLIC BREAD": ("Garlic Bread", "Veg Cheese", "Garlic Bread + Garlic Butter + Mozzarella Cheese", "Veg Cheese Garlic Bread (₹79)"),
    # French Fries
    "Salted Fries": ("French Fries", "Salted", "French Fries (120g) + Frying Oil + Dish + Ketchup", "Salted Fries (₹45)"),
    "Peri Peri Fries": ("French Fries", "Peri Peri", "French Fries (120g) + Peri Peri Masala + Oil + Dish", "Peri Peri Fries (₹55)"),
}


def compute_breakdowns(outlets, items):
    """Compute outlet-wise sales by category and size bucket (Individual + Combo)."""
    # Structure: data[cat][outlet][bucket] = qty, plus data[cat][outlet]['Ind'] and ['Combo']
    cats = {
        "Beverages": ["Small", "Big", "Bigger", "Other"],
        "Coffee": ["Small", "Big", "Bigger", "Other"],
        "Chocolate": ["Small", "Big", "Bigger", "Other"],
        "Mango": ["Small", "Big", "Bigger", "Other"],
        "Burgers": ["Regular", "Cheezy", "Double Cheese", "Cheese Patty"],
        "Pizzas": ["Standard", "Deluxe", "Premium"],
        "Sandwiches": ["Regular", "Toasted"],
        "Garlic Bread": ["Plain", "Veg Cheese"],
        "French Fries": ["Salted", "Peri Peri", "Loaded"],
    }
    data = {
        cat: {o: {b: 0.0 for b in buckets} | {"Ind": 0.0, "Combo": 0.0} for o in outlets}
        for cat, buckets in cats.items()
    }

    for item_name, o_dict in items.items():
        if item_name in ITEM_CLASSIFICATION:
            cat, bucket, _, _ = ITEM_CLASSIFICATION[item_name]
            for o in outlets:
                q = o_dict[o]
                data[cat][o][bucket] += q
                data[cat][o]["Ind"] += q
                # Also populate Coffee / Chocolate / Mango sub-trackers
                if cat == "Beverages":
                    low = item_name.lower()
                    if "coffee" in low:
                        data["Coffee"][o][bucket] += q
                        data["Coffee"][o]["Ind"] += q
                    elif "choc" in low or "frappe" in low:
                        data["Chocolate"][o][bucket] += q
                        data["Chocolate"][o]["Ind"] += q
                    elif "mango" in low:
                        data["Mango"][o][bucket] += q
                        data["Mango"][o]["Ind"] += q
        elif item_name in COMBO_RULES:
            for o in outlets:
                cq = o_dict[o]
                if cq == 0:
                    continue
                for cat, bucket, mult in COMBO_RULES[item_name]:
                    data[cat][o][bucket] += cq * mult
                    data[cat][o]["Combo"] += cq * mult

    return data


def build_consolidated_workbook(outlets, items, item_order, purchase, data, old_wb):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    def write_category_sheet(sheet_name, title, subtitle, cat_key, size_cols, unit_label):
        ws = wb.create_sheet(sheet_name)
        ws["A1"] = title
        ws["A1"].font = TITLE_FONT
        ws["A2"] = subtitle
        ws["A2"].font = SUBTITLE_FONT

        # Section A: Individual Menu Items Breakdown (with Size / Variant & PDF Menu Ref)
        ws["A4"] = "A. INDIVIDUAL MENU ITEMS BREAKDOWN (BYTING KORNER MENU)"
        ws["A4"].font = SECTION_FONT
        hdr_a = ["Item Name", "Size / Variant (PDF Menu)", "Material & Ingredients", "PDF Menu Reference", "Individual Sales Qty"]
        for c, h in enumerate(hdr_a, 1):
            ws.cell(5, c, h)
        style_header_row(ws, 5, len(hdr_a))

        cat_items = [name for name in item_order if name in ITEM_CLASSIFICATION and ITEM_CLASSIFICATION[name][0] == cat_key]
        r = 6
        for name in cat_items:
            _, bucket, mat, pdf_ref = ITEM_CLASSIFICATION[name]
            ws.cell(r, 1, name).border = THIN_BORDER
            ws.cell(r, 2, bucket).border = THIN_BORDER
            ws.cell(r, 3, mat).border = THIN_BORDER
            ws.cell(r, 4, pdf_ref).border = THIN_BORDER
            c_qty = ws.cell(r, 5, items[name]["__total__"])
            c_qty.number_format = "#,##0"
            c_qty.border = THIN_BORDER
            r += 1

        ws.cell(r, 1, "Total Individual Menu Items")
        ws.cell(r, 5, f"=SUM(E6:E{r-1})").number_format = "#,##0"
        style_total_row(ws, r, len(hdr_a))

        # Section B: Outlet-Wise Size Breakdown + Sales vs Purchase + RMD %
        b_start_hdr = r + 2
        ws.cell(b_start_hdr, 1, f"B. OUTLET-WISE SIZE BREAKDOWN, SALES QTY, PURCHASE QTY & RMD % ({unit_label})").font = SECTION_FONT
        hdr_row = b_start_hdr + 1
        hdr_b = (
            ["Outlet Name"]
            + [f"{lbl} Qty" for _, lbl in size_cols]
            + ["Individual Sales Qty", "Combo Sales Qty", "Total Sales Qty", "Purchase Qty (Packs)", f"Purchase Qty ({unit_label})", "RMD % (Sales / Purchase)"]
        )
        for c, h in enumerate(hdr_b, 1):
            ws.cell(hdr_row, c, h)
        style_header_row(ws, hdr_row, len(hdr_b))

        n_sz = len(size_cols)
        col_ind = 2 + n_sz
        col_cmb = col_ind + 1
        col_tot = col_ind + 2
        col_ppk = col_ind + 3
        col_pun = col_ind + 4
        col_rmd = col_ind + 5

        row_idx = hdr_row + 1
        first_data_r = row_idx
        for o in outlets:
            ws.cell(row_idx, 1, o).border = THIN_BORDER
            for idx_s, (b_key, _) in enumerate(size_cols):
                c = ws.cell(row_idx, 2 + idx_s, data[cat_key][o][b_key])
                c.number_format = "#,##0"
                c.border = THIN_BORDER
            ws.cell(row_idx, col_ind, data[cat_key][o]["Ind"]).number_format = "#,##0"
            ws.cell(row_idx, col_ind).border = THIN_BORDER
            ws.cell(row_idx, col_cmb, data[cat_key][o]["Combo"]).number_format = "#,##0"
            ws.cell(row_idx, col_cmb).border = THIN_BORDER

            ind_l = get_column_letter(col_ind)
            cmb_l = get_column_letter(col_cmb)
            tot_l = get_column_letter(col_tot)
            pun_l = get_column_letter(col_pun)

            ws.cell(row_idx, col_tot, f"={ind_l}{row_idx}+{cmb_l}{row_idx}").number_format = "#,##0"
            ws.cell(row_idx, col_tot).border = THIN_BORDER

            packs, units = purchase[cat_key].get(o, (0, 0))
            ws.cell(row_idx, col_ppk, packs).number_format = "#,##0"
            ws.cell(row_idx, col_ppk).border = THIN_BORDER
            ws.cell(row_idx, col_pun, units).number_format = "#,##0"
            ws.cell(row_idx, col_pun).border = THIN_BORDER

            ws.cell(row_idx, col_rmd, f"=IF({pun_l}{row_idx}>0, {tot_l}{row_idx}/{pun_l}{row_idx}, 0)").number_format = "0.0%"
            ws.cell(row_idx, col_rmd).border = THIN_BORDER
            row_idx += 1

        last_data_r = row_idx - 1
        ws.cell(row_idx, 1, "Grand Total Across Outlets")
        for c in range(2, col_rmd):
            cl = get_column_letter(c)
            ws.cell(row_idx, c, f"=SUM({cl}{first_data_r}:{cl}{last_data_r})").number_format = "#,##0"
        tot_l = get_column_letter(col_tot)
        pun_l = get_column_letter(col_pun)
        ws.cell(row_idx, col_rmd, f"=IF({pun_l}{row_idx}>0, {tot_l}{row_idx}/{pun_l}{row_idx}, 0)").number_format = "0.0%"
        style_total_row(ws, row_idx, len(hdr_b))
        auto_fit(ws)
        return hdr_row + 1, last_data_r, row_idx, col_tot, col_pun

    write_category_sheet(
        "Beverages",
        "1. BEVERAGES SALES & PURCHASE ANALYSIS (SMALL / BIG / BIGGER)",
        "Aligned with Byting Korner PDF Menu: Small (Regular), Big, Bigger & Hot/Pouch/Water vs Purchase Qty & RMD %",
        "Beverages",
        [("Small", "Small (Regular)"), ("Big", "Big"), ("Bigger", "Bigger"), ("Other", "Other (Hot/Pouch/Water)")],
        "Pouches",
    )
    write_category_sheet(
        "Burgers",
        "2. BURGERS SALES & PURCHASE ANALYSIS (BY MENU VARIANT)",
        "Aligned with Byting Korner PDF Menu: Regular, Cheezy, Double Cheese & Cheese Patty vs Burger Bun Purchases & RMD %",
        "Burgers",
        [("Regular", "Regular"), ("Cheezy", "Cheezy"), ("Double Cheese", "Double Cheese"), ("Cheese Patty", "Cheese Patty")],
        "Buns",
    )
    write_category_sheet(
        "Pizzas",
        "3. PIZZAS SALES & PURCHASE ANALYSIS (BY MENU TIER)",
        "Aligned with Byting Korner PDF Menu (Brown Bread): Standard (₹50), Deluxe (₹80), Premium (₹99) vs Pizza Base Purchases & RMD %",
        "Pizzas",
        [("Standard", "Standard (₹50)"), ("Deluxe", "Deluxe (₹80)"), ("Premium", "Premium (₹99)")],
        "Bases",
    )
    write_category_sheet(
        "Sandwiches",
        "4. SANDWICHES SALES & PURCHASE ANALYSIS (REGULAR vs TOASTED)",
        "Aligned with Byting Korner PDF Menu: Regular vs Toasted vs Sandwich Bread Purchases & RMD %",
        "Sandwiches",
        [("Regular", "Regular"), ("Toasted", "Toasted")],
        "Loaves",
    )
    write_category_sheet(
        "Garlic Bread",
        "5. GARLIC BREAD SALES & PURCHASE ANALYSIS (PLAIN vs VEG CHEESE)",
        "Aligned with Byting Korner PDF Menu: Plain Garlic Bread vs Veg Cheese Garlic Bread vs Purchases & RMD %",
        "Garlic Bread",
        [("Plain", "Plain Garlic Bread"), ("Veg Cheese", "Veg Cheese Garlic Bread")],
        "Pieces",
    )
    write_category_sheet(
        "French Fries",
        "6. FRENCH FRIES SALES & PURCHASE ANALYSIS (SALTED / PERI PERI / LOADED)",
        "Aligned with Byting Korner PDF Menu: Salted, Peri Peri & Loaded Fries (2 Dips) vs Fries Purchases (kg) & RMD %",
        "French Fries",
        [("Salted", "Salted Fries"), ("Peri Peri", "Peri Peri Fries"), ("Loaded", "Loaded Fries (2 Dips)")],
        "kg",
    )

    # 7. Combos (copy from old_wb and keep quantity columns only)
    ws_c = wb.create_sheet("Combos")
    old_c = old_wb["Combos"]
    for r in range(1, old_c.max_row + 1):
        for c in range(1, old_c.max_column + 1):
            ws_c.cell(r, c, old_c.cell(r, c).value).border = THIN_BORDER if r >= 4 else None
    ws_c["A1"].font = TITLE_FONT
    ws_c["A2"].font = SUBTITLE_FONT
    style_header_row(ws_c, 4, old_c.max_column)
    style_total_row(ws_c, old_c.max_row, old_c.max_column)
    auto_fit(ws_c)

    # 8. Recipe Details (copy from old_wb)
    ws_rec = wb.create_sheet("Recipe Details")
    old_rec = old_wb["Recipe Details"]
    for r in range(1, old_rec.max_row + 1):
        for c in range(1, old_rec.max_column + 1):
            val = old_rec.cell(r, c).value
            if val is not None:
                ws_rec.cell(r, c, val)
    ws_rec["A1"].font = TITLE_FONT
    ws_rec["A2"].font = SUBTITLE_FONT
    style_header_row(ws_rec, 4, 8)
    style_total_row(ws_rec, 38, 8)
    style_header_row(ws_rec, 44, 4)
    auto_fit(ws_rec)

    # 9. Outlet Summary (Sales Qty, Purchase Qty & RMD % across categories)
    ws_os = wb.create_sheet("Outlet Summary")
    ws_os["A1"] = "9. OUTLET-WISE SUMMARY: SALES QTY, PURCHASE QTY & RMD %"
    ws_os["A1"].font = TITLE_FONT
    ws_os["A2"] = "Consolidated outlet-wise quantities and RMD % (Sales Qty / Purchase Qty) across all categories"
    ws_os["A2"].font = SUBTITLE_FONT
    hdr_os = [
        "Outlet Name",
        "Beverages Sales", "Beverages Purch (Pouches)", "Beverages RMD %",
        "Burgers Sales", "Burgers Purch (Buns)", "Burgers RMD %",
        "Pizzas Sales", "Pizzas Purch (Bases)", "Pizzas RMD %",
        "Sandwiches Sales", "Sandwiches Purch (Loaves)", "Sandwiches RMD %",
        "Garlic Bread Sales", "Garlic Bread Purch (Pcs)", "Garlic Bread RMD %",
        "Fries Sales", "Fries Purch (kg)", "Fries RMD %",
    ]
    for c, h in enumerate(hdr_os, 1):
        ws_os.cell(4, c, h)
    style_header_row(ws_os, 4, len(hdr_os))

    cat_order = ["Beverages", "Burgers", "Pizzas", "Sandwiches", "Garlic Bread", "French Fries"]
    for idx, o in enumerate(outlets, 5):
        ws_os.cell(idx, 1, o).border = THIN_BORDER
        for ci, ck in enumerate(cat_order):
            sc = 2 + ci * 3
            pc = sc + 1
            rc = sc + 2
            s_qty = data[ck][o]["Ind"] + data[ck][o]["Combo"]
            _, p_units = purchase[ck].get(o, (0, 0))
            ws_os.cell(idx, sc, s_qty).number_format = "#,##0"
            ws_os.cell(idx, sc).border = THIN_BORDER
            ws_os.cell(idx, pc, p_units).number_format = "#,##0"
            ws_os.cell(idx, pc).border = THIN_BORDER
            sl = get_column_letter(sc)
            pl = get_column_letter(pc)
            ws_os.cell(idx, rc, f"=IF({pl}{idx}>0, {sl}{idx}/{pl}{idx}, 0)").number_format = "0.0%"
            ws_os.cell(idx, rc).border = THIN_BORDER

    tot_os = 5 + len(outlets)
    ws_os.cell(tot_os, 1, "Grand Total Across All Outlets")
    for ci in range(len(cat_order)):
        sc = 2 + ci * 3
        pc = sc + 1
        rc = sc + 2
        sl = get_column_letter(sc)
        pl = get_column_letter(pc)
        ws_os.cell(tot_os, sc, f"=SUM({sl}5:{sl}{tot_os-1})").number_format = "#,##0"
        ws_os.cell(tot_os, pc, f"=SUM({pl}5:{pl}{tot_os-1})").number_format = "#,##0"
        ws_os.cell(tot_os, rc, f"=IF({pl}{tot_os}>0, {sl}{tot_os}/{pl}{tot_os}, 0)").number_format = "0.0%"
    style_total_row(ws_os, tot_os, len(hdr_os))
    auto_fit(ws_os)

    # 10. Grand Summary (copy from old_wb)
    ws_gs = wb.create_sheet("Grand Summary")
    old_gs = old_wb["Grand Summary"]
    for r in range(1, old_gs.max_row + 1):
        for c in range(1, old_gs.max_column + 1):
            ws_gs.cell(r, c, old_gs.cell(r, c).value)
    ws_gs["A1"].font = TITLE_FONT
    ws_gs["A2"].font = SUBTITLE_FONT
    style_header_row(ws_gs, 4, old_gs.max_column)
    style_total_row(ws_gs, old_gs.max_row, old_gs.max_column)
    auto_fit(ws_gs)

    out_path = "d:/SPpro/Consolidated_Sales_Purchase_Analysis_Report.xlsx"
    wb.save(out_path)
    return out_path


def build_other_beverages_workbook(outlets, items, purchase, data):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # Sheet 1: Other Beverages Summary (Non-Coffee with Small / Big / Bigger)
    ws = wb.create_sheet("Other Beverages Summary")
    ws["A1"] = "OTHER BEVERAGES (NON-COFFEE) – SMALL / BIG / BIGGER SALES, PURCHASE & RMD %"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "Aligned with Byting Korner PDF Menu: Chocolate, Mango, Pineapple & Water (Individual + Combo)"
    ws["A2"].font = SUBTITLE_FONT
    hdr = [
        "Beverage Group", "Small (Regular) Qty", "Big Qty", "Bigger Qty",
        "Other (Hot/Pouch/Water) Qty", "Total Sales Qty",
        "Purchase Raw Material", "Purchase Qty (Units)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(hdr, 1):
        ws.cell(4, c, h)
    style_header_row(ws, 4, len(hdr))

    # Aggregate Chocolate, Mango, Pineapple, Water
    groups = [
        ("Chocolate Beverages (Cold Choc / Hot Choc / Frappe)",
         sum(data["Chocolate"][o]["Small"] for o in outlets),
         sum(data["Chocolate"][o]["Big"] for o in outlets),
         sum(data["Chocolate"][o]["Bigger"] for o in outlets),
         sum(data["Chocolate"][o]["Other"] for o in outlets),
         "COLD CHOCOLATE (32/pac)",
         sum(purchase["Cold Chocolate"].get(o, (0, 0))[1] for o in outlets)),
        ("Mango Shakes (Mango 50 / 45 / Milkshake / Pouch)",
         sum(data["Mango"][o]["Small"] for o in outlets),
         sum(data["Mango"][o]["Big"] for o in outlets),
         sum(data["Mango"][o]["Bigger"] for o in outlets),
         sum(data["Mango"][o]["Other"] for o in outlets),
         "MANGO FLAVORED MILK",
         sum(purchase["Mango"].get(o, (0, 0))[1] for o in outlets)),
        ("Pineapple Shake (Pineapple 45)",
         0.0, 0.0, items.get("Pineapple 45", {}).get("__total__", 0.0), 0.0,
         "Not Tracked in Order-Report", 0.0),
        ("Packaged Water (Bottle / Water / WATER)",
         0.0, 0.0, 0.0,
         sum(items.get(k, {}).get("__total__", 0.0) for k in ("Bottle", "Water", "WATER")),
         "Not Tracked in Order-Report", 0.0),
    ]
    for idx, (gname, sm, bg, bgr, oth, pm, pu) in enumerate(groups, 5):
        ws.cell(idx, 1, gname).border = THIN_BORDER
        for c, v in enumerate([sm, bg, bgr, oth], 2):
            ws.cell(idx, c, v).number_format = "#,##0"
            ws.cell(idx, c).border = THIN_BORDER
        ws.cell(idx, 6, f"=SUM(B{idx}:E{idx})").number_format = "#,##0"
        ws.cell(idx, 6).border = THIN_BORDER
        ws.cell(idx, 7, pm).border = THIN_BORDER
        ws.cell(idx, 8, pu).number_format = "#,##0"
        ws.cell(idx, 8).border = THIN_BORDER
        ws.cell(idx, 9, f"=IF(H{idx}>0, F{idx}/H{idx}, 0)").number_format = "0.0%"
        ws.cell(idx, 9).border = THIN_BORDER

    tot_r = 5 + len(groups)
    ws.cell(tot_r, 1, "GRAND TOTAL (OTHER BEVERAGES)")
    for c in [2, 3, 4, 5, 6, 8]:
        cl = get_column_letter(c)
        ws.cell(tot_r, c, f"=SUM({cl}5:{cl}{tot_r-1})").number_format = "#,##0"
    ws.cell(tot_r, 7, "-")
    ws.cell(tot_r, 9, f"=IF(H{tot_r}>0, F{tot_r}/H{tot_r}, 0)").number_format = "0.0%"
    style_total_row(ws, tot_r, len(hdr))
    auto_fit(ws)

    # Sheet 2: Outlet-wise Chocolate Beverages (Small / Big / Bigger)
    def add_outlet_bev_sheet(sname, title, sub_key, purch_key, unit_lbl):
        w = wb.create_sheet(sname)
        w["A1"] = title
        w["A1"].font = TITLE_FONT
        w["A2"] = "Outlet-wise breakdown by Small (Regular), Big, Bigger & Other vs Purchase Qty & RMD %"
        w["A2"].font = SUBTITLE_FONT
        h = [
            "Outlet Name", "Small (Regular) Qty", "Big Qty", "Bigger Qty", "Other Qty",
            "Total Sales Qty", "Purchase Packs", f"Purchase ({unit_lbl})", "RMD % (Sales / Purchase)"
        ]
        for c, col_h in enumerate(h, 1):
            w.cell(4, c, col_h)
        style_header_row(w, 4, len(h))
        for idx, o in enumerate(outlets, 5):
            w.cell(idx, 1, o).border = THIN_BORDER
            for c, bk in enumerate(["Small", "Big", "Bigger", "Other"], 2):
                w.cell(idx, c, data[sub_key][o][bk]).number_format = "#,##0"
                w.cell(idx, c).border = THIN_BORDER
            w.cell(idx, 6, f"=SUM(B{idx}:E{idx})").number_format = "#,##0"
            w.cell(idx, 6).border = THIN_BORDER
            pk, un = purchase[purch_key].get(o, (0, 0))
            w.cell(idx, 7, pk).number_format = "#,##0"
            w.cell(idx, 7).border = THIN_BORDER
            w.cell(idx, 8, un).number_format = "#,##0"
            w.cell(idx, 8).border = THIN_BORDER
            w.cell(idx, 9, f"=IF(H{idx}>0, F{idx}/H{idx}, 0)").number_format = "0.0%"
            w.cell(idx, 9).border = THIN_BORDER
        tr = 5 + len(outlets)
        w.cell(tr, 1, "Grand Total Across Outlets")
        for c in range(2, 9):
            cl = get_column_letter(c)
            w.cell(tr, c, f"=SUM({cl}5:{cl}{tr-1})").number_format = "#,##0"
        w.cell(tr, 9, f"=IF(H{tr}>0, F{tr}/H{tr}, 0)").number_format = "0.0%"
        style_total_row(w, tr, len(h))
        auto_fit(w)

    add_outlet_bev_sheet("Chocolate Beverages", "CHOCOLATE BEVERAGES – SMALL / BIG / BIGGER & RMD %", "Chocolate", "Cold Chocolate", "Pouches")
    add_outlet_bev_sheet("Mango & Fruit Shakes", "MANGO & FRUIT SHAKES – SMALL / BIG / BIGGER & RMD %", "Mango", "Mango", "Packs")

    out_path = "d:/SPpro/Other_Beverages_Sales_Purchase_Analysis.xlsx"
    wb.save(out_path)
    return out_path


def build_individual_items_workbook(items, item_order, purchase, data, outlets):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # Sheet 1: Beverages (Coffee vs Other) with Small / Big / Bigger columns
    ws_b = wb.create_sheet("Beverages (Small-Big-Bigger)")
    ws_b["A1"] = "ALL BEVERAGES – SMALL / BIG / BIGGER SALES QTY, PURCHASE QTY & RMD %"
    ws_b["A1"].font = TITLE_FONT
    ws_b["A2"] = "Byting Korner PDF Menu Size Breakdown (Regular/Small, Big, Bigger & Other) across Coffee, Chocolate, Mango, Pineapple & Water"
    ws_b["A2"].font = SUBTITLE_FONT
    hdr_b = [
        "Beverage Group", "Small (Regular) Sales Qty", "Big Sales Qty", "Bigger Sales Qty",
        "Other (Hot/Pouch/Water) Qty", "Total Sales Qty",
        "Purchase Raw Material", "Purchase Qty (Packs)", "Purchase Qty (Units)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(hdr_b, 1):
        ws_b.cell(4, c, h)
    style_header_row(ws_b, 4, len(hdr_b))

    coffee_pk = sum(purchase["Beverages"].get(o, (0, 0))[0] for o in outlets)
    coffee_un = sum(purchase["Beverages"].get(o, (0, 0))[1] for o in outlets)
    choc_pk = sum(purchase["Cold Chocolate"].get(o, (0, 0))[0] for o in outlets)
    choc_un = sum(purchase["Cold Chocolate"].get(o, (0, 0))[1] for o in outlets)
    mango_pk = sum(purchase["Mango"].get(o, (0, 0))[0] for o in outlets)
    mango_un = sum(purchase["Mango"].get(o, (0, 0))[1] for o in outlets)

    bev_rows = [
        ("Coffee (Cold Coffee 25/30/35, Hot Coffee, Pouch, Combos)",
         sum(data["Coffee"][o]["Small"] for o in outlets),
         sum(data["Coffee"][o]["Big"] for o in outlets),
         sum(data["Coffee"][o]["Bigger"] for o in outlets),
         sum(data["Coffee"][o]["Other"] for o in outlets),
         "COFFEE POUCH (32/pac)", coffee_pk, coffee_un),
        ("Chocolate (Cold Chocolate, Hot Chocolate, Frappe, Combos)",
         sum(data["Chocolate"][o]["Small"] for o in outlets),
         sum(data["Chocolate"][o]["Big"] for o in outlets),
         sum(data["Chocolate"][o]["Bigger"] for o in outlets),
         sum(data["Chocolate"][o]["Other"] for o in outlets),
         "COLD CHOCOLATE (32/pac)", choc_pk, choc_un),
        ("Mango Shake (Mango 50/45, Milkshake, Pouch)",
         sum(data["Mango"][o]["Small"] for o in outlets),
         sum(data["Mango"][o]["Big"] for o in outlets),
         sum(data["Mango"][o]["Bigger"] for o in outlets),
         sum(data["Mango"][o]["Other"] for o in outlets),
         "MANGO FLAVORED MILK", mango_pk, mango_un),
        ("Pineapple Shake (Pineapple 45)",
         0.0, 0.0, items.get("Pineapple 45", {}).get("__total__", 0.0), 0.0,
         "Not Tracked", 0, 0),
        ("Water & Packaged (Bottle / Water)",
         0.0, 0.0, 0.0,
         sum(items.get(k, {}).get("__total__", 0.0) for k in ("Bottle", "Water", "WATER")),
         "Not Tracked", 0, 0),
    ]
    for idx, (grp, sm, bg, bgr, oth, pm, pk, un) in enumerate(bev_rows, 5):
        ws_b.cell(idx, 1, grp).border = THIN_BORDER
        for c, v in enumerate([sm, bg, bgr, oth], 2):
            ws_b.cell(idx, c, v).number_format = "#,##0"
            ws_b.cell(idx, c).border = THIN_BORDER
        ws_b.cell(idx, 6, f"=SUM(B{idx}:E{idx})").number_format = "#,##0"
        ws_b.cell(idx, 6).border = THIN_BORDER
        ws_b.cell(idx, 7, pm).border = THIN_BORDER
        ws_b.cell(idx, 8, pk).number_format = "#,##0"
        ws_b.cell(idx, 8).border = THIN_BORDER
        ws_b.cell(idx, 9, un).number_format = "#,##0"
        ws_b.cell(idx, 9).border = THIN_BORDER
        ws_b.cell(idx, 10, f"=IF(I{idx}>0, F{idx}/I{idx}, 0)").number_format = "0.0%"
        ws_b.cell(idx, 10).border = THIN_BORDER

    tot_b = 5 + len(bev_rows)
    ws_b.cell(tot_b, 1, "GRAND TOTAL ALL BEVERAGES")
    for c in [2, 3, 4, 5, 6, 8, 9]:
        cl = get_column_letter(c)
        ws_b.cell(tot_b, c, f"=SUM({cl}5:{cl}{tot_b-1})").number_format = "#,##0"
    ws_b.cell(tot_b, 7, "-")
    ws_b.cell(tot_b, 10, f"=IF(I{tot_b}>0, F{tot_b}/I{tot_b}, 0)").number_format = "0.0%"
    style_total_row(ws_b, tot_b, len(hdr_b))
    auto_fit(ws_b)

    # Sheet 2: All Individual Items Master (with Size Bucket, Material, Sales Qty, Purchase Qty & RMD %)
    ws_m = wb.create_sheet("All Items Master")
    ws_m["A1"] = "ALL INDIVIDUAL ITEMS – SIZE / VARIANT, MATERIAL, SALES QTY, PURCHASE QTY & RMD %"
    ws_m["A1"].font = TITLE_FONT
    ws_m["A2"] = "Complete inventory of all individual SKUs aligned with Byting Korner PDF Menu"
    ws_m["A2"].font = SUBTITLE_FONT
    hdr_m = [
        "Category", "Item Name", "Size / Variant (Small/Big/Bigger or Tier)",
        "Material & Ingredients", "PDF Menu Reference",
        "Individual Sales Qty", "Purchase Raw Material", "Purchase Qty (Units)", "RMD % (Sales / Purchase)"
    ]
    for c, h in enumerate(hdr_m, 1):
        ws_m.cell(4, c, h)
    style_header_row(ws_m, 4, len(hdr_m))

    cat_purch_totals = {
        "Beverages": ("COFFEE POUCH / BEVERAGE BASE", coffee_un),
        "Burgers": ("BURGER BUN", sum(purchase["Burgers"].get(o, (0, 0))[1] for o in outlets)),
        "Pizzas": ("PIZZA BASE", sum(purchase["Pizzas"].get(o, (0, 0))[1] for o in outlets)),
        "Sandwiches": ("SANDWICH BREAD", sum(purchase["Sandwiches"].get(o, (0, 0))[1] for o in outlets)),
        "Garlic Bread": ("GARLIC BREAD", sum(purchase["Garlic Bread"].get(o, (0, 0))[1] for o in outlets)),
        "French Fries": ("FRENCH FRIES (kg)", sum(purchase["French Fries"].get(o, (0, 0))[1] for o in outlets)),
    }

    r = 5
    for name in item_order:
        if name in COMBO_RULES:
            continue
        if name in ITEM_CLASSIFICATION:
            cat, bucket, mat, pdf_ref = ITEM_CLASSIFICATION[name]
            low = name.lower()
            if cat == "Beverages" and ("choc" in low or "frappe" in low):
                pm, pu = "COLD CHOCOLATE", choc_un
            elif cat == "Beverages" and "mango" in low:
                pm, pu = "MANGO FLAVORED MILK", mango_un
            elif cat == "Beverages" and ("water" in low or "bottle" in low or "pineapple" in low):
                pm, pu = "Not Tracked", 0
            else:
                pm, pu = cat_purch_totals.get(cat, ("Not Tracked", 0))
        else:
            cat, bucket, mat, pdf_ref = "Other Food / Add-ons", "Standard", "See Recipe / Packaging", "Add-on / Snack"
            pm, pu = "Not Tracked", 0

        sq = items[name]["__total__"]
        ws_m.cell(r, 1, cat).border = THIN_BORDER
        ws_m.cell(r, 2, name).border = THIN_BORDER
        ws_m.cell(r, 3, bucket).border = THIN_BORDER
        ws_m.cell(r, 4, mat).border = THIN_BORDER
        ws_m.cell(r, 5, pdf_ref).border = THIN_BORDER
        ws_m.cell(r, 6, sq).number_format = "#,##0"
        ws_m.cell(r, 6).border = THIN_BORDER
        ws_m.cell(r, 7, pm).border = THIN_BORDER
        ws_m.cell(r, 8, pu).number_format = "#,##0"
        ws_m.cell(r, 8).border = THIN_BORDER
        ws_m.cell(r, 9, f"=IF(H{r}>0, F{r}/H{r}, 0)").number_format = "0.0%"
        ws_m.cell(r, 9).border = THIN_BORDER
        r += 1

    ws_m.cell(r, 1, "GRAND TOTAL (ALL INDIVIDUAL ITEMS)")
    ws_m.cell(r, 6, f"=SUM(F5:F{r-1})").number_format = "#,##0"
    style_total_row(ws_m, r, len(hdr_m))
    ws_m.auto_filter.ref = f"A4:I{r-1}"
    auto_fit(ws_m)

    out_path = "d:/SPpro/Individual_Items_Size_And_Material_Report.xlsx"
    wb.save(out_path)
    return out_path


def main():
    outlets, items, item_order = load_csv_data()
    purchase, old_wb = load_purchase_by_outlet()
    data = compute_breakdowns(outlets, items)

    p1 = build_consolidated_workbook(outlets, items, item_order, purchase, data, old_wb)
    p2 = build_other_beverages_workbook(outlets, items, purchase, data)
    p3 = build_individual_items_workbook(items, item_order, purchase, data, outlets)

    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in (p1, p2, p3):
            zf.write(p, os.path.basename(p))

    os.makedirs(os.path.dirname(DOWNLOADS_ZIP_PATH), exist_ok=True)
    shutil.copy2(ZIP_PATH, DOWNLOADS_ZIP_PATH)
    print("Generated:", p1)
    print("Generated:", p2)
    print("Generated:", p3)
    print("Zipped to:", ZIP_PATH)
    print("Copied to Downloads:", DOWNLOADS_ZIP_PATH)


if __name__ == "__main__":
    main()
