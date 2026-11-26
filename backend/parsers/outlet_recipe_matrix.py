import io
import re
from typing import Any, List, Optional, Tuple

import openpyxl

from backend.parsers.base import ParsedRecord, ParsedReport, clean_num


class OutletRecipeMatrixParser:
    """Parse recipe sheets with an outlet column and per-item Sales/Purchases columns."""

    @staticmethod
    def _value_text(value: Any) -> str:
        return " ".join(str(value or "").strip().lower().split())

    @classmethod
    def _header_groups(cls, ws: Any, row_idx: int) -> Tuple[Optional[int], List[dict]]:
        outlet_col = None
        for col_idx in range(1, ws.max_column + 1):
            if cls._value_text(ws.cell(row_idx, col_idx).value) in (
                "outlet", "outlet name", "outlets", "store", "store name",
                "location", "location name", "branch", "branch name",
            ):
                outlet_col = col_idx
                break

        if outlet_col is None:
            return None, []

        groups = []
        for col_idx in range(outlet_col + 1, ws.max_column - 1):
            item_name = str(ws.cell(row_idx, col_idx).value or "").strip()
            sales_header = cls._value_text(ws.cell(row_idx, col_idx + 1).value)
            purchase_header = cls._value_text(ws.cell(row_idx, col_idx + 2).value)
            if not item_name or sales_header not in ("sale", "sales") or not purchase_header.startswith(("purch", "purach")):
                continue
            groups.append(
                {
                    "item": item_name,
                    "sales_col": col_idx + 1,
                    "purchase_col": col_idx + 2,
                }
            )
        return outlet_col, groups

    @classmethod
    def can_parse(cls, ws: Any) -> bool:
        for row_idx in range(1, min(201, ws.max_row + 1)):
            _, groups = cls._header_groups(ws, row_idx)
            if groups:
                return True
        return False

    @staticmethod
    def _quantity(value: Any) -> float:
        number = clean_num(value)
        if number:
            return number
        match = re.match(r"\s*([+-]?\d[\d,]*(?:\.\d+)?)", str(value or ""))
        return clean_num(match.group(1)) if match else 0.0

    @classmethod
    def parse(
        cls,
        file_bytes: bytes,
        filename: str,
        report_type: str,
        sheet_name: Optional[str] = None,
    ) -> ParsedReport:
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        worksheet_name = sheet_name if sheet_name in workbook.sheetnames else workbook.sheetnames[0]
        if not sheet_name:
            worksheet_name = next(
                (sheet.title for sheet in workbook.worksheets if cls.can_parse(sheet)),
                workbook.sheetnames[0],
            )
        ws = workbook[worksheet_name]
        report = ParsedReport(
            report_type=report_type,
            parser_name="Outlet Recipe Matrix Parser",
            filename=filename,
            sheet_name=worksheet_name,
        )

        sections = []
        for row_idx in range(1, ws.max_row + 1):
            outlet_col, groups = cls._header_groups(ws, row_idx)
            if groups and outlet_col is not None:
                sections.append((row_idx, outlet_col, groups))

        item_field = "sales_col" if report_type == "sales" else "purchase_col"
        outlets = set()
        items = set()
        for section_idx, (header_row, outlet_col, groups) in enumerate(sections):
            next_header = sections[section_idx + 1][0] if section_idx + 1 < len(sections) else ws.max_row + 1
            for row_idx in range(header_row + 1, next_header):
                outlet = str(ws.cell(row_idx, outlet_col).value or "").strip()
                if not outlet or outlet.lower() in ("total", "grand total", "outlet", "outlet name"):
                    continue
                for group in groups:
                    quantity = cls._quantity(ws.cell(row_idx, group[item_field]).value)
                    if not quantity:
                        continue
                    item_name = group["item"]
                    report.records.append(
                        ParsedRecord(
                            outlet_raw=outlet,
                            item_raw=item_name,
                            quantity=quantity,
                            amount=0.0,
                            source_row_idx=row_idx,
                            raw_data={
                                "outlet": outlet,
                                "item": item_name,
                                "quantity": quantity,
                                "report_type": report_type,
                                "amount_available": False,
                            },
                        )
                    )
                    outlets.add(outlet)
                    items.add(item_name)
                    report.total_quantity += quantity

        report.outlets_found = sorted(outlets)
        report.items_found = sorted(items)
        if not report.records:
            report.warnings.append(
                f"No {report_type} item quantities were found in the outlet-wise recipe table on worksheet '{worksheet_name}'."
            )
        return report
