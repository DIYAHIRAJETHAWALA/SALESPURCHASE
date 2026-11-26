import asyncio
import io
import re
from typing import Dict, List, Tuple

import openpyxl
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from openpyxl.worksheet.table import Table, TableStyleInfo
from rapidfuzz import fuzz

from backend.matching import extract_core_location, normalize_text
from backend.parsers.base import ParsedReport
from backend.parsers.manager import ParserManager

router = APIRouter(prefix="/api/combined", tags=["Combined Sales & Purchase"])


def canonicalize_purchase_outlets(sales: ParsedReport, purchase: ParsedReport) -> Dict[str, Tuple[str, str]]:
    sales_outlets: Dict[str, str] = {}
    for record in sales.records:
        key = normalize_text(record.outlet_raw)
        if key:
            sales_outlets.setdefault(key, " ".join(record.outlet_raw.split()))

    mappings: Dict[str, Tuple[str, str]] = {}
    for record in purchase.records:
        key = normalize_text(record.outlet_raw)
        if not key:
            continue
        if key in sales_outlets:
            mappings[key] = (key, sales_outlets[key])
            continue
        if key in mappings:
            continue

        purchase_core = extract_core_location(record.outlet_raw)
        if len(purchase_core.split()) < 2 and len(purchase_core) < 5:
            mappings[key] = (key, " ".join(record.outlet_raw.split()))
            continue

        candidates = []
        for sales_key, sales_name in sales_outlets.items():
            sales_core = extract_core_location(sales_name)
            if len(sales_core.split()) < 2 and len(sales_core) < 5:
                continue
            score = fuzz.WRatio(purchase_core, sales_core)
            if score >= 90:
                candidates.append((score, sales_key, sales_name))
        candidates.sort(reverse=True)

        if candidates and (len(candidates) == 1 or candidates[0][0] - candidates[1][0] >= 8):
            _, matched_key, matched_name = candidates[0]
            mappings[key] = (matched_key, matched_name)
        else:
            mappings[key] = (key, " ".join(record.outlet_raw.split()))
    return mappings


def merge_report_records(sales: ParsedReport, purchase: ParsedReport) -> List[dict]:
    merged: Dict[Tuple[str, str], dict] = {}
    purchase_outlet_mappings = canonicalize_purchase_outlets(sales, purchase)
    amount_available = {
        report_type: all(record.raw_data.get("amount_available", True) for record in report.records)
        for report_type, report in (("sales", sales), ("purchase", purchase))
    }

    for report_type, report in (("sales", sales), ("purchase", purchase)):
        for record in report.records:
            outlet_key = normalize_text(record.outlet_raw)
            outlet_name = " ".join(record.outlet_raw.split())
            if report_type == "purchase" and outlet_key in purchase_outlet_mappings:
                outlet_key, outlet_name = purchase_outlet_mappings[outlet_key]
            item_key = " ".join(record.item_raw.casefold().split())
            if not outlet_key or not item_key:
                continue

            key = (outlet_key, item_key)
            row = merged.setdefault(
                key,
                {
                    "outlet": outlet_name,
                    "item": record.item_raw.strip(),
                    "sales_quantity": 0.0,
                    "sales_amount": 0.0 if amount_available["sales"] else None,
                    "purchase_quantity": 0.0,
                    "purchase_amount": 0.0 if amount_available["purchase"] else None,
                    "purchase_amount_estimated": False,
                },
            )
            row[f"{report_type}_quantity"] += record.quantity
            if amount_available[report_type]:
                row[f"{report_type}_amount"] += record.amount

    rows = list(merged.values())
    for row in rows:
        if row["purchase_amount"] is None:
            if row["purchase_quantity"] <= 0:
                row["purchase_amount"] = 0.0
            elif row["sales_quantity"] > 0 and row["sales_amount"] is not None:
                sales_unit_price = row["sales_amount"] / row["sales_quantity"]
                row["purchase_amount"] = round(row["purchase_quantity"] * sales_unit_price, 2)
                row["purchase_amount_estimated"] = True
        for field in ("sales_quantity", "sales_amount", "purchase_quantity", "purchase_amount"):
            if row[field] is not None:
                row[field] = round(row[field], 2)

    return sorted(rows, key=lambda row: (row["outlet"].casefold(), row["item"].casefold()))


