import io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from backend.database import get_db
from backend.models import Outlet, SalesRecord, PurchaseRecord
from backend.routers.analytics import get_outlet_detail, get_master_merged_rows

router = APIRouter(prefix="/api/exports", tags=["Exports"])


def get_excel_styles():
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=10)
    thin_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB')
    )
    return header_fill, header_font, bold_font, regular_font, thin_border


@router.get("/outlet/{outlet_id}/excel")
def export_outlet_excel(
    outlet_id: int,
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    detail = get_outlet_detail(outlet_id, date_filter, start_date, end_date, db)
    outlet = detail.outlet
    kpis = detail.kpis
    items = detail.items

    wb = openpyxl.Workbook()
    # Sheet 1: Executive Summary & Comparison
    ws = wb.active
    ws.title = "Outlet Analytics"
    ws.views.sheetView[0].showGridLines = True

    h_fill, h_font, b_font, r_font, border = get_excel_styles()

    # Title Banner
    ws.merge_cells("A1:G1")
    title_cell = ws["A1"]
    title_cell.value = f"OUTLET REPORT: {outlet.official_name.upper()}"
    title_cell.font = Font(name="Calibri", size=16, bold=True, color="1E3A8A")
    title_cell.alignment = Alignment(horizontal="left", vertical="center")

    ws["A2"] = f"Code: {outlet.code or 'N/A'} | City: {outlet.city or 'N/A'} | Date Filter: {date_filter.upper()}"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="4B5563")

    # KPI Table
    ws["A4"] = "METRIC"
    ws["B4"] = "SALES"
    ws["C4"] = "PURCHASE"
    ws["D4"] = "VARIANCE (S - P)"
    for col in ["A", "B", "C", "D"]:
        cell = ws[f"{col}4"]
        cell.fill = h_fill
        cell.font = h_font
        cell.alignment = Alignment(horizontal="center")

    kpi_rows = [
        ("Total Amount (₹)", kpis.sales_amount, kpis.purchase_amount, kpis.diff_amount),
        ("Total Quantity", kpis.sales_quantity, kpis.purchase_quantity, kpis.diff_quantity),
        ("Distinct Items", kpis.sales_items_count, kpis.purchase_items_count, kpis.sales_items_count - kpis.purchase_items_count),
        ("Average Per Item (₹)", kpis.sales_avg_per_item or "N/A", kpis.purchase_avg_per_item or "N/A", "-")
    ]

    for idx, (lbl, s, p, v) in enumerate(kpi_rows, start=5):
        ws[f"A{idx}"] = lbl
        ws[f"B{idx}"] = s
        ws[f"C{idx}"] = p
        ws[f"D{idx}"] = v
        for col in ["A", "B", "C", "D"]:
            c = ws[f"{col}{idx}"]
            c.font = r_font
            c.border = border
            if col in ("B", "C", "D") and isinstance(s, (int, float)):
                c.number_format = "#,##0.00"

    # Item Comparison Table
    start_table_row = 11
    ws[f"A{start_table_row}"] = "ITEM-WISE SALES VS PURCHASE BREAKDOWN"
    ws[f"A{start_table_row}"].font = Font(name="Calibri", size=13, bold=True, color="1E3A8A")

    table_headers = [
        "Item Name", "Item Code", "Sales Qty", "Sales Amount (₹)", "Sales Avg (₹)",
        "Purchase Qty", "Purchase Amount (₹)", "Purchase Avg (₹)", "Qty Diff", "Amount Diff (₹)", "Status"
    ]

    th_row = start_table_row + 1
    for col_idx, th in enumerate(table_headers, start=1):
        cell = ws.cell(th_row, col_idx, th)
        cell.fill = h_fill
        cell.font = h_font
        cell.alignment = Alignment(horizontal="center")

    cur_row = th_row + 1
    for itm in items:
        status_label = "Both" if itm.status == "both" else ("Sales Only" if itm.status == "sold_only" else "Purchase Only")
        row_vals = [
            itm.item_name,
            itm.item_code or "N/A",
            itm.sales_qty,
            itm.sales_amount,
            itm.sales_avg_price or "N/A",
            itm.purchase_qty,
            itm.purchase_amount,
            itm.purchase_avg_price or "N/A",
            itm.diff_qty,
            itm.diff_amount,
            status_label
        ]
        for col_idx, val in enumerate(row_vals, start=1):
            c = ws.cell(cur_row, col_idx, val)
            c.font = r_font
            c.border = border
            if isinstance(val, (int, float)):
                c.number_format = "#,##0.00"
        cur_row += 1

    # Adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Outlet_{outlet.official_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/outlet/{outlet_id}/pdf")
