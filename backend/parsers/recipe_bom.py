import csv
import io
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple
from backend.parsers.manager import ParserManager

RECIPE_BOM_STORE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploaded_recipe_bom.json",
)

SUMMARY_LABELS = {
    "MAKING",
    "SALE",
    "PROFIT",
    "R.M %",
    "RM %",
    "R.M%",
    "MARGIN %",
    "MARGIN%",
}

SKIP_BLOCK_HEADERS = {
    "HIGH MARGIN PRODUCT",
    "LOW MARGIN PRODUCT",
}


def _to_float(val: Any) -> Optional[float]:
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("%", "").replace("₹", "")
    if not s or s.startswith("="):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _clean_text(val: Any) -> str:
    if val is None:
        return ""
    return re.sub(r"\s+", " ", str(val).strip())


def _infer_category(name: str, ingredients: List[Dict[str, Any]], is_combo: bool) -> str:
    if is_combo:
        return "Combos"
    up = name.upper()
    ing_names = " ".join(i["name"].upper() for i in ingredients)
    if "COFFEE" in up or "CHOCOLATE" in up or "CHOC" in up or "POUCH" in ing_names or "STREW" in ing_names:
        return "Beverages"
    if "PIZZA" in up or "MOZZARELLA" in ing_names:
        return "Pizzas"
    if "SANDWICH" in up or "BRED BUTTER" in up or "BREAD BUTTER" in up or "BUTTER" in ing_names:
        return "Sandwiches"
    if "FRIES" in up or "FRIES" in ing_names:
        return "French Fries"
    if "GARLIC" in up:
        return "Garlic Bread"
    return "Burgers"


def _infer_size(name: str, category: str, sale_price: float) -> str:
    up = name.upper()
    if category == "Beverages":
        if "25" in up or "29" in up:
            return "Small / Regular (250ml)"
        if "30" in up:
            return "Medium (300ml)"
        if "35" in up or "45" in up:
            return "Large (350ml)"
    m = re.search(r"\b(\d{2,3})\b", up)
    if m:
        price_tag = m.group(1)
        if "CHEEZ" in up or "CHEESE" in up:
            return f"Cheesy {price_tag}"
        return f"Standard {price_tag}"
    if sale_price > 0:
        return f"₹{int(sale_price) if sale_price.is_integer() else sale_price}"
    return "Standard"


def _infer_cheese(name: str, category: str, ingredients: List[Dict[str, Any]]) -> str:
    up = name.upper()
    ing_names = [i["name"].upper() for i in ingredients]
    has_mozz = any("MOZZARELLA" in n for n in ing_names)
    has_cheese = any("CHEEZ" in n or "CHEESE" in n for n in ing_names)
    cheese_cost = sum(i["cost"] for i in ingredients if "CHEEZ" in i["name"].upper() or "CHEESE" in i["name"].upper())

    if category == "Beverages":
        return "No Cheese"
    if has_mozz and "CORN" in up:
        return "With Mozzarella + Corn"
    if has_mozz and ("TANDORI" in up or "TANDOORI" in up):
        return "With Mozzarella + Paneer"
    if has_mozz:
        return "With Mozzarella"
    if has_cheese and cheese_cost > 0:
        return "With Cheese"
    if "DIP" in up:
        return "Dips Included"
    return "Without Cheese"


def _classify_margin(margin_pct: float) -> str:
    if margin_pct >= 48.0:
        return "High Margin"
    if margin_pct <= 35.0:
        return "Low Margin"
    return "Medium Margin"


