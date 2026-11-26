import csv
import os
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

SALES_CSV_PATH = r"d:\SPpro\sample_data\Location Wise Item Sales Report 20-11-2026 16_42.csv"
CONSOLIDATED_EXCEL_PATH = r"d:\SPpro\Consolidated_Sales_Purchase_Analysis_Report.xlsx"

# Pack conversions from user specs and image
PACK_CONVERSIONS = {
    'PIZZA': {'unit_multiplier': 4, 'unit_name': 'bases', 'pack_desc': '4 bases/pac'},
    'SANDWICH BREAD': {'unit_multiplier': 4, 'unit_name': 'loaves', 'pack_desc': '4 loaves/pac'},
    'BURGER BUN': {'unit_multiplier': 6, 'unit_name': 'buns', 'pack_desc': '6 buns/pac'},
    'GARLIC BREAD': {'unit_multiplier': 15, 'unit_name': 'pieces', 'pack_desc': '15 pcs/pac'},
    'MOZZARELLA CHEESE': {'unit_multiplier': 2.0, 'unit_name': 'kg', 'pack_desc': '2 kg/pack'},
    'TIME PASS BITES': {'unit_multiplier': 0.1, 'unit_name': 'kg', 'pack_desc': '100 gms'},
    'VEG MOMOS': {'unit_multiplier': 100, 'unit_name': 'pieces', 'pack_desc': '100 pcs/pac'},
    'CORN BALL': {'unit_multiplier': 24, 'unit_name': 'pieces', 'pack_desc': '24 pcs/pac'},
    'JAIN TIKKI': {'unit_multiplier': 24, 'unit_name': 'pieces', 'pack_desc': '24 pcs/pac'},
    'TANDOORI MAYO': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'GLASS': {'unit_multiplier': 100, 'unit_name': 'pieces', 'pack_desc': '100 pcs/pac'},
    'COLD CHOCOLATE': {'unit_multiplier': 32, 'unit_name': 'pouches', 'pack_desc': '32 pouch/pac'},
    'VEG TIKKI': {'unit_multiplier': 240, 'unit_name': 'pieces', 'pack_desc': '240 pcs/pac'},
    '2 KG BURGER PAPER': {'unit_multiplier': 2.0, 'unit_name': 'kg', 'pack_desc': '2 kg/pac'},
    'PERI PERI MAYO': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'WHITE MAYO': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'TOM MAYO': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'TISSUE PAPER': {'unit_multiplier': 10, 'unit_name': 'packs', 'pack_desc': '10 pac/bunch'},
    'REGULER COFFEE CUP': {'unit_multiplier': 240, 'unit_name': 'pieces', 'pack_desc': '240 pcs/pac'},
    'COFFEE STRAW': {'unit_multiplier': 2, 'unit_name': 'packs', 'pack_desc': '2 pac/bunch'},
    'COFFEE POUCH': {'unit_multiplier': 32, 'unit_name': 'pouches', 'pack_desc': '32 pouch/pac'},
    'CHATPATA MAYO': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'FRENCH FRIES': {'unit_multiplier': 2.5, 'unit_name': 'kg', 'pack_desc': '2.5 kg/pack'},
    'BLACK CUP': {'unit_multiplier': 100, 'unit_name': 'pieces', 'pack_desc': '100 pcs/pac'},
    'SCHEZWAN CHATNI': {'unit_multiplier': 1.0, 'unit_name': 'kg', 'pack_desc': '1 kg/pack'},
    'DIP CONTAINER': {'unit_multiplier': 50, 'unit_name': 'pieces', 'pack_desc': '50 pcs/pac'},
    'NEW BURGER DISH FOR 30 RS BURGER': {'unit_multiplier': 500, 'unit_name': 'pieces', 'pack_desc': '500 pcs/pac'},
    'CHILLI FLAKES': {'unit_multiplier': 0.25, 'unit_name': 'kg', 'pack_desc': '250 gms'},
    'NEW PIZZA DISH': {'unit_multiplier': 500, 'unit_name': 'pieces', 'pack_desc': '500 pcs/pac'},
    'NEW PIZZA BOX': {'unit_multiplier': 300, 'unit_name': 'pieces', 'pack_desc': '300 pcs/pac'},
    'Cheesy patty': {'unit_multiplier': 20, 'unit_name': 'pieces', 'pack_desc': '20 pcs/pac'},
    'SABUDANA TIKKY': {'unit_multiplier': 4, 'unit_name': 'pieces', 'pack_desc': '4 pcs/pac'},
    'POS ROLL': {'unit_multiplier': 5, 'unit_name': 'rolls', 'pack_desc': '5 rolls/pac'},
}

