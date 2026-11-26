import csv
import io
import re
from typing import List, Dict, Any, Optional
import openpyxl
from backend.parsers.base import (
    ParsedRecord, ParsedReport, clean_num, parse_date_string, extract_date_range_from_text
)


class FlatTabularParser:
    """
    Parser for standard tabular reports with rows of transactions/items:
    Columns: Outlet, Item, Qty, Price, Amount, Date.
    Supports auto column detection or manual mapping.
    """

    COLUMN_PATTERNS = {
        "outlet": ["outlet names", "outlets", "outlet name", "outlet", "store names", "stores", "store name", "store", "location names", "locations", "location name", "location", "branches", "branch name", "branch", "franchises", "franchise", "sites", "site", "restaurants", "restaurant", "unit name"],
        "item": ["recipe item names", "recipe items", "recipe item name", "recipe item", "menu items", "menu item name", "menu item", "item descriptions", "item description", "item names", "item name", "product names", "products", "product name", "dish names", "dish name", "stock items", "stock item", "item details", "product details", "item particulars", "description of goods", "recipe names", "recipes", "recipe name", "recipe", "menu", "items", "item", "product", "description", "material", "particulars", "skus", "sku", "dishes", "dish", "food items"],
        "code": ["recipe item code", "recipe code", "item code", "product code", "product no", "sku code", "code"],
        "quantity": ["qty", "quantity", "count", "units", "ordered qty"],
        "price": ["price", "rate", "unit price", "cost", "unit cost"],
        "amount": ["amount", "total", "net amount", "total amount", "value", "sales", "purchase"],
        "date": ["date", "bill date", "txn date", "invoice date", "order date"]
    }

    @classmethod
    def detect_columns(cls, headers: List[str]) -> Dict[str, Optional[int]]:
        mapping = {k: None for k in cls.COLUMN_PATTERNS}
        normalized = [
            re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(header).lower())).strip()
            if header else ""
            for header in headers
        ]

        for role, patterns in cls.COLUMN_PATTERNS.items():
            for pattern in patterns:
                for idx, header in enumerate(normalized):
                    if not header:
                        continue
                    if role == "item" and "code" in header.split():
                        continue
                    if role == "outlet" and any(
                        token in header.split() for token in ("code", "id", "number", "no")
                    ):
                        continue
                    if re.search(rf"(?:^|\s){re.escape(pattern)}(?:$|\s)", header):
                        mapping[role] = idx
                        break
                if mapping[role] is not None:
                    break

        return mapping

    @classmethod
    def parse_rows(
        cls,
        rows: List[List[Any]],
        mapping: Optional[Dict[str, int]] = None,
        report_type: str = "sales",
        filename: str = "",
        sheet_name: Optional[str] = None
    ) -> ParsedReport:
        report = ParsedReport(
            report_type=report_type,
            parser_name="Flat Tabular Parser",
            filename=filename,
            sheet_name=sheet_name
        )

        if not rows:
            report.warnings.append("No data rows found.")
            return report

        # Find header row
        header_idx = 0
        detected_map = None

        if mapping is None:
            for r_i, r in enumerate(rows[:200]):
                str_row = [str(c or "") for c in r]
                m = cls.detect_columns(str_row)
                if m.get("outlet") is not None and m.get("item") is not None:
                    header_idx = r_i
                    detected_map = m
                    break
        else:
            detected_map = mapping

        if not detected_map or detected_map.get("outlet") is None or detected_map.get("item") is None:
            report.warnings.append(
                "Could not detect outlet and recipe/item column headers in the first 200 worksheet rows. "
                "Use a header such as Outlet/Outlets/Store/Branch and Recipe/Recipe Item/Item/Product."
            )
            return report

        col_outlet = detected_map.get("outlet")
        col_item = detected_map.get("item")
        col_code = detected_map.get("code")
        col_qty = detected_map.get("quantity")
        col_price = detected_map.get("price")
        col_amt = detected_map.get("amount")
        col_date = detected_map.get("date")

        outlets_set = set()
        items_set = set()
        dates_list = []

        data_rows = rows[header_idx + 1:]
        for r_i, row in enumerate(data_rows):
            if not row or not any(row):
                continue

            raw_outlet = str(row[col_outlet]).strip() if col_outlet is not None and col_outlet < len(row) else ""
            raw_item = str(row[col_item]).strip() if col_item is not None and col_item < len(row) else ""

            if not raw_outlet or not raw_item:
                continue

            if raw_outlet.lower() in ("total", "grand total") or raw_item.lower() in ("total", "grand total"):
                continue

            raw_code = str(row[col_code]).strip() if col_code is not None and col_code < len(row) and row[col_code] else None
            qty = clean_num(row[col_qty]) if col_qty is not None and col_qty < len(row) else 0.0
            price = clean_num(row[col_price]) if col_price is not None and col_price < len(row) else None
            amt = clean_num(row[col_amt]) if col_amt is not None and col_amt < len(row) else 0.0

            if amt == 0.0 and price and qty:
                amt = round(qty * price, 2)
            if price is None and qty > 0 and amt > 0:
                price = round(amt / qty, 2)

            txn_date = None
            if col_date is not None and col_date < len(row) and row[col_date]:
                txn_date = parse_date_string(str(row[col_date]))
                if txn_date:
                    dates_list.append(txn_date)

            outlets_set.add(raw_outlet)
            items_set.add(raw_item)

            record = ParsedRecord(
                outlet_raw=raw_outlet,
                item_raw=raw_item,
                item_code=raw_code,
                quantity=qty,
                unit_price=price,
                amount=amt,
                transaction_date=txn_date,
                source_row_idx=header_idx + 1 + r_i + 1,
                raw_data={"outlet": raw_outlet, "item": raw_item, "qty": qty, "amt": amt}
            )
            report.records.append(record)
            report.total_quantity += qty
            report.total_amount += amt

        if dates_list:
            dates_list.sort()
            report.start_date = dates_list[0]
            report.end_date = dates_list[-1]
        elif filename:
            s_d, e_d = extract_date_range_from_text(filename)
            report.start_date = s_d
            report.end_date = e_d

        report.outlets_found = sorted(list(outlets_set))
        report.items_found = sorted(list(items_set))
        return report