def export_outlet_pdf(
    outlet_id: int,
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    detail = get_outlet_detail(outlet_id, date_filter, start_date, end_date, db)
    outlet = detail.outlet
    kpis = detail.kpis
    items = detail.items

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E3A8A')
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#4B5563')
    )

    story = []

    # Title & Metadata
    story.append(Paragraph(f"Outlet Analytics Report: {outlet.official_name}", title_style))
    story.append(Paragraph(f"Code: {outlet.code or 'N/A'} | City: {outlet.city or 'N/A'} | Generated: {datetime.utcnow().strftime('%d-%b-%Y %H:%M')}", subtitle_style))
    story.append(Spacer(1, 15))

    # KPI Table
    kpi_data = [
        ["Metric", "Sales", "Purchase", "Variance (Sales - Purchase)"],
        ["Total Amount", f"Rs. {kpis.sales_amount:,.2f}", f"Rs. {kpis.purchase_amount:,.2f}", f"Rs. {kpis.diff_amount:,.2f} ({kpis.diff_pct or 0:.1f}%)"],
        ["Total Quantity", f"{kpis.sales_quantity:,.1f}", f"{kpis.purchase_quantity:,.1f}", f"{kpis.diff_quantity:,.1f}"],
        ["Distinct Items", str(kpis.sales_items_count), str(kpis.purchase_items_count), str(kpis.sales_items_count - kpis.purchase_items_count)],
    ]
    t_kpi = Table(kpi_data, colWidths=[180, 180, 180, 180])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 15))

    # Top Items Breakdown Table (up to 20 for PDF fit)
    story.append(Paragraph("Item-Wise Sales & Purchase Comparison (Top 25 Items)", styles['Heading3']))
    story.append(Spacer(1, 6))

    item_table_data = [
        ["Item Name", "Sales Qty", "Sales Amt (Rs.)", "Purch Qty", "Purch Amt (Rs.)", "Diff Amt (Rs.)", "Status"]
    ]
    for itm in items[:25]:
        status_txt = "Both" if itm.status == "both" else ("Sold Only" if itm.status == "sold_only" else "Purch Only")
        item_table_data.append([
            itm.item_name[:30],
            f"{itm.sales_qty:,.1f}",
            f"{itm.sales_amount:,.2f}",
            f"{itm.purchase_qty:,.1f}",
            f"{itm.purchase_amount:,.2f}",
            f"{itm.diff_amount:,.2f}",
            status_txt
        ])

    t_items = Table(item_table_data, colWidths=[200, 85, 95, 85, 95, 95, 85])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563EB')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(t_items)

    doc.build(story)
    buffer.seek(0)

    filename = f"Outlet_{outlet.official_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/all-outlets/excel")