def create_combined_workbook(rows: List[dict]) -> bytes:
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.title = "Sales & Purchase"
    worksheet.append(
        [
            "Outlet",
            "Recipe Item",
            "Sales Quantity",
            "Sales Amount",
            "Purchase Quantity",
            "Purchase Amount",
        ]
    )

    for row in rows:
        worksheet.append(
            [
                row["outlet"],
                row["item"],
                row["sales_quantity"],
                row["sales_amount"],
                row["purchase_quantity"],
                row["purchase_amount"],
            ]
        )

    if rows:
        table = Table(displayName="SalesPurchaseTable", ref=f"A1:F{len(rows) + 1}")
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        worksheet.add_table(table)

    worksheet.freeze_panes = "A2"
    for column, width in {"A": 30, "B": 36, "C": 18, "D": 18, "E": 20, "F": 20}.items():
        worksheet.column_dimensions[column].width = width
    for row_idx in range(2, worksheet.max_row + 1):
        for column_idx in range(3, 7):
            worksheet.cell(row_idx, column_idx).number_format = "#,##0.00"

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def create_master_workbook(outlets: List[dict]) -> bytes:
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.title = "Outlet Master Summary"
    worksheet.append(
        [
            "Outlet",
            "Item Count",
            "Sales Quantity",
            "Sales Amount",
            "Purchase Quantity",
            "Purchase Amount",
        ]
    )
    for outlet in outlets:
        worksheet.append(
            [
                outlet["name"],
                outlet["item_count"],
                outlet["sales_quantity"],
                outlet["sales_amount"],
                outlet["purchase_quantity"],
                outlet["purchase_amount"],
            ]
        )

    if outlets:
        table = Table(displayName="OutletMasterSummary", ref=f"A1:F{len(outlets) + 1}")
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        worksheet.add_table(table)

    worksheet.freeze_panes = "A2"
    for column, width in {"A": 32, "B": 16, "C": 20, "D": 18, "E": 22, "F": 20}.items():
        worksheet.column_dimensions[column].width = width
    for row_idx in range(2, worksheet.max_row + 1):
        for column_idx in range(3, 7):
            worksheet.cell(row_idx, column_idx).number_format = "#,##0.00"

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


async def parse_combined_uploads(sales_file: UploadFile, purchase_file: UploadFile) -> List[dict]:
    files = (("sales", sales_file), ("purchase", purchase_file))
    reports = {}

    for report_type, uploaded_file in files:
        filename = uploaded_file.filename or ""
        if not filename.lower().endswith((".xlsx", ".xlsm", ".xls", ".csv")):
            raise HTTPException(
                status_code=400,
                detail=f"{report_type.title()} file must be .xlsx, .xlsm, .xls, or .csv.",
            )

        content = await uploaded_file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"{report_type.title()} file is empty.")

        try:
            report = await asyncio.to_thread(
                ParserManager.parse,
                file_bytes=content,
                filename=filename,
                report_type=report_type,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Could not read the {report_type} Excel file: {exc}",
            ) from exc

        if not report.records:
            detail = (
                f"No {report_type} rows could be read from '{filename}'. "
                "Check that the report worksheet has column headers for both the outlet "
                "(for example Outlet, Store, Branch, or Location) and recipe/item "
                "(for example Recipe, Recipe Name, Item, Product, or Description), "
                "with data rows below the headers."
            )
            warnings = " ".join(report.warnings)
            if "could not detect outlet and recipe/item column headers" in warnings.lower():
                sheet = f" on worksheet '{report.sheet_name}'" if report.sheet_name else ""
                detail = (
                    f"No {report_type} rows could be read from '{filename}'{sheet}: "
                    f"{warnings} If your column labels differ, share the exact outlet and recipe/item header names."
                )
            elif "not contain enough rows" in warnings.lower():
                sheet = f" '{report.sheet_name}'" if report.sheet_name else ""
                detail = f"No {report_type} item rows were found in worksheet{sheet} of '{filename}'. The worksheet is empty or too short."
            raise HTTPException(status_code=400, detail=detail)
        reports[report_type] = report

    rows = merge_report_records(reports["sales"], reports["purchase"])
    if not rows:
        raise HTTPException(status_code=400, detail="No usable outlet and item rows were found.")
    return rows


