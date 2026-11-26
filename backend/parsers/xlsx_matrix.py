import io
from typing import List, Dict, Any, Optional
import openpyxl
from backend.parsers.base import (
    ParsedRecord, ParsedReport, clean_num, extract_date_range_from_text
)


class XLSXMatrixParser:
    """
    Parser for Excel Order/Sales Matrix Reports like order-report-From-01-11-2026-to-07-11-2026.xlsx:
    - Multi-row headers (Row 1 dates, Row 2-3 outlets with codes, e.g. 'Adajan VAIBHAV LAXMI ENTERPRISE ADAJAN\\nOUT-012').
    - Items in rows, quantities in outlet columns.
    - Price and Total Qty columns towards the end.
    """

    @classmethod
    def can_parse(cls, ws: Any) -> bool:
        # Check first 5 rows for multi-row header with 'Item' and outlet codes
        for r in range(1, min(6, ws.max_row + 1)):
            v1 = str(ws.cell(r, 1).value or "").strip().lower()
            if "item" in v1 or "sales report" in v1 or "order report" in v1:
                return True
        return False

    @classmethod
    def parse(
        cls,
        file_or_path: Any,
        sheet_name: Optional[str] = None,
        report_type: str = "sales",
        filename: str = ""
    ) -> ParsedReport:
        if isinstance(file_or_path, (str, bytes)):
            if isinstance(file_or_path, str):
                wb = openpyxl.load_workbook(file_or_path, data_only=True)
            else:
                wb = openpyxl.load_workbook(io.BytesIO(file_or_path), data_only=True)
        else:
            wb = openpyxl.load_workbook(file_or_path, data_only=True)

        selected_sheet = sheet_name if sheet_name and sheet_name in wb.sheetnames else wb.sheetnames[0]
        # Prefer 'Sales Report' or 'Report' if available and sheet_name not specified
        if not sheet_name:
            for s in wb.sheetnames:
                if "report" in s.lower() or "sales" in s.lower() or "purchase" in s.lower():
                    selected_sheet = s
                    break

        ws = wb[selected_sheet]
        report = ParsedReport(
            report_type=report_type,
            parser_name="XLSX Multi-Header Matrix Parser",
            filename=filename,
            sheet_name=selected_sheet
        )

        max_r = ws.max_row
        max_c = ws.max_column

        if max_r < 3 or max_c < 2:
            report.warnings.append("Spreadsheet does not contain enough rows or columns.")
            return report

        # 1. Date Range Extraction
        start_date, end_date = None, None
        for r in range(1, min(5, max_r + 1)):
            for c in range(1, min(10, max_c + 1)):
                val = str(ws.cell(r, c).value or "")
                s_d, e_d = extract_date_range_from_text(val)
                if s_d and not start_date:
                    start_date = s_d
                    end_date = e_d
                    break
            if start_date:
                break

        if not start_date and filename:
            start_date, end_date = extract_date_range_from_text(filename)

        report.start_date = start_date
        report.end_date = end_date

        # 2. Identify Outlet Columns and Metadata Columns
        # Look for 'Item' column in row 2 or 3
        item_row = 2
        item_col = 1
        for r in range(1, min(6, max_r + 1)):
            for c in range(1, min(5, max_c + 1)):
                cell_val = str(ws.cell(r, c).value or "").strip().lower()
                if cell_val == "item" or "item name" in cell_val:
                    item_row = r
                    item_col = c
                    break

        # Check Price and Total Qty columns
        price_col = None
        total_qty_col = None

        for c in range(1, max_c + 1):
            for r in (item_row, item_row + 1):
                txt = str(ws.cell(r, c).value or "").strip().lower()
                if "price" in txt or "rate" in txt:
                    price_col = c
                elif "total qty" in txt or "total quantity" in txt or "total count" in txt:
                    total_qty_col = c

        # Outlet columns are columns after item_col up to price/total columns
        outlet_cols = []
        outlets_set = set()

        for c in range(item_col + 1, max_c + 1):
            if c in (price_col, total_qty_col):
                continue

            # Check row 3 (outlet name with code) or row 2
            v3 = ws.cell(item_row + 1, c).value
            v2 = ws.cell(item_row, c).value
            raw_name = str(v3 or v2 or "").strip()

            if not raw_name or raw_name.lower() in ("total", "grand total", "none"):
                continue

            outlet_cols.append({
                "col": c,
                "name": raw_name
            })
            outlets_set.add(raw_name)

        report.outlets_found = sorted(list(outlets_set))

        # 3. Data rows start after the outlet headers
        data_start_r = item_row + 2
        items_set = set()

        for r in range(data_start_r, max_r + 1):
            item_val = ws.cell(r, item_col).value
            if item_val is None:
                continue

            raw_item = str(item_val).strip()
            if not raw_item or raw_item.lower() in ("total", "grand total", "sum", "summary"):
                continue

            # Unit price for this row
            unit_price = clean_num(ws.cell(r, price_col).value) if price_col else None
            if unit_price == 0.0 and price_col:
                unit_price = None

            items_set.add(raw_item)

            for oc in outlet_cols:
                c_idx = oc["col"]
                outlet_name = oc["name"]
                qty = clean_num(ws.cell(r, c_idx).value)

                if qty == 0.0:
                    continue

                # Calculate amount
                amt = round(qty * unit_price, 2) if unit_price is not None else 0.0

                record = ParsedRecord(
                    outlet_raw=outlet_name,
                    item_raw=raw_item,
                    quantity=qty,
                    unit_price=unit_price,
                    amount=amt,
                    transaction_date=start_date,
                    source_row_idx=r,
                    raw_data={"item": raw_item, "qty": qty, "price": unit_price, "amount": amt}
                )
                report.records.append(record)
                report.total_quantity += qty
                report.total_amount += amt

        report.items_found = sorted(list(items_set))
        return report
