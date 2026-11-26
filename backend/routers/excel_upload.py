import io
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import openpyxl
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/api", tags=["Excel Upload"])


def _parse_date_from_text(text: str) -> Optional[str]:
    """Try to extract a date from filename or text like 'From-01-11-2026-to-07-11-2026'."""
    patterns = [
        r"(\d{2})[.\-/](\d{2})[.\-/](\d{4})",   # DD-MM-YYYY or DD/MM/YYYY
        r"(\d{4})[.\-/](\d{2})[.\-/](\d{2})",   # YYYY-MM-DD
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            groups = m.groups()
            try:
                if len(groups[0]) == 4:
                    return f"{groups[0]}-{groups[1]}-{groups[2]}"
                else:
                    return f"{groups[2]}-{groups[1]}-{groups[0]}"
            except Exception:
                pass
    return None


def _extract_numeric(value: Any) -> float:
    """Convert cell value to float, handling None, formulas, and formatted strings."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s or s.startswith("="):
        return 0.0
    try:
        return float(s.replace(",", "").replace("%", "").strip())
    except ValueError:
        return 0.0


def _find_header_row(ws) -> Optional[int]:
    """Locate the header row containing 'Outlet Name' (or 'Item') in the first 10 rows."""
    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
        for cell in row:
            if isinstance(cell, str):
                low = cell.strip().lower()
                if "outlet name" in low or low == "outlet" or "item name" in low:
                    return r_idx
    return None


def _parse_item_metadata(ws, sheet_name: str) -> Dict[str, str]:
    """Extract full item name, size/variant, and menu reference from rows 1-2."""
    title_raw = str(ws.cell(1, 1).value or "").strip()
    meta_raw = str(ws.cell(2, 1).value or "").strip()

    item_name = sheet_name
    if "–" in title_raw:
        item_name = title_raw.split("–", 1)[0].strip()
    elif "-" in title_raw and "outlet-wise" in title_raw.lower():
        item_name = re.split(r"\s+-\s+", title_raw, maxsplit=1)[0].strip()

    size = ""
    menu_ref = ""
    m_size = re.search(r"Variant/Size:\s*([^|]+)", meta_raw, re.IGNORECASE)
    if m_size:
        size = m_size.group(1).strip()
    m_menu = re.search(r"Menu:\s*(.+)$", meta_raw, re.IGNORECASE)
    if m_menu:
        menu_ref = m_menu.group(1).strip()

    return {"name": item_name, "size": size, "menu_ref": menu_ref}


def _map_columns(headers: List[str]) -> Dict[str, Any]:
    """Identify standard columns and dynamic size columns from a header row."""
    norm = [re.sub(r"\s+", " ", str(h or "").strip().lower()) for h in headers]

    def find_col(patterns: List[str]) -> int:
        for pat in patterns:
            for idx, h in enumerate(norm):
                if pat in h:
                    return idx
        return -1

    outlet_col = find_col(["outlet name", "outlet"])
    indiv_col = find_col(["individual sales total", "individual sales"])
    combo_col = find_col(["combo sales total", "combo sales"])
    total_col = find_col(["grand total sales", "total sales qty", "total sales"])
    packs_col = find_col(["purchase qty (packs)", "purchase packs"])
    units_col = find_col(["purchase qty (units)", "purchase units", "purchase qty"])
    rmd_col = find_col(["rmd %", "rmd%"])

    known_indices = {outlet_col, indiv_col, combo_col, total_col, packs_col, units_col, rmd_col}
    size_cols = [
        {"idx": idx, "label": str(headers[idx]).replace("\n", " ").strip()}
        for idx in range(len(headers))
        if idx not in known_indices and headers[idx] and str(headers[idx]).strip()
    ]

    return {
        "outlet": outlet_col,
        "indiv": indiv_col,
        "combo": combo_col,
        "total": total_col,
        "packs": packs_col,
        "units": units_col,
        "rmd": rmd_col,
        "size_cols": size_cols,
    }


def _is_total_row(label: str) -> bool:
    low = label.strip().lower()
    return not low or low.startswith("total") or low.startswith("grand total")


@router.post("/excel-upload")
async def upload_excel(
    file: UploadFile = File(...),
    period_label: str = Form(default=""),
    start_date: str = Form(default=""),
    end_date: str = Form(default=""),
) -> Dict[str, Any]:
    """Parse an uploaded category outlet report (.xlsx) and return per-outlet items,
    including individual sales, combo sales, purchase packs/units, and RMD %.
    """
    filename = file.filename or "Uploaded_Report.xlsx"
    if not filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xlsm Excel files are supported.")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {e}")

    category = filename.replace("_Outlet_Report.xlsx", "").replace(".xlsx", "").replace("_", " ").strip()

    outlets_map: Dict[str, Dict[str, Any]] = {}
    outlet_order: List[str] = []
    size_headers: List[str] = []

    def ensure_outlet(name: str) -> Dict[str, Any]:
        if name not in outlets_map:
            outlets_map[name] = {
                "outlet": name,
                "summary": {
                    "individual_sales": 0.0,
                    "combo_sales": 0.0,
                    "total_sales_qty": 0.0,
                    "purchase_packs": 0.0,
                    "purchase_units": 0.0,
                    "rmd_pct": 0.0,
                    "size_breakdown": {},
                },
                "items": [],
            }
            outlet_order.append(name)
        return outlets_map[name]

    # 1. Parse SUMMARY sheet if present
    if "SUMMARY" in wb.sheetnames:
        ws_sum = wb["SUMMARY"]
        h_row = _find_header_row(ws_sum)
        if h_row:
            headers = [ws_sum.cell(h_row, c).value for c in range(1, ws_sum.max_column + 1)]
            cols = _map_columns(headers)
            size_headers = [sc["label"] for sc in cols["size_cols"]]
            if cols["outlet"] != -1:
                for row in ws_sum.iter_rows(min_row=h_row + 1, values_only=True):
                    raw_name = row[cols["outlet"]] if cols["outlet"] < len(row) else None
                    if not raw_name:
                        continue
                    outlet_name = str(raw_name).strip()
                    if _is_total_row(outlet_name):
                        continue

                    entry = ensure_outlet(outlet_name)
                    indiv = _extract_numeric(row[cols["indiv"]]) if cols["indiv"] != -1 else 0.0
                    combo = _extract_numeric(row[cols["combo"]]) if cols["combo"] != -1 else 0.0
                    total_val = _extract_numeric(row[cols["total"]]) if cols["total"] != -1 else 0.0
                    sales_qty = total_val if total_val > 0 else (indiv + combo)
                    packs = _extract_numeric(row[cols["packs"]]) if cols["packs"] != -1 else 0.0
                    units = _extract_numeric(row[cols["units"]]) if cols["units"] != -1 else 0.0
                    rmd_pct = round((sales_qty / units) * 100, 2) if units > 0 else 0.0

                    size_bd = {
                        sc["label"]: _extract_numeric(row[sc["idx"]]) if sc["idx"] < len(row) else 0.0
                        for sc in cols["size_cols"]
                    }
                    entry["summary"] = {
                        "individual_sales": indiv,
                        "combo_sales": combo,
                        "total_sales_qty": sales_qty,
                        "purchase_packs": packs,
                        "purchase_units": units,
                        "rmd_pct": rmd_pct,
                        "size_breakdown": size_bd,
                    }

    # 2. Parse each item sheet
    for sheet_name in wb.sheetnames:
        if sheet_name.strip().upper() == "SUMMARY":
            continue
        ws = wb[sheet_name]
        h_row = _find_header_row(ws)
        if not h_row:
            continue

        headers = [ws.cell(h_row, c).value for c in range(1, ws.max_column + 1)]
        cols = _map_columns(headers)
        if cols["outlet"] == -1:
            continue

        if not size_headers and cols["size_cols"]:
            size_headers = [sc["label"] for sc in cols["size_cols"]]

        meta = _parse_item_metadata(ws, sheet_name)

        for row in ws.iter_rows(min_row=h_row + 1, values_only=True):
            raw_name = row[cols["outlet"]] if cols["outlet"] < len(row) else None
            if not raw_name:
                continue
            outlet_name = str(raw_name).strip()
            if _is_total_row(outlet_name):
                continue

            entry = ensure_outlet(outlet_name)
            indiv = _extract_numeric(row[cols["indiv"]]) if cols["indiv"] != -1 else 0.0
            combo = _extract_numeric(row[cols["combo"]]) if cols["combo"] != -1 else 0.0
            total_val = _extract_numeric(row[cols["total"]]) if cols["total"] != -1 else 0.0
            sales_qty = total_val if total_val > 0 else (indiv + combo)
            packs = _extract_numeric(row[cols["packs"]]) if cols["packs"] != -1 else 0.0
            units = _extract_numeric(row[cols["units"]]) if cols["units"] != -1 else 0.0
            rmd_pct = round((sales_qty / units) * 100, 2) if units > 0 else 0.0

            size_bd = {
                sc["label"]: _extract_numeric(row[sc["idx"]]) if sc["idx"] < len(row) else 0.0
                for sc in cols["size_cols"]
            }

            entry["items"].append({
                "name": meta["name"],
                "size": meta["size"],
                "menu_ref": meta["menu_ref"],
                "individual_sales": indiv,
                "combo_sales": combo,
                "sales_qty": sales_qty,
                "purchase_packs": packs,
                "purchase_units": units,
                "rmd_pct": rmd_pct,
                "size_breakdown": size_bd,
            })

    if not outlet_order:
        raise HTTPException(
            status_code=400,
            detail="No outlet rows found in the uploaded Excel file. Please upload a category report from Outlet_Item_Reports.zip.",
        )

    # Derive date info from filename if not supplied
    detected_start = start_date or _parse_date_from_text(filename) or ""
    detected_end = end_date or ""

    # Compute week label and month label from detected_start
    week_label = ""
    month_label = ""
    if detected_start:
        try:
            dt = datetime.strptime(detected_start, "%Y-%m-%d")
            week_num = dt.isocalendar()[1]
            week_label = f"Week {week_num} ({dt.strftime('%d %b %Y')})"
            month_label = dt.strftime("%B %Y")
        except Exception:
            pass

    return {
        "category": category,
        "filename": filename,
        "period_label": period_label or detected_start or filename,
        "start_date": detected_start,
        "end_date": detected_end,
        "week_label": week_label,
        "month_label": month_label,
        "size_headers": size_headers,
        "outlets": [outlets_map[name] for name in outlet_order],
    }