class RecipeBOMParser:
    """Parses multi-block recipe costing / BOM Excel and CSV grids."""

    @classmethod
    def _load_grids(cls, file_bytes: bytes, filename: str) -> List[List[List[Any]]]:
        low = filename.lower()
        grids: List[List[List[Any]]] = []
        if low.endswith((".xlsx", ".xlsm", ".xls")):
            wb = ParserManager._load_excel_workbook(file_bytes, filename)
            for ws in wb.worksheets:
                grid: List[List[Any]] = []
                for r in range(1, ws.max_row + 1):
                    grid.append([ws.cell(r, c).value for c in range(1, ws.max_column + 1)])
                grids.append(grid)
        else:
            text = file_bytes.decode("utf-8-sig", errors="replace")
            reader = csv.reader(io.StringIO(text))
            grids.append([list(row) for row in reader])
        return grids

    @classmethod
    def can_parse_bytes(cls, file_bytes: bytes, filename: str) -> bool:
        try:
            grids = cls._load_grids(file_bytes, filename)
        except Exception:
            return False
        for grid in grids:
            making_hits = 0
            sale_hits = 0
            margin_hits = 0
            for row in grid:
                for c_idx in range(len(row) - 1):
                    label = _clean_text(row[c_idx]).upper()
                    val = _to_float(row[c_idx + 1])
                    if val is None:
                        continue
                    if label == "MAKING":
                        making_hits += 1
                    elif label == "SALE":
                        sale_hits += 1
                    elif label in ("MARGIN %", "MARGIN%"):
                        margin_hits += 1
            if making_hits >= 2 and sale_hits >= 2 and margin_hits >= 2:
                return True
        return False

    @classmethod
    def parse_bytes(cls, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        grids = cls._load_grids(file_bytes, filename)
        recipes: List[Dict[str, Any]] = []
        seen_keys = set()

        for grid in grids:
            max_rows = len(grid)
            max_cols = max((len(r) for r in grid), default=0)

            def cell(r: int, c: int) -> Any:
                if 0 <= r < max_rows and 0 <= c < len(grid[r]):
                    return grid[r][c]
                return None

            for c in range(max_cols - 1):
                r = 0
                in_combo_col = False
                while r < max_rows:
                    label = _clean_text(cell(r, c))
                    val_next = _to_float(cell(r, c + 1))

                    if not label:
                        in_combo_col = False
                        r += 1
                        continue

                    up = label.upper()
                    if up in SKIP_BLOCK_HEADERS:
                        r += 1
                        continue

                    if up == "COMBO":
                        in_combo_col = True
                        r += 1
                        continue

                    if up == "EXTRA":
                        # Parse standalone extra items until blank row
                        er = r + 1
                        while er < max_rows:
                            elabel = _clean_text(cell(er, c))
                            eval_num = _to_float(cell(er, c + 1))
                            if not elabel:
                                break
                            if eval_num is not None:
                                key = ("Extras", elabel.upper())
                                if key not in seen_keys:
                                    seen_keys.add(key)
                                    recipes.append({
                                        "name": elabel,
                                        "category": "Extras",
                                        "size": "Standard",
                                        "cheese": "N/A",
                                        "ingredients": [{"name": elabel, "cost": round(eval_num, 2)}],
                                        "making_cost": round(eval_num, 2),
                                        "sale_price": 0.0,
                                        "profit": 0.0,
                                        "rm_pct": 0.0,
                                        "margin_pct": 0.0,
                                        "classification": "Standard",
                                        "is_combo": False,
                                    })
                            er += 1
                        r = er + 1
                        continue

                    # A card header has text in col c and NO numeric value in col c+1
                    if val_next is None and up not in SUMMARY_LABELS:
                        # Look ahead to see if this header is followed by ingredient (label, float) rows and MAKING/SALE
                        ingredients: List[Dict[str, Any]] = []
                        making_cost: Optional[float] = None
                        sale_price: Optional[float] = None
                        profit: Optional[float] = None
                        rm_pct: Optional[float] = None
                        margin_pct: Optional[float] = None

                        sr = r + 1
                        found_summary = False
                        while sr < max_rows:
                            slabel = _clean_text(cell(sr, c))
                            sval = _to_float(cell(sr, c + 1))
                            if not slabel:
                                break
                            sup = slabel.upper()
                            # If we hit a new header (no numeric value in c+1) after already reading ingredients/summary, stop
                            if sval is None and sup not in SUMMARY_LABELS:
                                break
                            if sup == "MAKING" and sval is not None:
                                making_cost = sval
                                found_summary = True
                            elif sup == "SALE" and sval is not None:
                                sale_price = sval
                                found_summary = True
                            elif sup == "PROFIT" and sval is not None:
                                profit = sval
                                found_summary = True
                            elif sup in ("R.M %", "RM %", "R.M%") and sval is not None:
                                rm_pct = sval
                                found_summary = True
                            elif sup in ("MARGIN %", "MARGIN%") and sval is not None:
                                margin_pct = sval
                                found_summary = True
                            elif sval is not None and not found_summary:
                                ingredients.append({
                                    "name": slabel,
                                    "cost": round(sval, 2),
                                })
                            sr += 1

                        if found_summary and (making_cost is not None or sale_price is not None):
                            m_cost = round(making_cost if making_cost is not None else sum(i["cost"] for i in ingredients), 2)
                            s_price = round(sale_price if sale_price is not None else 0.0, 2)
                            p_val = round(profit if profit is not None else (s_price - m_cost), 2)
                            rm_val = round(rm_pct if rm_pct is not None else ((m_cost / s_price * 100) if s_price > 0 else 0.0), 2)
                            marg_val = round(margin_pct if margin_pct is not None else ((p_val / s_price * 100) if s_price > 0 else 0.0), 2)

                            cat = _infer_category(label, ingredients, in_combo_col)
                            key = (cat, label.upper())
                            if key not in seen_keys:
                                seen_keys.add(key)
                                recipes.append({
                                    "name": label,
                                    "category": cat,
                                    "size": _infer_size(label, cat, s_price),
                                    "cheese": _infer_cheese(label, cat, ingredients),
                                    "ingredients": ingredients,
                                    "making_cost": m_cost,
                                    "sale_price": s_price,
                                    "profit": p_val,
                                    "rm_pct": rm_val,
                                    "margin_pct": marg_val,
                                    "classification": _classify_margin(marg_val),
                                    "is_combo": in_combo_col,
                                })
                            r = sr
                            continue

                    r += 1

        return recipes

    @classmethod
    def save_bom(cls, recipes: List[Dict[str, Any]], filename: str = "") -> None:
        os.makedirs(os.path.dirname(RECIPE_BOM_STORE_PATH), exist_ok=True)
        with open(RECIPE_BOM_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump({"filename": filename, "recipes": recipes}, f, indent=2)

    @classmethod
    def load_bom(cls) -> Dict[str, Any]:
        if os.path.exists(RECIPE_BOM_STORE_PATH):
            try:
                with open(RECIPE_BOM_STORE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and isinstance(data.get("recipes"), list):
                        return data
            except Exception:
                pass
        return {"filename": "", "recipes": []}