def export_all_outlets_excel(db: Session = Depends(get_db)):
    from backend.routers.analytics import get_all_outlets_summary
    data = get_all_outlets_summary(limit=1000, db=db)
    outlets = data["outlets"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Franchise Outlets Summary"
    ws.views.sheetView[0].showGridLines = True

    h_fill, h_font, b_font, r_font, border = get_excel_styles()

    ws.merge_cells("A1:I1")
    title_cell = ws["A1"]
    title_cell.value = "FRANCHISE OUTLETS SALES & PURCHASE SUMMARY"
    title_cell.font = Font(name="Calibri", size=15, bold=True, color="1E3A8A")

    headers = [
        "Outlet Name", "Code", "City", "Sales Amount (₹)", "Purchase Amount (₹)",
        "Sales Qty", "Purchase Qty", "Variance (₹)", "Variance %"
    ]
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(3, col_idx, h)
        c.fill = h_fill
        c.font = h_font
        c.alignment = Alignment(horizontal="center")

    for r_idx, o in enumerate(outlets, start=4):
        vals = [
            o.official_name, o.code or "", o.city or "",
            o.sales_amount, o.purchase_amount,
            o.sales_qty, o.purchase_qty,
            o.diff_amount, o.diff_pct or ""
        ]
        for c_idx, v in enumerate(vals, start=1):
            c = ws.cell(r_idx, c_idx, v)
            c.font = r_font
            c.border = border
            if isinstance(v, (int, float)):
                c.number_format = "#,##0.00"

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"All_Outlets_Summary_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/master-merged-excel")
def export_master_merged_excel(
    outlet_id: Optional[int] = None,
    item_search: Optional[str] = None,
    status: str = "all",
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    rows = get_master_merged_rows(
        outlet_id=outlet_id,
        item_search=item_search,
        status_filter=status,
        date_filter=date_filter,
        start_date=start_date,
        end_date=end_date,
        db=db
    )

    wb = openpyxl.Workbook()
    # Sheet 1: Master Merged Table
    ws1 = wb.active
    ws1.title = "Master Merged Report"
    ws1.views.sheetView[0].showGridLines = True

    h_fill, h_font, b_font, r_font, border = get_excel_styles()
    green_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")

    # Title
    ws1.merge_cells("A1:K1")
    t_cell = ws1["A1"]
    t_cell.value = "MASTER UNIFIED SALES & PURCHASE RECONCILIATION TABLE"
    t_cell.font = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
    ws1["A2"] = f"Generated: {datetime.utcnow().strftime('%d-%b-%Y %H:%M UTC')} | Period: {date_filter.upper()} | Total Rows: {len(rows)}"
    ws1["A2"].font = Font(name="Calibri", size=10, italic=True, color="4B5563")

    headers = [
        "Master Outlet Name", "Outlet Code", "City", "Item Name", "Item Code",
        "Purchase Qty", "Purchase Amt (₹)", "Sales Qty", "Sales Amt (₹)",
        "Variance Qty (S - P)", "Variance Amt (₹)", "Status"
    ]
    for c_i, h in enumerate(headers, start=1):
        cell = ws1.cell(4, c_i, h)
        cell.fill = h_fill
        cell.font = h_font
        cell.alignment = Alignment(horizontal="center")

    for r_i, r in enumerate(rows, start=5):
        st_label = "Both" if r.status == "both" else ("Sold Only" if r.status == "sold_only" else "Purchased Only")
        row_vals = [
            r.outlet_name, r.outlet_code or "", r.city or "",
            r.item_name, r.item_code or "",
            r.purchase_qty, r.purchase_amount,
            r.sales_qty, r.sales_amount,
            r.diff_qty, r.diff_amount,
            st_label
        ]
        for c_i, val in enumerate(row_vals, start=1):
            c = ws1.cell(r_i, c_i, val)
            c.font = r_font
            c.border = border
            if isinstance(val, (int, float)):
                c.number_format = "#,##0.00"
            if c_i == 11 and isinstance(val, (int, float)):  # Variance Amt
                if val > 0:
                    c.fill = green_fill
                elif val < 0:
                    c.fill = red_fill

    for col in ws1.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws1.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # Sheet 2: Variance / Discrepancy Only Sheet
    variance_rows = [r for r in rows if r.diff_amount != 0 or r.diff_qty != 0]
    ws2 = wb.create_sheet(title="Variance Highlights")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells("A1:I1")
    t2 = ws2["A1"]
    t2.value = "DISCREPANCY & OPERATIONAL VARIANCE HIGHLIGHTS"
    t2.font = Font(name="Calibri", size=14, bold=True, color="991B1B")

    v_headers = [
        "Master Outlet", "Item Name", "Purchase Qty", "Purchase Amt (₹)",
        "Sales Qty", "Sales Amt (₹)", "Variance Qty", "Variance Amt (₹)", "Status"
    ]
    for c_i, h in enumerate(v_headers, start=1):
        cell = ws2.cell(3, c_i, h)
        cell.fill = PatternFill(start_color="991B1B", end_color="991B1B", fill_type="solid")
        cell.font = h_font
        cell.alignment = Alignment(horizontal="center")

    for r_i, r in enumerate(variance_rows, start=4):
        st_label = "Both" if r.status == "both" else ("Sold Only" if r.status == "sold_only" else "Purchased Only")
        vals = [
            r.outlet_name, r.item_name,
            r.purchase_qty, r.purchase_amount,
            r.sales_qty, r.sales_amount,
            r.diff_qty, r.diff_amount,
            st_label
        ]
        for c_i, val in enumerate(vals, start=1):
            c = ws2.cell(r_i, c_i, val)
            c.font = r_font
            c.border = border
            if isinstance(val, (int, float)):
                c.number_format = "#,##0.00"

    for col in ws2.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws2.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Master_Unified_Sales_Purchase_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/category-analysis-excel")
def export_category_analysis_excel():
    """
    Downloads the 10-sheet Consolidated Category, Combo, Recipe & Unit Discrepancy Analysis Workbook.
    Sheets included:
      1. Beverages (Hot & Cold Coffee, Chocolates, Shakes)
      2. Burgers (Individual + Combo Sales vs Buns Purchased)
      3. Pizzas (Individual + Combo Sales vs Pizza Bases Purchased)
      4. Sandwiches (Individual + Combo Sales vs Sandwich Bread Purchased)
      5. Garlic Bread (Individual + Combo Sales vs Purchases)
      6. French Fries (Individual + Combo Sales vs Fries kg Purchased)
      7. Combos (19 combo component disaggregations)
      8. Recipe Details (34 raw material pack specs & unit multipliers)
      9. Outlet Summary (Executive outlet-wise balance)
      10. Grand Summary (Reconciliation across all menu items)
    """
    import os
    report_path = os.path.join("d:\\SPpro", "Consolidated_Sales_Purchase_Analysis_Report.xlsx")
    if not os.path.exists(report_path):
        report_path = os.path.join("d:\\SPpro", "reports", "Item_Wise_Category_Sales_Purchase_Analysis.xlsx")
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Consolidated analysis report workbook not found on server.")

    with open(report_path, "rb") as f:
        content = f.read()

    filename = "Consolidated_Sales_Purchase_Analysis_Report.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/item-excel")
def export_individual_item_excel(item_name: str = Query(..., description="Item name to export")):
    """
    Generates and downloads a dedicated Excel report for any single individual item
    consolidating its direct individual sales, combo decomposition, total consumption,
    and outlet-by-outlet reconciliation.
    """
    from backend.analysis.item_combo_service import item_service
    content = item_service.generate_item_excel(item_name)
    clean_filename = "".join(c if c.isalnum() or c in (' ', '_', '-') else '_' for c in item_name).strip()
    filename = f"Item_Analysis_{clean_filename}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