# Combos and their component disaggregations
COMBO_DEFINITIONS = {
    '(CO) Cheesy Burger+Big Cold<br>\nCoffee 75': {
        'display_name': 'Cheesy Burger + Big Cold Coffee 75',
        'items': {'burger': 1, 'coffee': 1},
    },
    '(CO) Pizza Margherita+French<br>\nFries+Bigger Cold Chocolate': {
        'display_name': 'Pizza Margherita + French Fries + Bigger Cold Choc',
        'items': {'pizza': 1, 'french fries': 1, 'cold chocolate': 1},
    },
    '(CO) French Fries+Any 2 dip Of<br>\nchoice': {
        'display_name': 'French Fries + 2 Dips',
        'items': {'french fries': 1, 'dip': 2},
    },
    '(CO) Tangy Burger+French<br>\nFries+Big Cold Coffee': {
        'display_name': 'Tangy Burger + French Fries + Big Cold Coffee',
        'items': {'burger': 1, 'french fries': 1, 'coffee': 1},
    },
    '(CO) Cheesy Burger (1+1)  90': {
        'display_name': 'Cheesy Burger (1+1) 90',
        'items': {'burger': 2},
    },
    '(CO) Cheesy Burger+Mayo<br>\nSandwich+Big Coffee': {
        'display_name': 'Cheesy Burger + Mayo Sandwich + Big Coffee',
        'items': {'burger': 1, 'sandwich': 1, 'coffee': 1},
    },
    '(CO) Any Double Cheesy<br>\nBurger+Cheese Mayo<br>\nSandwich+Big Cold Coffee': {
        'display_name': 'Double Cheesy Burger + Cheese Mayo Sandwich + Big Cold Coffee',
        'items': {'burger': 1, 'sandwich': 1, 'coffee': 1},
    },
    '(CO) Cheesy Burger+French<br>\nFries 80': {
        'display_name': 'Cheesy Burger + French Fries 80',
        'items': {'burger': 1, 'french fries': 1},
    },
    '(CO) Any 2cheesy Burger+French<br>\nFries+Bigger Coffee': {
        'display_name': '2 Cheesy Burgers + French Fries + Bigger Coffee',
        'items': {'burger': 2, 'french fries': 1, 'coffee': 1},
    },
    '(CO) Flavoured<br>\nBurger+Margherita+Sandwich+French<br>\nFries+Big Cold Coffe': {
        'display_name': 'Flavoured Burger + Margherita + Sandwich + Fries + Big Coffee',
        'items': {'burger': 1, 'pizza': 1, 'sandwich': 1, 'french fries': 1, 'coffee': 1},
    },
    '(CO) Cheesy Burger+Mayo<br>\nSandwich+Big Cold Coffee 120': {
        'display_name': 'Cheesy Burger + Mayo Sandwich + Big Coffee 120',
        'items': {'burger': 1, 'sandwich': 1, 'coffee': 1},
    },
    '(CO) Cheesy Burger+Mayo<br>\nSandwich+Big Cold Coffee  130': {
        'display_name': 'Cheesy Burger + Mayo Sandwich + Big Coffee 130',
        'items': {'burger': 1, 'sandwich': 1, 'coffee': 1},
    },
    '(CO) Any Double Cheesy<br>\nBurger+Cheese Mayo<br>\nSandwich+Big Cold Chocolate': {
        'display_name': 'Double Cheesy Burger + Cheese Mayo Sandwich + Big Cold Choc',
        'items': {'burger': 1, 'sandwich': 1, 'cold chocolate': 1},
    },
    '(CO) Flavoured Cheesy<br>\nBurger+Mayo Sandwich+Big<br>\nCoffee': {
        'display_name': 'Flavoured Cheesy Burger + Mayo Sandwich + Big Coffee',
        'items': {'burger': 1, 'sandwich': 1, 'coffee': 1},
    },
    '(CO) Schezwan Pizza+Mayo<br>\nSandwich+2 Big Cold Coffee': {
        'display_name': 'Schezwan Pizza + Mayo Sandwich + 2 Big Cold Coffee',
        'items': {'pizza': 1, 'sandwich': 1, 'coffee': 2},
    },
    '(CO) Cheesy Burger+Big Cold<br>\nCoffee 85': {
        'display_name': 'Cheesy Burger + Big Cold Coffee 85',
        'items': {'burger': 1, 'coffee': 1},
    },
    '(CO) Cheesy Burger+French<br>\nFries 90': {
        'display_name': 'Cheesy Burger + French Fries 90',
        'items': {'burger': 1, 'french fries': 1},
    },
    '(CO) Cheesy Burger (1+1)  99': {
        'display_name': 'Cheesy Burger (1+1) 99',
        'items': {'burger': 2},
    },
    '(CO) Coffee + Cookie': {
        'display_name': 'Coffee + Cookie',
        'items': {'coffee': 1, 'cookie': 1},
    }
}


