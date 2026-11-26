import io
import csv
import xlrd
import openpyxl
from typing import Dict, Any, List, Optional
from backend.parsers.base import ParsedReport
from backend.parsers.csv_matrix import CSVLocationMatrixParser
from backend.parsers.xlsx_matrix import XLSXMatrixParser
from backend.parsers.outlet_recipe_matrix import OutletRecipeMatrixParser
from backend.parsers.flat_tabular import FlatTabularParser


class ParserManager:
    """
    Central router for Excel and CSV parsing across Sales and Purchase reports.
    """

    @classmethod
    def _load_excel_workbook(cls, file_bytes: bytes, filename: str):
        if not filename.lower().endswith(".xls"):
            return openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)

        source = xlrd.open_workbook(file_contents=file_bytes)
        workbook = openpyxl.Workbook()
        for index, source_sheet in enumerate(source.sheets()):
            target_sheet = workbook.active if index == 0 else workbook.create_sheet()
            target_sheet.title = source_sheet.name[:31]
            for row_idx in range(source_sheet.nrows):
                values = []
                for col_idx in range(source_sheet.ncols):
                    cell = source_sheet.cell(row_idx, col_idx)
                    if cell.ctype == xlrd.XL_CELL_DATE:
                        value = xlrd.xldate.xldate_as_datetime(cell.value, source.datemode)
                    elif cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                        value = None
                    else:
                        value = cell.value
                    values.append(value)
                target_sheet.append(values)
        if not source.nsheets:
            workbook.active.title = "Sheet1"
        return workbook

    @classmethod
    def get_sheet_names(cls, file_bytes: bytes, filename: str) -> List[str]:
        if filename.lower().endswith((".xlsx", ".xlsm", ".xls", ".xltx", ".xltm")):
            wb = cls._load_excel_workbook(file_bytes, filename)
            return wb.sheetnames
        return []

    @classmethod
    def inspect(cls, file_bytes: bytes, filename: str, sheet_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Quick inspection returning file structure, sheets, sample rows, and suggested parser.
        """
        is_excel = filename.lower().endswith((".xlsx", ".xlsm", ".xls"))
        sheets = []
        sample_rows = []
        detected_parser = "flat_tabular"

        if is_excel:
            wb = cls._load_excel_workbook(file_bytes, filename)
            sheets = wb.sheetnames
            selected = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
            if not sheet_name:
                matrix_sheet = None
                flat_sheet = None
                recipe_sheet = None
                for candidate in wb.worksheets:
                    if recipe_sheet is None and OutletRecipeMatrixParser.can_parse(candidate):
                        recipe_sheet = candidate
                    if XLSXMatrixParser.can_parse(candidate) and matrix_sheet is None:
                        matrix_sheet = candidate
                    candidate_rows = [
                        [candidate.cell(r, c).value for c in range(1, candidate.max_column + 1)]
                        for r in range(1, min(201, candidate.max_row + 1))
                    ]
                    for row in candidate_rows:
                        mapping = FlatTabularParser.detect_columns(
                            [str(value or "") for value in row]
                        )
                        if mapping.get("outlet") is not None and mapping.get("item") is not None:
                            flat_sheet = candidate
                            break
                    if flat_sheet is not None:
                        break
                if recipe_sheet is not None:
                    selected = recipe_sheet.title
                elif flat_sheet is not None:
                    selected = flat_sheet.title
                elif matrix_sheet is not None:
                    selected = matrix_sheet.title
            ws = wb[selected]

            # Read first 15 rows for inspection
            for r in range(1, min(16, ws.max_row + 1)):
                row_vals = [ws.cell(r, c).value for c in range(1, min(15, ws.max_column + 1))]
                sample_rows.append(row_vals)

            has_flat_header = any(
                (mapping := FlatTabularParser.detect_columns(
                    [str(ws.cell(r, c).value or "") for c in range(1, ws.max_column + 1)]
                )).get("outlet") is not None
                and mapping.get("item") is not None
                for r in range(1, min(201, ws.max_row + 1))
            )
            if OutletRecipeMatrixParser.can_parse(ws):
                detected_parser = "outlet_recipe_matrix"
            elif has_flat_header:
                detected_parser = "flat_tabular"
            elif XLSXMatrixParser.can_parse(ws):
                detected_parser = "xlsx_matrix"
            else:
                detected_parser = "flat_tabular"

        else:
            # CSV file
            text = file_bytes.decode("utf-8-sig", errors="replace")
            reader = csv.reader(io.StringIO(text))
            for i, r in enumerate(reader):
                if i >= 15:
                    break
                sample_rows.append(r[:15])

            if CSVLocationMatrixParser.can_parse(sample_rows):
                detected_parser = "csv_matrix"
            else:
                detected_parser = "flat_tabular"

        return {
            "filename": filename,
            "is_excel": is_excel,
            "sheets": sheets,
            "selected_sheet": selected if is_excel else (sheet_name or (sheets[0] if sheets else None)),
            "sample_rows": sample_rows,
            "detected_parser": detected_parser
        }

    @classmethod
    def parse(
        cls,
        file_bytes: bytes,
        filename: str,
        report_type: str = "sales",
        sheet_name: Optional[str] = None,
        parser_type: Optional[str] = None,
        custom_mapping: Optional[Dict[str, int]] = None
    ) -> ParsedReport:
        is_excel = filename.lower().endswith((".xlsx", ".xlsm", ".xls"))

        selected_sheet = sheet_name
        # Determine parser if not explicitly overridden
        if not parser_type or parser_type == "auto":
            info = cls.inspect(file_bytes, filename, sheet_name)
            chosen_parser = info["detected_parser"]
            selected_sheet = info["selected_sheet"]
        else:
            chosen_parser = parser_type

        if chosen_parser == "csv_matrix":
            return CSVLocationMatrixParser.parse(file_bytes, report_type=report_type, filename=filename)

        elif chosen_parser == "xlsx_matrix":
            return XLSXMatrixParser.parse(
                file_bytes,
                sheet_name=selected_sheet,
                report_type=report_type,
                filename=filename
            )

        elif chosen_parser == "outlet_recipe_matrix":
            return OutletRecipeMatrixParser.parse(
                file_bytes=file_bytes,
                filename=filename,
                report_type=report_type,
                sheet_name=selected_sheet,
            )

        else:
            # Flat tabular parser
            if is_excel:
                wb = cls._load_excel_workbook(file_bytes, filename)
                s = selected_sheet if selected_sheet and selected_sheet in wb.sheetnames else wb.sheetnames[0]
                ws = wb[s]
                rows = []
                for r in range(1, ws.max_row + 1):
                    rows.append([ws.cell(r, c).value for c in range(1, ws.max_column + 1)])
                return FlatTabularParser.parse_rows(
                    rows,
                    mapping=custom_mapping,
                    report_type=report_type,
                    filename=filename,
                    sheet_name=s
                )
            else:
                text = file_bytes.decode("utf-8-sig", errors="replace")
                reader = csv.reader(io.StringIO(text))
                rows = [r for r in reader]
                return FlatTabularParser.parse_rows(
                    rows,
                    mapping=custom_mapping,
                    report_type=report_type,
                    filename=filename
                )