def summarize_outlets(rows: List[dict]) -> List[dict]:
    summaries: Dict[str, dict] = {}
    for row in rows:
        summary = summaries.setdefault(
            row["outlet"],
            {
                "name": row["outlet"],
                "item_count": 0,
                "sales_quantity": 0.0,
                "sales_amount": 0.0,
                "purchase_quantity": 0.0,
                "purchase_amount": 0.0,
                "purchase_amount_estimated": False,
                "sales_amount_available": True,
                "purchase_amount_available": True,
            },
        )
        summary["item_count"] += 1
        summary["sales_quantity"] += row["sales_quantity"]
        summary["purchase_quantity"] += row["purchase_quantity"]
        summary["purchase_amount_estimated"] = (
            summary["purchase_amount_estimated"] or row["purchase_amount_estimated"]
        )
        for report_type in ("sales", "purchase"):
            amount = row[f"{report_type}_amount"]
            if amount is None:
                summary[f"{report_type}_amount_available"] = False
            else:
                summary[f"{report_type}_amount"] += amount

    results = list(summaries.values())
    for summary in results:
        for report_type in ("sales", "purchase"):
            if not summary[f"{report_type}_amount_available"]:
                summary[f"{report_type}_amount"] = None
            else:
                summary[f"{report_type}_amount"] = round(summary[f"{report_type}_amount"], 2)
            del summary[f"{report_type}_amount_available"]
        summary["sales_quantity"] = round(summary["sales_quantity"], 2)
        summary["purchase_quantity"] = round(summary["purchase_quantity"], 2)
    return sorted(results, key=lambda summary: summary["name"].casefold())


@router.post("/preview")
async def preview_combined_table(
    sales_file: UploadFile = File(...),
    purchase_file: UploadFile = File(...),
):
    rows = await parse_combined_uploads(sales_file, purchase_file)
    return {
        "total_rows": len(rows),
        "outlets": summarize_outlets(rows),
        "rows": rows,
    }


@router.post("/export")
async def export_combined_table(
    sales_file: UploadFile = File(...),
    purchase_file: UploadFile = File(...),
    outlet_name: str = Form(""),
):
    rows = await parse_combined_uploads(sales_file, purchase_file)
    if outlet_name.strip():
        outlet_key = normalize_text(outlet_name)
        rows = [row for row in rows if normalize_text(row["outlet"]) == outlet_key]
        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No sales or purchase rows were found for outlet '{outlet_name}'.",
            )

    workbook = create_combined_workbook(rows)
    if outlet_name.strip():
        outlet_slug = re.sub(r"[^a-z0-9]+", "_", outlet_name.casefold()).strip("_")
        filename = f"{outlet_slug or 'outlet'}_sales_purchase.xlsx"
    else:
        filename = "sales_purchase_combined.xlsx"
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Outlet-Name": rows[0]["outlet"] if outlet_name.strip() else "all",
            "X-Record-Count": str(len(rows)),
        },
    )


@router.post("/export-master")
async def export_master_summary(
    sales_file: UploadFile = File(...),
    purchase_file: UploadFile = File(...),
):
    rows = await parse_combined_uploads(sales_file, purchase_file)
    outlets = summarize_outlets(rows)
    workbook = create_master_workbook(outlets)
    return Response(
        content=workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="sales_purchase_master_summary.xlsx"',
            "X-Record-Count": str(len(outlets)),
        },
    )
