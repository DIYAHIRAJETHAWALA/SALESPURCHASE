import csv
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
import openpyxl
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from backend.parsers.manager import ParserManager

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


def _detect_report_type(filename: str) -> str:
    low = filename.lower()
    if any(k in low for k in ("order", "purchase", "indent", "material", "po_")):
        return "purchase"
    return "sales"


def _extract_generic_sheets(contents: bytes, filename: str) -> List[Dict[str, Any]]:
    """Fallback parser: extract every sheet or CSV as a generic table."""
    sheets_out: List[Dict[str, Any]] = []
    if filename.lower().endswith(".csv"):
        text = contents.decode("utf-8-sig", errors="replace")
        all_rows = [r for r in csv.reader(io.StringIO(text)) if any(str(c).strip() for c in r)]
        if all_rows:
            # Find first row with >= 2 non-empty cells as header
            hdr_idx = 0
            for idx, r in enumerate(all_rows[:15]):
                if sum(1 for c in r if str(c).strip()) >= 2:
                    hdr_idx = idx
                    break
            headers = [str(c).strip() or f"Col {i+1}" for i, c in enumerate(all_rows[hdr_idx])]
            data_rows = []
            for r in all_rows[hdr_idx + 1:]:
                padded = [str(r[i]).strip() if i < len(r) and r[i] is not None else "" for i in range(len(headers))]
                if any(padded):
                    data_rows.append(padded)
            sheets_out.append({"sheet_name": "CSV Data", "headers": headers, "rows": data_rows})
        return sheets_out

    wb = ParserManager._load_excel_workbook(contents, filename)
    for sname in wb.sheetnames:
        ws = wb[sname]
        all_rows = []
        for row in ws.iter_rows(values_only=True):
            if any(c is not None and str(c).strip() != "" for c in row):
                all_rows.append(list(row))
        if not all_rows:
            continue
        hdr_idx = 0
        for idx, r in enumerate(all_rows[:15]):
            if sum(1 for c in r if c is not None and str(c).strip() != "") >= 2:
                hdr_idx = idx
                break
        raw_hdr = all_rows[hdr_idx]
        # Trim trailing empty columns
        last_non_empty = len(raw_hdr) - 1
        while last_non_empty >= 0 and (raw_hdr[last_non_empty] is None or str(raw_hdr[last_non_empty]).strip() == ""):
            last_non_empty -= 1
        col_count = max(last_non_empty + 1, 1)
        headers = [
            str(raw_hdr[i]).replace("\n", " ").strip() if i < len(raw_hdr) and raw_hdr[i] is not None else f"Col {i+1}"
            for i in range(col_count)
        ]
        data_rows = []
        for r in all_rows[hdr_idx + 1:]:
            padded = [
                "" if (i >= len(r) or r[i] is None or str(r[i]).startswith("=")) else str(r[i]).strip()
                for i in range(col_count)
            ]
            if any(padded):
                data_rows.append(padded)
        sheets_out.append({"sheet_name": sname, "headers": headers, "rows": data_rows})
    return sheets_out


