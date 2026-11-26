import asyncio
import io
import unittest
from unittest.mock import patch

import openpyxl
import xlrd
from fastapi import HTTPException
from starlette.datastructures import UploadFile

from backend.parsers.base import ParsedRecord, ParsedReport
from backend.parsers.flat_tabular import FlatTabularParser
from backend.parsers.manager import ParserManager
from backend.routers.combined import (
    canonicalize_purchase_outlets,
    create_combined_workbook,
    create_master_workbook,
    export_combined_table,
    export_master_summary,
    merge_report_records,
    preview_combined_table,
    summarize_outlets,
)


class CombinedReportTests(unittest.TestCase):
    def test_flat_parser_maps_outlet_and_recipe_item_columns(self):
        report = FlatTabularParser.parse_rows(
            [
                ["Outlet Name", "Recipe Item Name", "Qty", "Amount"],
                ["Adajan", "Veg Burger", 2, 100],
            ],
            report_type="sales",
            filename="sales.xlsx",
        )

        self.assertEqual(len(report.records), 1)
        self.assertEqual(report.records[0].outlet_raw, "Adajan")
        self.assertEqual(report.records[0].item_raw, "Veg Burger")
        self.assertEqual(report.records[0].quantity, 2)
        self.assertEqual(report.records[0].amount, 100)
        self.assertEqual(report.warnings, [])

    def test_csv_flat_report_parses_in_combined_workflow(self):
        content = b"Outlet,Recipe Item,Qty,Amount\r\nAdajan,Veg Burger,2,100\r\n"

        report = ParserManager.parse(
            file_bytes=content,
            filename="purchase.csv",
            report_type="purchase",
        )

        self.assertEqual(len(report.records), 1)
        self.assertEqual(report.records[0].outlet_raw, "Adajan")
        self.assertEqual(report.records[0].item_raw, "Veg Burger")
        self.assertEqual(report.records[0].quantity, 2)
        self.assertEqual(report.records[0].amount, 100)

    def test_preview_accepts_csv_and_excel_pair(self):
        workbook = openpyxl.Workbook()
        worksheet = workbook.active
        worksheet.append(["Outlet", "Recipe Item", "Qty", "Amount"])
        worksheet.append(["Adajan", "Veg Burger", 2, 100])
        content = io.BytesIO()
        workbook.save(content)

        result = asyncio.run(
            preview_combined_table(
                sales_file=UploadFile(
                    filename="sales.csv",
                    file=io.BytesIO(b"Outlet,Recipe Item,Qty,Amount\r\nAdajan,Veg Burger,3,150\r\n"),
                ),
                purchase_file=UploadFile(
                    filename="purchase.xlsx",
                    file=io.BytesIO(content.getvalue()),
                ),
            )
        )

        self.assertEqual(result["total_rows"], 1)
        row = result["rows"][0]
        self.assertEqual(row["sales_quantity"], 3)
        self.assertEqual(row["purchase_quantity"], 2)
        self.assertEqual(row["purchase_amount"], 100)

    def test_legacy_xls_cells_are_converted_for_existing_parsers(self):
        class FakeSheet:
            name = "Outlet Report"
            nrows = 2
            ncols = 2

            def cell(self, row, col):
                values = [
                    [("Outlet", xlrd.XL_CELL_TEXT), ("Item", xlrd.XL_CELL_TEXT)],
                    [("Adajan", xlrd.XL_CELL_TEXT), ("Tea", xlrd.XL_CELL_TEXT)],
                ]
                value, cell_type = values[row][col]
                return type("Cell", (), {"value": value, "ctype": cell_type})()

        class FakeWorkbook:
            nsheets = 1
            datemode = 0

            def sheets(self):
                return [FakeSheet()]

        with patch("backend.parsers.manager.xlrd.open_workbook", return_value=FakeWorkbook()):
            workbook = ParserManager._load_excel_workbook(b"legacy xls bytes", "purchase.xls")

        self.assertEqual(workbook.sheetnames, ["Outlet Report"])
        self.assertEqual(workbook.active["A2"].value, "Adajan")
        self.assertEqual(workbook.active["B2"].value, "Tea")

    def test_header_detection_error_includes_candidate_header_labels(self):
        report = FlatTabularParser.parse_rows(
            [
                ["Outlet Code", "Recipe Code", "Quantity", "Net Value"],
                ["A-01", "R-01", 2, 100],
            ],
            report_type="purchase",
            filename="purchase.xlsx",
        )

        self.assertEqual(report.records, [])
        self.assertIn("Use a header such as", report.warnings[0])

    def test_flat_parser_finds_late_outlet_wise_recipe_headers(self):
        rows = [["Purchase Report"] for _ in range(60)]
        rows.extend(
            [
                ["Outlets", "Recipes", "Purchase Qty", "Purchase Amount"],
                ["Adajan", "Veg Burger", 2, 100],
            ]
        )

        report = FlatTabularParser.parse_rows(rows, report_type="purchase", filename="purchase.xlsx")

        self.assertEqual(len(report.records), 1)
        self.assertEqual(report.records[0].outlet_raw, "Adajan")
        self.assertEqual(report.records[0].item_raw, "Veg Burger")

    def test_header_detection_does_not_confuse_item_code_with_recipe_item(self):
        mapping = FlatTabularParser.detect_columns(
            ["Outlet Code", "Recipe Item Code", "Outlet", "Recipe Item", "Qty"]
        )

        self.assertEqual(mapping["outlet"], 2)
        self.assertEqual(mapping["item"], 3)

    def test_parser_selects_tab_with_outlet_and_recipe_item_headers(self):
        workbook = openpyxl.Workbook()
        workbook.active.title = "Instructions"
        workbook.active["A1"] = "Upload sales and purchase reports"
        data_sheet = workbook.create_sheet("Sales Data")
        data_sheet.append(["Outlet", "Recipe Item", "Quantity", "Sales Amount"])
        data_sheet.append(["Adajan", "Veg Burger", 2, 100])
        content = io.BytesIO()
        workbook.save(content)

        report = ParserManager.parse(
            file_bytes=content.getvalue(),
            filename="sales.xlsx",
            report_type="sales",
        )

        self.assertEqual(report.sheet_name, "Sales Data")
        self.assertEqual(len(report.records), 1)
        self.assertEqual(report.records[0].item_raw, "Veg Burger")

    def test_flat_recipe_report_is_not_misclassified_as_matrix(self):
        workbook = openpyxl.Workbook()
        worksheet = workbook.active
        worksheet.append(["Recipe Item", "Outlet", "Purchase Qty", "Purchase Amount"])
        worksheet.append(["Veg Burger", "Adajan", 2, 100])
        content = io.BytesIO()
        workbook.save(content)

        report = ParserManager.parse(
            file_bytes=content.getvalue(),
            filename="RECIPE.xlsx",
            report_type="purchase",
        )

        self.assertEqual(report.parser_name, "Flat Tabular Parser")
        self.assertEqual(len(report.records), 1)
        self.assertEqual(report.records[0].outlet_raw, "Adajan")
        self.assertEqual(report.records[0].item_raw, "Veg Burger")
        self.assertEqual(report.records[0].amount, 100)

    def test_outlet_recipe_matrix_reads_purchase_columns_by_item(self):
        workbook = openpyxl.Workbook()
        worksheet = workbook.active
        worksheet.title = "Recipe"
        header = [None] * 50
        header[0] = "PIZZA CATEGORY"
        header[38] = "OUTLET NAME"
        header[39:49] = [
            "BURGER BUN", "SALES", "PURACHES",
            "PIZZA BASE", "SALES", "PURACHES",
            "CHEESE SPREAD", "SALES", "PURACHES", "USE",
        ]
        worksheet.append(header)
        row = [None] * 50
        row[38] = "L P SHAVANI"
        row[40] = 2160
        row[41] = 2310
        row[43] = 683
        row[44] = 696
        row[46] = 993
        row[47] = "4 (8kg)"
        row[48] = "9.9kg"
        worksheet.append(row)
        content = io.BytesIO()
        workbook.save(content)

        report = ParserManager.parse(
            file_bytes=content.getvalue(),
            filename="RECIPE.xlsx",
            report_type="purchase",
        )

        self.assertEqual(report.parser_name, "Outlet Recipe Matrix Parser")
        self.assertEqual(
            [(record.outlet_raw, record.item_raw, record.quantity) for record in report.records],
            [
                ("L P SHAVANI", "BURGER BUN", 2310),
                ("L P SHAVANI", "PIZZA BASE", 696),
                ("L P SHAVANI", "CHEESE SPREAD", 4),
            ],
        )
        self.assertFalse(report.records[0].raw_data["amount_available"])
        merged = merge_report_records(
            ParsedReport(
                report_type="sales",
                parser_name="test",
                filename="sales.xlsx",
                records=[ParsedRecord("L P SHAVANI", "BURGER BUN", quantity=5, amount=50)],
            ),
            report,
        )
        bun_row = next(row for row in merged if row["item"] == "BURGER BUN")
        self.assertEqual(bun_row["sales_amount"], 50)
        self.assertEqual(bun_row["purchase_amount"], 23100)
        self.assertTrue(bun_row["purchase_amount_estimated"])

    def test_merge_matches_outlets_and_items_and_sums_duplicate_rows(self):
        sales = ParsedReport(
            report_type="sales",
            parser_name="test",
            filename="sales.xlsx",
            records=[
                ParsedRecord("Adajan (OUT-012)\n", "Coffee", quantity=2, amount=20),
                ParsedRecord("Adajan (OUT-012)", "Coffee", quantity=1, amount=10),
            ],
        )
        purchase = ParsedReport(
            report_type="purchase",
            parser_name="test",
            filename="purchase.xlsx",
            records=[
                ParsedRecord("Adajan", " coffee ", quantity=5, amount=40),
                ParsedRecord("Bandra", "Tea", quantity=3, amount=15),
            ],
        )

        rows = merge_report_records(sales, purchase)

        self.assertEqual(len(rows), 2)
        adajan = next(row for row in rows if row["outlet"].startswith("Adajan"))
        self.assertNotIn("\n", adajan["outlet"])
        self.assertEqual(adajan["sales_quantity"], 3)
        self.assertEqual(adajan["sales_amount"], 30)
        self.assertEqual(adajan["purchase_quantity"], 5)
        self.assertEqual(adajan["purchase_amount"], 40)
        bandra = next(row for row in rows if row["outlet"] == "Bandra")
        self.assertEqual(bandra["sales_quantity"], 0)
        self.assertEqual(bandra["purchase_quantity"], 3)

    def test_merge_alias_outlet_names_under_sales_outlet(self):
        sales = ParsedReport(
            report_type="sales",
            parser_name="test",
            filename="sales.xlsx",
            records=[
                ParsedRecord("CITY LIGHT OUT-017", "Coffee", quantity=2, amount=20),
                ParsedRecord("LP SAVANI OUT-053", "Tea", quantity=4, amount=40),
                ParsedRecord("(CITY CENTER) SHIVSHAKTI ENTERPRISE OUT-050", "Burger Bun", quantity=5, amount=50),
            ],
        )
        purchase = ParsedReport(
            report_type="purchase",
            parser_name="test",
            filename="purchase.xlsx",
            records=[
                ParsedRecord("CITY LIGHT", "Coffee", quantity=3, amount=0, raw_data={"amount_available": False}),
                ParsedRecord("L P SHAVANI", "Tea", quantity=6, amount=0, raw_data={"amount_available": False}),
                ParsedRecord("CITY CENTER", "Burger Bun", quantity=7, amount=0, raw_data={"amount_available": False}),
            ],
        )

        rows = merge_report_records(sales, purchase)

        self.assertEqual(len(rows), 3)
        city_light = next(row for row in rows if row["outlet"] == "CITY LIGHT OUT-017")
        self.assertEqual(city_light["sales_quantity"], 2)
        self.assertEqual(city_light["purchase_quantity"], 3)
        self.assertEqual(city_light["purchase_amount"], 30)
        self.assertTrue(city_light["purchase_amount_estimated"])
        lp_savani = next(row for row in rows if row["outlet"] == "LP SAVANI OUT-053")
        self.assertEqual(lp_savani["sales_quantity"], 4)
        self.assertEqual(lp_savani["purchase_quantity"], 6)
        self.assertEqual(lp_savani["purchase_amount"], 60)
        city_center = next(row for row in rows if row["outlet"].startswith("(CITY CENTER)"))
        self.assertEqual(city_center["sales_quantity"], 5)
        self.assertEqual(city_center["purchase_quantity"], 7)
        self.assertEqual(city_center["purchase_amount"], 70)

    def test_purchase_amount_stays_unavailable_without_matching_sales_price(self):
        sales = ParsedReport(
            report_type="sales",
            parser_name="test",
            filename="sales.xlsx",
            records=[ParsedRecord("Adajan", "Coffee", quantity=2, amount=20)],
        )
        purchase = ParsedReport(
            report_type="purchase",
            parser_name="test",
            filename="purchase.xlsx",
            records=[
                ParsedRecord(
                    "Adajan",
                    "Tea",
                    quantity=4,
                    raw_data={"amount_available": False},
                )
            ],
        )

        row = next(row for row in merge_report_records(sales, purchase) if row["item"] == "Tea")

        self.assertEqual(row["purchase_quantity"], 4)
        self.assertIsNone(row["purchase_amount"])
        self.assertFalse(row["purchase_amount_estimated"])

    def test_workbook_contains_formatted_table_and_data(self):
        rows = [
            {
                "outlet": "Adajan",
                "item": "Coffee",
                "sales_quantity": 2,
                "sales_amount": 20,
                "purchase_quantity": 5,
                "purchase_amount": 40,
            }
        ]

        workbook_bytes = create_combined_workbook(rows)
        worksheet = openpyxl.load_workbook(io.BytesIO(workbook_bytes)).active

        self.assertEqual(worksheet.max_row, 2)
        self.assertEqual(worksheet.max_column, 6)
        self.assertEqual(worksheet["A1"].value, "Outlet")
        self.assertEqual(worksheet["B1"].value, "Recipe Item")
        self.assertEqual(worksheet["F2"].value, 40)
        self.assertIn("SalesPurchaseTable", worksheet.tables)
        self.assertEqual(worksheet.freeze_panes, "A2")

    def test_export_endpoint_parses_and_combines_excel_uploads(self):
        def excel_file(quantity, amount):
            workbook = openpyxl.Workbook()
            worksheet = workbook.active
            worksheet.append(["Outlet", "Item", "Qty", "Amount"])
            worksheet.append(["Adajan", "Coffee", quantity, amount])
            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        response = asyncio.run(
            export_combined_table(
                sales_file=UploadFile(filename="sales.xlsx", file=excel_file(2, 20)),
                purchase_file=UploadFile(filename="purchase.xlsx", file=excel_file(3, 30)),
                outlet_name="",
            )
        )

        worksheet = openpyxl.load_workbook(io.BytesIO(response.body)).active
        self.assertEqual(response.headers["X-Record-Count"], "1")
        self.assertEqual(worksheet["A2"].value, "Adajan")
        self.assertEqual(worksheet["B2"].value, "Coffee")
        self.assertEqual(worksheet["C2"].value, 2)
        self.assertEqual(worksheet["E2"].value, 3)

    def test_outlet_preview_summarizes_each_branch(self):
        def excel_file(rows):
            workbook = openpyxl.Workbook()
            worksheet = workbook.active
            worksheet.append(["Outlet", "Recipe Item", "Qty", "Amount"])
            for row in rows:
                worksheet.append(row)
            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        result = asyncio.run(
            preview_combined_table(
                sales_file=UploadFile(
                    filename="sales.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 3, 30], ["Adajan", "Pizza Base", 2, 20]]),
                ),
                purchase_file=UploadFile(
                    filename="purchase.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 5, 0]]),
                ),
            )
        )

        shiv = next(outlet for outlet in result["outlets"] if outlet["name"] == "Shiv Shakti")
        self.assertEqual(result["total_rows"], 2)
        self.assertEqual(len(result["rows"]), 2)
        self.assertTrue(any(row["item"] == "Burger Bun" for row in result["rows"]))
        self.assertEqual(shiv["item_count"], 1)
        self.assertEqual(shiv["sales_quantity"], 3)
        self.assertEqual(shiv["purchase_quantity"], 5)

    def test_master_summary_workbook_has_one_row_per_outlet(self):
        sales = ParsedReport(
            report_type="sales",
            parser_name="test",
            filename="sales.xlsx",
            records=[
                ParsedRecord("Shiv Shakti", "Burger Bun", quantity=3, amount=30),
                ParsedRecord("Shiv Shakti", "Pizza Base", quantity=2, amount=20),
            ],
        )
        purchase = ParsedReport(
            report_type="purchase",
            parser_name="test",
            filename="purchase.xlsx",
            records=[
                ParsedRecord("Shiv Shakti", "Burger Bun", quantity=5, amount=50),
                ParsedRecord("Adajan", "Pizza Base", quantity=4, amount=40),
            ],
        )
        summary = create_master_workbook(
            summarize_outlets(merge_report_records(sales, purchase))
        )
        worksheet = openpyxl.load_workbook(io.BytesIO(summary)).active

        self.assertEqual(worksheet.max_row, 3)
        self.assertEqual(worksheet["A1"].value, "Outlet")
        self.assertEqual(worksheet["A2"].value, "Adajan")
        self.assertEqual(worksheet["A3"].value, "Shiv Shakti")
        self.assertEqual(worksheet["B3"].value, 2)
        self.assertEqual(worksheet["C3"].value, 5)
        self.assertEqual(worksheet["D3"].value, 50)
        self.assertEqual(worksheet["E3"].value, 5)
        self.assertEqual(worksheet["F3"].value, 50)
        self.assertIn("OutletMasterSummary", worksheet.tables)

    def test_master_summary_endpoint_downloads_master_workbook(self):
        def excel_file(rows):
            workbook = openpyxl.Workbook()
            worksheet = workbook.active
            worksheet.append(["Outlet", "Recipe Item", "Qty", "Amount"])
            for row in rows:
                worksheet.append(row)
            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        response = asyncio.run(
            export_master_summary(
                sales_file=UploadFile(
                    filename="sales.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 3, 30]]),
                ),
                purchase_file=UploadFile(
                    filename="purchase.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 5, 50]]),
                ),
            )
        )

        worksheet = openpyxl.load_workbook(io.BytesIO(response.body)).active
        self.assertEqual(response.headers["X-Record-Count"], "1")
        self.assertIn("sales_purchase_master_summary.xlsx", response.headers["Content-Disposition"])
        self.assertEqual(worksheet.max_row, 2)
        self.assertEqual(worksheet["A2"].value, "Shiv Shakti")
        self.assertEqual(worksheet["D2"].value, 30)
        self.assertEqual(worksheet["F2"].value, 50)

    def test_export_can_download_only_selected_outlet(self):
        def excel_file(rows):
            workbook = openpyxl.Workbook()
            worksheet = workbook.active
            worksheet.append(["Outlet", "Recipe Item", "Qty", "Amount"])
            for row in rows:
                worksheet.append(row)
            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        response = asyncio.run(
            export_combined_table(
                sales_file=UploadFile(
                    filename="sales.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 3, 30], ["Adajan", "Pizza Base", 2, 20]]),
                ),
                purchase_file=UploadFile(
                    filename="purchase.xlsx",
                    file=excel_file([["Shiv Shakti", "Burger Bun", 5, 50], ["Adajan", "Pizza Base", 4, 40]]),
                ),
                outlet_name="Shiv Shakti",
            )
        )

        worksheet = openpyxl.load_workbook(io.BytesIO(response.body)).active
        self.assertEqual(worksheet.max_row, 2)
        self.assertEqual(worksheet["A2"].value, "Shiv Shakti")
        self.assertEqual(worksheet["C2"].value, 3)
        self.assertEqual(worksheet["E2"].value, 5)
        self.assertEqual(response.headers["X-Record-Count"], "1")
        self.assertIn("shiv_shakti_sales_purchase.xlsx", response.headers["Content-Disposition"])

    def test_export_error_explains_required_purchase_headers(self):
        def excel_file(headers, values):
            workbook = openpyxl.Workbook()
            worksheet = workbook.active
            worksheet.append(headers)
            worksheet.append(values)
            output = io.BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                export_combined_table(
                    sales_file=UploadFile(
                        filename="sales.xlsx",
                        file=excel_file(["Outlet", "Item", "Qty"], ["Adajan", "Coffee", 1]),
                    ),
                    purchase_file=UploadFile(
                        filename="purchase.xlsx",
                        file=excel_file(["Code", "Qty"], ["P-1", 1]),
                    ),
                )
            )

        self.assertIn("first 200 worksheet rows", context.exception.detail)
        self.assertIn("worksheet", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
