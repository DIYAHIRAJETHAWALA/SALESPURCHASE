import csv
import io
from typing import List, Dict, Any, Optional
from backend.parsers.base import (
    ParsedRecord, ParsedReport, clean_num, extract_date_range_from_text
)


class CSVLocationMatrixParser:
    """
    Parser for Location-Wise Item Sales/Purchase CSV reports where:
    - Metadata rows exist at the top (e.g. Report Name, Date Range).
    - Outlets are in columns (typically spanning 2 sub-columns: Count & Amount).
    - Items are listed in rows.
    """

    @classmethod
    def can_parse(cls, sample_rows: List[List[str]]) -> bool:
        if not sample_rows:
            return False
        # Look for 'Location Wise' or 'Report Start Date' or paired 'Count' & 'Amount'
        for r in sample_rows[:10]:
            joined = " ".join([str(c) for c in r if c]).lower()
            if "location wise" in joined or "report start date" in joined:
                return True
            if "sr no" in joined and "item name" in joined:
                return True
        return False

    @classmethod
    def parse(cls, content_or_path: Any, report_type: str = "sales", filename: str = "") -> ParsedReport:
        rows = []
        if isinstance(content_or_path, str):
            with open(content_or_path, mode="r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f)
                rows = [r for r in reader]
        elif isinstance(content_or_path, bytes):
            text = content_or_path.decode("utf-8-sig", errors="replace")
            reader = csv.reader(io.StringIO(text))
            rows = [r for r in reader]
        else:
            reader = csv.reader(content_or_path)
            rows = [r for r in reader]

        report = ParsedReport(
            report_type=report_type,
            parser_name="CSV Location-Wise Matrix Parser",
            filename=filename
        )

        if not rows:
            report.warnings.append("CSV file is completely empty.")
            return report

        # 1. Extract metadata and date range from top rows
        start_date, end_date = None, None
        for i, row in enumerate(rows[:10]):
            joined = " ".join([c for c in row if c])
            s_d, e_d = extract_date_range_from_text(joined)
            if s_d and not start_date:
                start_date = s_d
                end_date = e_d

        if not start_date and filename:
            start_date, end_date = extract_date_range_from_text(filename)

        report.start_date = start_date
        report.end_date = end_date

        # 2. Find header row with 'Item Name' or 'SR No.'
        header_row_idx = None
        for i, row in enumerate(rows[:15]):
            normalized_row = [str(c).strip().lower() for c in row if c]
            if any("item name" in c or "item" == c for c in normalized_row):
                header_row_idx = i
                break

        if header_row_idx is None:
            report.warnings.append("Could not automatically locate the item header row.")
            return report

        header_row = rows[header_row_idx]
        subheader_row = rows[header_row_idx + 1] if header_row_idx + 1 < len(rows) else []

        # Find columns for SR No, Item Name, Product No
        item_col_idx = 1
        code_col_idx = 2
        for c_idx, cell in enumerate(header_row[:10]):
            txt = str(cell).strip().lower()
            if "item" in txt:
                item_col_idx = c_idx
            elif "product" in txt or "code" in txt:
                code_col_idx = c_idx

        # 3. Detect Outlet Columns
        # In this format, outlet headers start after the item info columns (typically col index 3)
        # Each outlet spans 2 columns: Count and Amount
        outlet_columns = []
        c_idx = max(item_col_idx, code_col_idx) + 1

        while c_idx < len(header_row):
            outlet_name = str(header_row[c_idx]).strip()
            # If outlet name is empty, check subheader or previous
            if not outlet_name and c_idx + 1 < len(header_row):
                c_idx += 1
                continue

            # Check if this column is the grand "Total"
            if outlet_name.lower() in ("total", "grand total"):
                break

            # Outlet pair: Count at c_idx, Amount at c_idx + 1
            count_col = c_idx
            amount_col = c_idx + 1 if c_idx + 1 < len(header_row) else None

            # Verify subheaders if present
            sub1 = str(subheader_row[count_col]).strip().lower() if count_col < len(subheader_row) else ""
            sub2 = str(subheader_row[amount_col]).strip().lower() if amount_col and amount_col < len(subheader_row) else ""

            if sub1 == "amount" and sub2 == "count":
                # Swapped
                count_col, amount_col = amount_col, count_col

            outlet_columns.append({
                "outlet_name": outlet_name,
                "count_col": count_col,
                "amount_col": amount_col
            })

            # Advance by 2 columns for paired layout
            c_idx += 2

        outlets_set = set()
        for oc in outlet_columns:
            outlets_set.add(oc["outlet_name"])
        report.outlets_found = sorted(list(outlets_set))

        # 4. Parse Item Data Rows
        data_start_row = header_row_idx + 2 if subheader_row else header_row_idx + 1
        items_set = set()

        for r_idx in range(data_start_row, len(rows)):
            row = rows[r_idx]
            if not row or not any(row):
                continue

            if len(row) <= item_col_idx:
                continue

            raw_item = str(row[item_col_idx]).strip()
            if not raw_item:
                continue

            # Stop or skip total summary row
            if raw_item.lower() in ("total", "grand total", "sum"):
                continue

            raw_code = str(row[code_col_idx]).strip() if code_col_idx < len(row) else None
            items_set.add(raw_item)

            for oc in outlet_columns:
                outlet_name = oc["outlet_name"]
                cnt_idx = oc["count_col"]
                amt_idx = oc["amount_col"]

                qty = clean_num(row[cnt_idx]) if cnt_idx < len(row) else 0.0
                amt = clean_num(row[amt_idx]) if amt_idx and amt_idx < len(row) else 0.0

                # If both qty and amount are 0, record is inactive for this outlet
                if qty == 0.0 and amt == 0.0:
                    continue

                unit_price = round(amt / qty, 2) if qty > 0 and amt > 0 else None

                record = ParsedRecord(
                    outlet_raw=outlet_name,
                    item_raw=raw_item,
                    item_code=raw_code,
                    quantity=qty,
                    unit_price=unit_price,
                    amount=amt,
                    transaction_date=start_date,
                    source_row_idx=r_idx + 1,
                    raw_data={"item": raw_item, "code": raw_code, "qty": qty, "amt": amt}
                )
                report.records.append(record)
                report.total_quantity += qty
                report.total_amount += amt

        report.items_found = sorted(list(items_set))
        return report