@router.post("/excel-upload")
async def upload_excel(
    file: UploadFile = File(...),
    period_label: str = Form(default=""),
    start_date: str = Form(default=""),
    end_date: str = Form(default=""),
) -> Dict[str, Any]:
    """Parse ANY uploaded Excel/CSV report (.xlsx, .xlsm, .xls, .csv):
    1. Category Outlet Reports (SUMMARY + per-item sheets)
    2. Any Sales/Purchase Matrix or Flat Tabular report via ParserManager
    3. Any unknown spreadsheet as a universal searchable table
    """
    filename = file.filename or "Uploaded_Report.xlsx"
    low_name = filename.lower()
    if not low_name.endswith((".xlsx", ".xlsm", ".xls", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Supported formats: .xlsx, .xlsm, .xls, .csv",
        )

    contents = await file.read()
    category = (
        filename.replace("_Outlet_Report.xlsx", "")
        .replace(".xlsx", "")
        .replace(".xlsm", "")
        .replace(".xls", "")
        .replace(".csv", "")
        .replace("_", " ")
        .strip()
    )

    outlets_map: Dict[str, Dict[str, Any]] = {}
    outlet_order: List[str] = []
    size_headers: List[str] = []
    mode = "category_report"

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

    # --- Path 1: Category Outlet Report (.xlsx/.xlsm with Outlet Name rows) ---
    if low_name.endswith((".xlsx", ".xlsm")):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {e}")

        if "SUMMARY" in wb.sheetnames:
            ws_sum = wb["SUMMARY"]
            h_row = _find_header_row(ws_sum)
            if h_row:
                headers = [ws_sum.cell(h_row, c).value for c in range(1, ws_sum.max_column + 1)]
                cols = _map_columns(headers)
                if cols["outlet"] != -1 and (cols["indiv"] != -1 or cols["total"] != -1 or cols["units"] != -1):
                    size_headers = [sc["label"] for sc in cols["size_cols"]]
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

        if outlet_order:
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

    # --- Path 2: Universal POS / Purchase / Sales Matrix or Flat Tabular via ParserManager ---
    detected_start = start_date
    detected_end = end_date
    detected_report_type = _detect_report_type(filename)

    if not outlet_order:
        try:
            parsed = ParserManager.parse(
                contents,
                filename=filename,
                report_type=detected_report_type,
            )
            if parsed.records:
                mode = f"parsed_{detected_report_type}"
                if not detected_start and parsed.start_date:
                    detected_start = parsed.start_date
                if not detected_end and parsed.end_date:
                    detected_end = parsed.end_date

                # Group records by outlet -> item
                grouped: Dict[str, Dict[str, Dict[str, Any]]] = {}
                for rec in parsed.records:
                    o_name = str(rec.outlet_raw or "Unknown Outlet").strip()
                    i_name = str(rec.item_raw or "Unknown Item").strip()
                    if o_name not in grouped:
                        grouped[o_name] = {}
                    if i_name not in grouped[o_name]:
                        grouped[o_name][i_name] = {
                            "name": i_name,
                            "size": "",
                            "menu_ref": f"₹{rec.unit_price:g}" if rec.unit_price else "",
                            "individual_sales": 0.0,
                            "combo_sales": 0.0,
                            "sales_qty": 0.0,
                            "purchase_packs": 0.0,
                            "purchase_units": 0.0,
                            "rmd_pct": 0.0,
                            "size_breakdown": {},
                        }
                    item_entry = grouped[o_name][i_name]
                    qty = float(rec.quantity or 0.0)
                    if detected_report_type == "purchase":
                        item_entry["purchase_packs"] += qty
                        item_entry["purchase_units"] += qty
                    else:
                        item_entry["individual_sales"] += qty
                        item_entry["sales_qty"] += qty

                for o_name, items_dict in grouped.items():
                    entry = ensure_outlet(o_name)
                    items_list = list(items_dict.values())
                    entry["items"] = items_list
                    tot_indiv = sum(it["individual_sales"] for it in items_list)
                    tot_sales = sum(it["sales_qty"] for it in items_list)
                    tot_packs = sum(it["purchase_packs"] for it in items_list)
                    tot_units = sum(it["purchase_units"] for it in items_list)
                    entry["summary"] = {
                        "individual_sales": tot_indiv,
                        "combo_sales": 0.0,
                        "total_sales_qty": tot_sales,
                        "purchase_packs": tot_packs,
                        "purchase_units": tot_units,
                        "rmd_pct": round((tot_sales / tot_units) * 100, 2) if tot_units > 0 else 0.0,
                        "size_breakdown": {},
                    }
        except Exception:
            pass

    # --- Path 3: Generic Raw Table Fallback for ANY unknown spreadsheet ---
    raw_sheets: List[Dict[str, Any]] = []
    if not outlet_order:
        mode = "generic_table"
        try:
            raw_sheets = _extract_generic_sheets(contents, filename)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
        if not raw_sheets:
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")

    if not detected_start:
        detected_start = _parse_date_from_text(filename) or ""

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
        "mode": mode,
        "report_type": detected_report_type,
        "category": category,
        "filename": filename,
        "period_label": period_label or detected_start or filename,
        "start_date": detected_start,
        "end_date": detected_end,
        "week_label": week_label,
        "month_label": month_label,
        "size_headers": size_headers,
        "outlets": [outlets_map[name] for name in outlet_order],
        "raw_sheets": raw_sheets,
    }