class ItemComboService:
    def __init__(self):
        self.sales_data = {}  # (item_name, outlet_name) -> {'qty': float, 'amt': float}
        self.outlet_purchases = {} # category -> {outlet_name -> {'packs': float, 'units': float}}
        self.outlets = []
        self.items_by_cat = {}
        self.item_to_cat = {}
        self.is_loaded = False

    def load_data(self):
        if self.is_loaded:
            return

        # 1. Load Sales CSV
        with open(SALES_CSV_PATH, 'r', encoding='utf-8', errors='ignore') as f:
            rows = list(csv.reader(f))

        outlet_row = rows[5]
        self.outlets = []
        for c in range(3, len(outlet_row), 2):
            o_name = outlet_row[c].strip()
            if o_name and o_name.lower() not in ('warehouse', 'total', ''):
                self.outlets.append((c, o_name))

        for r in range(7, len(rows)):
            row = rows[r]
            if len(row) <= 1:
                continue
            raw_item = row[1].strip()
            if not raw_item:
                continue
            for c, o_name in self.outlets:
                qty_str = row[c].replace(',', '').strip() if c < len(row) else '0'
                amt_str = row[c+1].replace(',', '').strip() if c+1 < len(row) else '0'
                try:
                    qty = float(qty_str) if qty_str else 0.0
                except:
                    qty = 0.0
                try:
                    amt = float(amt_str) if amt_str else 0.0
                except:
                    amt = 0.0
                self.sales_data[(raw_item, o_name)] = {'qty': qty, 'amt': amt}

        # 2. Load pre-calculated outlet purchases from Consolidated Excel
        if os.path.exists(CONSOLIDATED_EXCEL_PATH):
            wb = openpyxl.load_workbook(CONSOLIDATED_EXCEL_PATH, data_only=True)
            for cat in ['Beverages', 'Burgers', 'Pizzas', 'Sandwiches', 'Garlic Bread', 'French Fries']:
                if cat in wb.sheetnames:
                    ws = wb[cat]
                    p_map = {}
                    reading = False
                    for r in range(1, ws.max_row + 1):
                        c1 = ws.cell(r, 1).value
                        if c1 and 'B. OUTLET-WISE ANALYSIS' in str(c1):
                            reading = True
                            continue
                        if reading and c1 and c1 not in ('Outlet Name', 'Grand Total') and 'Total' not in str(c1):
                            try:
                                packs = float(ws.cell(r, 5).value or 0)
                                units = float(ws.cell(r, 6).value or 0)
                                p_map[str(c1).strip()] = {'packs': packs, 'units': units}
                            except:
                                pass
                    self.outlet_purchases[cat] = p_map

                    # Load items in category
                    cat_items = []
                    reading_items = False
                    for r in range(1, ws.max_row + 1):
                        c1 = ws.cell(r, 1).value
                        if c1 == 'A. INDIVIDUAL MENU ITEMS BREAKDOWN':
                            reading_items = True
                            continue
                        elif c1 and ('B. OUTLET-WISE ANALYSIS' in str(c1) or 'Total Individual Menu Items' in str(c1)):
                            reading_items = False
                            continue
                        if reading_items and c1 and c1 != 'Item Name':
                            clean_item = str(c1).replace('<br>\n', ' ')
                            cat_items.append(clean_item)
                            self.item_to_cat[clean_item] = cat
                            self.item_to_cat[str(c1)] = cat
                    self.items_by_cat[cat] = cat_items

        self.is_loaded = True

    def get_available_items(self):
        self.load_data()
        result = []
        for cat, items in self.items_by_cat.items():
            for item in items:
                # Calculate total sold
                tot_sold = sum(self.sales_data.get((item, o[1]), {'qty': 0})['qty'] for o in self.outlets)
                result.append({
                    'name': item,
                    'category': cat,
                    'total_sold': tot_sold
                })
        result.sort(key=lambda x: (x['category'], -x['total_sold']))
        return result

    def get_contributing_combos_for_item(self, target_item_name: str):
        self.load_data()
        clean_target = target_item_name.lower().strip()
        combos = []

        for combo_raw, c_info in COMBO_DEFINITIONS.items():
            mult = 0
            if 'coffee' in clean_target:
                if 'coffee' in c_info['items']:
                    mult = c_info['items']['coffee']
            elif 'chocolate' in clean_target:
                if 'cold chocolate' in c_info['items']:
                    mult = c_info['items']['cold chocolate']
            elif 'burger' in clean_target:
                if 'cheesy' in clean_target and 'cheesy' in c_info['display_name'].lower():
                    mult = c_info['items'].get('burger', 0)
                elif clean_target in ('veg burger', 'burger') or 'burger' in c_info['items']:
                    mult = c_info['items'].get('burger', 0)
            elif 'pizza' in clean_target:
                if 'margherita' in clean_target and 'margherita' in c_info['display_name'].lower():
                    mult = c_info['items'].get('pizza', 0)
                elif 'schezwan' in clean_target and 'schezwan' in c_info['display_name'].lower():
                    mult = c_info['items'].get('pizza', 0)
                else:
                    mult = c_info['items'].get('pizza', 0)
            elif 'sandwich' in clean_target:
                if 'mayo' in clean_target and 'mayo' in c_info['display_name'].lower():
                    mult = c_info['items'].get('sandwich', 0)
                elif 'cheese mayo' in clean_target and 'cheese mayo' in c_info['display_name'].lower():
                    mult = c_info['items'].get('sandwich', 0)
                else:
                    mult = c_info['items'].get('sandwich', 0)
            elif 'fries' in clean_target:
                mult = c_info['items'].get('french fries', 0)
            elif 'garlic' in clean_target:
                mult = c_info['items'].get('garlic_bread', 0)

            if mult > 0:
                packs_sold = sum(self.sales_data.get((combo_raw, o_name), {'qty': 0})['qty'] for _, o_name in self.outlets)
                combos.append({
                    'combo_raw': combo_raw,
                    'display_name': c_info['display_name'],
                    'units_per_pack': mult,
                    'total_packs_sold': packs_sold,
                    'total_units_consumed': packs_sold * mult
                })

        return combos

    def get_raw_material_mapping(self, item_name: str):
        clean = item_name.lower()
        if 'coffee' in clean:
            return 'COFFEE POUCH', PACK_CONVERSIONS.get('COFFEE POUCH'), 'Beverages'
        elif 'chocolate' in clean:
            return 'COLD CHOCOLATE', PACK_CONVERSIONS.get('COLD CHOCOLATE'), 'Beverages'
        elif 'burger' in clean:
            return 'BURGER BUN', PACK_CONVERSIONS.get('BURGER BUN'), 'Burgers'
        elif 'pizza' in clean:
            return 'PIZZA', PACK_CONVERSIONS.get('PIZZA'), 'Pizzas'
        elif 'sandwich' in clean:
            return 'SANDWICH BREAD', PACK_CONVERSIONS.get('SANDWICH BREAD'), 'Sandwiches'
        elif 'fries' in clean:
            return 'FRENCH FRIES', PACK_CONVERSIONS.get('FRENCH FRIES'), 'French Fries'
        elif 'garlic' in clean:
            return 'GARLIC BREAD', PACK_CONVERSIONS.get('GARLIC BREAD'), 'Garlic Bread'
        
        cat = self.item_to_cat.get(item_name, 'Other')
        return None, None, cat

    def analyze_item(self, item_name: str):
        self.load_data()
        contributing_combos = self.get_contributing_combos_for_item(item_name)
        raw_mat_name, pack_info, cat = self.get_raw_material_mapping(item_name)
        mult = pack_info['unit_multiplier'] if pack_info else 1

        p_dict = self.outlet_purchases.get(cat, {})

        outlet_rows = []
        tot_ind_qty = 0.0
        tot_co_qty = 0.0
        tot_tot_qty = 0.0
        tot_p_packs = 0.0
        tot_p_units = 0.0
        tot_amt = 0.0

        for _, o_name in self.outlets:
            ind_record = self.sales_data.get((item_name, o_name), {'qty': 0.0, 'amt': 0.0})
            ind_q = ind_record['qty']
            ind_amt = ind_record['amt']

            co_q = 0.0
            for cb in contributing_combos:
                c_sold = self.sales_data.get((cb['combo_raw'], o_name), {'qty': 0.0})['qty']
                co_q += c_sold * cb['units_per_pack']

            tot_q = ind_q + co_q

            # Purchase info
            p_entry = p_dict.get(o_name, {'packs': 0.0, 'units': 0.0})
            p_packs = p_entry['packs']
            p_units = p_entry['units']
            variance = tot_q - p_units

            tot_ind_qty += ind_q
            tot_co_qty += co_q
            tot_tot_qty += tot_q
            tot_p_packs += p_packs
            tot_p_units += p_units
            tot_amt += ind_amt

            outlet_rows.append({
                'outlet': o_name,
                'individual_sales_qty': ind_q,
                'combo_sales_qty': co_q,
                'total_sales_qty': tot_q,
                'purchase_packs': p_packs,
                'purchase_units': p_units,
                'variance': round(variance, 2),
                'sales_amount': ind_amt
            })

        from scripts.update_excel_with_costing import ITEM_COSTING_MAP
        raw_clean = item_name.replace('<br>\n', ' ').strip()
        cost_info = ITEM_COSTING_MAP.get(item_name) or ITEM_COSTING_MAP.get(raw_clean)
        if not cost_info:
            for k, v in ITEM_COSTING_MAP.items():
                if k.lower() in raw_clean.lower() or raw_clean.lower() in k.lower():
                    cost_info = v
                    break

        return {
            'item_name': item_name,
            'category': cat,
            'raw_material': raw_mat_name,
            'pack_desc': pack_info['pack_desc'] if pack_info else 'N/A',
            'multiplier': mult,
            'size': cost_info['size'] if cost_info else 'Standard',
            'material': cost_info['material'] if cost_info else 'Standard Formulation',
            'making_cost': cost_info['cost'] if cost_info else 0.0,
            'unit_profit': cost_info['profit'] if cost_info else 0.0,
            'margin': cost_info['margin'] if cost_info else '0.0%',
            'contributing_combos': contributing_combos,
            'totals': {
                'individual_sales_qty': tot_ind_qty,
                'combo_sales_qty': tot_co_qty,
                'total_sales_qty': tot_tot_qty,
                'purchase_packs': tot_p_packs,
                'purchase_units': tot_p_units,
                'variance': round(tot_tot_qty - tot_p_units, 2),
                'sales_amount': tot_amt
            },
            'outlets': outlet_rows
        }


    def generate_item_excel(self, item_name: str) -> bytes:
        analysis = self.analyze_item(item_name)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Item + Combos"
        ws.views.sheetView[0].showGridLines = True

        h_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        sub_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
        tot_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        font_h = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        font_b = Font(name="Calibri", size=10, bold=True)
        font_r = Font(name="Calibri", size=10)
        border = Border(
            left=Side(style='thin', color='D1D5DB'),
            right=Side(style='thin', color='D1D5DB'),
            top=Side(style='thin', color='D1D5DB'),
            bottom=Side(style='thin', color='D1D5DB')
        )

        # Title
        ws.merge_cells("A1:H1")
        t = ws["A1"]
        t.value = f"INDIVIDUAL ITEM & COMBO ANALYSIS: {item_name.upper()}"
        t.font = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
        t.alignment = Alignment(horizontal="left", vertical="center")

        ws["A2"] = f"Category: {analysis['category']} | Size / Variant: {analysis['size']} | Formulation: {analysis['material']}"
        ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="4B5563")

        ws["A3"] = f"Unit Making Cost: ₹{analysis['making_cost']:.2f} | Unit Profit: ₹{analysis['unit_profit']:.2f} | Profit Margin: {analysis['margin']} | Primary Raw Material: {analysis['raw_material'] or 'N/A'}"
        ws["A3"].font = Font(name="Calibri", size=10, bold=True, color="166534")

        # KPI Box
        ws["A5"] = "MENU ITEM"
        ws["B5"] = "INDIVIDUAL SALES"
        ws["C5"] = "COMBO SALES"
        ws["D5"] = "TOTAL CONSUMPTION"
        ws["E5"] = "PURCHASE (UNITS)"
        ws["F5"] = "VARIANCE (S - P)"
        ws["G5"] = "TOTAL REVENUE (₹)"
        for col in ["A", "B", "C", "D", "E", "F", "G"]:
            ws[f"{col}5"].fill = sub_fill
            ws[f"{col}5"].font = font_h
            ws[f"{col}5"].alignment = Alignment(horizontal="center")

        t_data = analysis['totals']
        ws["A6"] = item_name
        ws["B6"] = t_data['individual_sales_qty']
        ws["C6"] = t_data['combo_sales_qty']
        ws["D6"] = t_data['total_sales_qty']
        ws["E6"] = t_data['purchase_units']
        ws["F6"] = t_data['variance']
        ws["G6"] = t_data['sales_amount']
        for col in ["A", "B", "C", "D", "E", "F", "G"]:
            c = ws[f"{col}6"]
            c.font = font_b
            c.border = border
            if col in ["B", "C", "D", "E", "F"]:
                c.number_format = "#,##0"
            elif col == "G":
                c.number_format = "₹#,##0.00"

        # Combos
        start_r = 8
        ws.cell(start_r, 1, "1. CONTRIBUTING COMBOS CONTAINING THIS ITEM").font = Font(name="Calibri", size=12, bold=True, color="1E3A8A")
        start_r += 1

        c_headers = ["Combo Name", "Units Per Combo Pack", "Total Combo Packs Sold", "Total Item Units From Combo"]
        for ci, ch in enumerate(c_headers, start=1):
            cell = ws.cell(start_r, ci, ch)
            cell.fill = h_fill
            cell.font = font_h
            cell.alignment = Alignment(horizontal="center")
        start_r += 1

        if analysis['contributing_combos']:
            for cb in analysis['contributing_combos']:
                ws.cell(start_r, 1, cb['display_name']).font = font_r
                ws.cell(start_r, 2, cb['units_per_pack']).font = font_r
                ws.cell(start_r, 3, cb['total_packs_sold']).font = font_r
                ws.cell(start_r, 4, cb['total_units_consumed']).font = font_b
                for ci in range(1, 5):
                    c = ws.cell(start_r, ci)
                    c.border = border
                    if ci in [2, 3, 4]:
                        c.number_format = "#,##0"
                start_r += 1
        else:
            ws.cell(start_r, 1, "No combo packages directly mapped to this item").font = font_r
            start_r += 1

        start_r += 1
        # Outlet Table
        ws.cell(start_r, 1, "2. OUTLET-WISE SALES & PURCHASE BREAKDOWN").font = Font(name="Calibri", size=12, bold=True, color="1E3A8A")
        start_r += 1

        o_headers = [
            "Outlet Name", "Individual Sales Qty", "Combo Sales Qty",
            "Total Sales Qty", "Purchase Qty (Packs)", "Purchase Qty (Units)",
            "Variance (Sales - Purchase Units)", "Sales Amount (₹)"
        ]
        for ci, oh in enumerate(o_headers, start=1):
            cell = ws.cell(start_r, ci, oh)
            cell.fill = h_fill
            cell.font = font_h
            cell.alignment = Alignment(horizontal="center")
        start_r += 1

        table_start_r = start_r
        for row in analysis['outlets']:
            r_idx = start_r
            ws.cell(r_idx, 1, row['outlet']).font = font_r
            ws.cell(r_idx, 2, row['individual_sales_qty']).font = font_r
            ws.cell(r_idx, 3, row['combo_sales_qty']).font = font_r
            ws.cell(r_idx, 4, f"=B{r_idx}+C{r_idx}").font = font_b
            ws.cell(r_idx, 5, row['purchase_packs']).font = font_r
            ws.cell(r_idx, 6, row['purchase_units']).font = font_b
            ws.cell(r_idx, 7, f"=D{r_idx}-F{r_idx}").font = font_b
            ws.cell(r_idx, 8, row['sales_amount']).font = font_r

            for ci in range(1, 9):
                c = ws.cell(r_idx, ci)
                c.border = border
                if ci in [2, 3, 4, 5, 6, 7]:
                    c.number_format = "#,##0"
                elif ci == 8:
                    c.number_format = "₹#,##0.00"
            start_r += 1

        # Grand Total
        gt_r = start_r
        ws.cell(gt_r, 1, "Grand Total").font = font_h
        ws.cell(gt_r, 2, f"=SUM(B{table_start_r}:B{gt_r-1})").font = font_h
        ws.cell(gt_r, 3, f"=SUM(C{table_start_r}:C{gt_r-1})").font = font_h
        ws.cell(gt_r, 4, f"=SUM(D{table_start_r}:D{gt_r-1})").font = font_h
        ws.cell(gt_r, 5, f"=SUM(E{table_start_r}:E{gt_r-1})").font = font_h
        ws.cell(gt_r, 6, f"=SUM(F{table_start_r}:F{gt_r-1})").font = font_h
        ws.cell(gt_r, 7, f"=SUM(G{table_start_r}:G{gt_r-1})").font = font_h
        ws.cell(gt_r, 8, f"=SUM(H{table_start_r}:H{gt_r-1})").font = font_h
        for ci in range(1, 9):
            c = ws.cell(gt_r, ci)
            c.fill = tot_fill
            c.border = border
            if ci in [2, 3, 4, 5, 6, 7]:
                c.number_format = "#,##0"
            elif ci == 8:
                c.number_format = "₹#,##0.00"

        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        import io
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return out.getvalue()

item_service = ItemComboService()
