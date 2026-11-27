from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from backend.database import get_db
from backend.models import (
    Outlet, Item, SalesRecord, PurchaseRecord, ImportBatch
)
from backend.schemas import (
    OutletDetailResponse, OutletResponse, OutletKPIs,
    ItemComparisonRow, ChartDataPoint, AllOutletsRow,
    DashboardSummaryResponse, ImportBatchResponse,
    MasterMergedRow, MasterMergedResponse
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def compute_date_bounds(
    date_filter: str,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None
# pyrefly: ignore[invalid-annotation]
) -> (Optional[str], Optional[str]):
    today = datetime.utcnow().date()
    if date_filter == "today":
        d_str = today.strftime("%Y-%m-%d")
        return d_str, d_str
    elif date_filter == "this_week":
        start_week = today - timedelta(days=today.weekday())
        return start_week.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")
    elif date_filter == "this_month":
        start_month = today.replace(day=1)
        return start_month.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")
    elif date_filter == "custom":
        return custom_start, custom_end
    return None, None


@router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_sales_amt = db.query(func.coalesce(func.sum(SalesRecord.amount), 0.0)).scalar() or 0.0
    total_sales_qty = db.query(func.coalesce(func.sum(SalesRecord.quantity), 0.0)).scalar() or 0.0

    total_purchase_amt = db.query(func.coalesce(func.sum(PurchaseRecord.amount), 0.0)).scalar() or 0.0
    total_purchase_qty = db.query(func.coalesce(func.sum(PurchaseRecord.quantity), 0.0)).scalar() or 0.0

    net_diff = total_sales_amt - total_purchase_amt
    total_outlets = db.query(Outlet).filter(Outlet.is_active == True).count()
    total_batches = db.query(ImportBatch).count()
    sales_batches = db.query(ImportBatch).filter(ImportBatch.report_type == "sales").count()
    purchase_batches = db.query(ImportBatch).filter(ImportBatch.report_type == "purchase").count()

    # Top selling items
    top_selling_rows = (
        db.query(
            SalesRecord.raw_item_name,
            func.sum(SalesRecord.amount).label("tot_amt"),
            func.sum(SalesRecord.quantity).label("tot_qty")
        )
        .group_by(SalesRecord.raw_item_name)
        .order_by(desc("tot_amt"))
        .limit(10)
        .all()
    )
    top_selling = [
        ChartDataPoint(
            label=r[0],
            sales=round(float(r[1] or 0), 2),
            sales_qty=round(float(r[2] or 0), 2)
        )
        for r in top_selling_rows
    ]

    # Top purchased items
    top_purchased_rows = (
        db.query(
            PurchaseRecord.raw_item_name,
            func.sum(PurchaseRecord.amount).label("tot_amt"),
            func.sum(PurchaseRecord.quantity).label("tot_qty")
        )
        .group_by(PurchaseRecord.raw_item_name)
        .order_by(desc("tot_amt"))
        .limit(10)
        .all()
    )
    top_purchased = [
        ChartDataPoint(
            label=r[0],
            purchase=round(float(r[1] or 0), 2),
            purchase_qty=round(float(r[2] or 0), 2)
        )
        for r in top_purchased_rows
    ]

    # Recent batches
    recent_batches = (
        db.query(ImportBatch)
        .order_by(ImportBatch.created_at.desc())
        .limit(5)
        .all()
    )

    # Top outlets
    outlets = db.query(Outlet).filter(Outlet.is_active == True).all()
    top_outlets_list = []
    for o in outlets:
        s_amt = db.query(func.coalesce(func.sum(SalesRecord.amount), 0.0)).filter(SalesRecord.outlet_id == o.id).scalar() or 0.0
        p_amt = db.query(func.coalesce(func.sum(PurchaseRecord.amount), 0.0)).filter(PurchaseRecord.outlet_id == o.id).scalar() or 0.0
        s_qty = db.query(func.coalesce(func.sum(SalesRecord.quantity), 0.0)).filter(SalesRecord.outlet_id == o.id).scalar() or 0.0
        p_qty = db.query(func.coalesce(func.sum(PurchaseRecord.quantity), 0.0)).filter(PurchaseRecord.outlet_id == o.id).scalar() or 0.0

        if s_amt > 0 or p_amt > 0:
            diff = s_amt - p_amt
            pct = round((diff / p_amt) * 100, 1) if p_amt > 0 else None
            top_outlets_list.append(
                AllOutletsRow(
                    id=o.id,
                    official_name=o.official_name,
                    code=o.code,
                    city=o.city,
                    sales_amount=round(float(s_amt), 2),
                    purchase_amount=round(float(p_amt), 2),
                    sales_qty=round(float(s_qty), 2),
                    purchase_qty=round(float(p_qty), 2),
                    diff_amount=round(float(diff), 2),
                    diff_pct=pct
                )
            )

    top_outlets_list.sort(key=lambda x: x.sales_amount, reverse=True)

    return DashboardSummaryResponse(
        total_sales_amount=round(float(total_sales_amt), 2),
        total_purchase_amount=round(float(total_purchase_amt), 2),
        total_sales_qty=round(float(total_sales_qty), 2),
        total_purchase_qty=round(float(total_purchase_qty), 2),
        net_diff_amount=round(float(net_diff), 2),
        total_outlets=total_outlets,
        total_batches=total_batches,
        sales_batches_count=sales_batches,
        purchase_batches_count=purchase_batches,
        top_outlets=top_outlets_list[:6],
        top_selling_items=top_selling,
        top_purchased_items=top_purchased,
        recent_batches=[ImportBatchResponse.from_orm(b) for b in recent_batches]
    )


@router.get("/outlet/{outlet_id}", response_model=OutletDetailResponse)
def get_outlet_detail(
    outlet_id: int,
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    outlet = db.query(Outlet).filter(Outlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    s_d, e_d = compute_date_bounds(date_filter, start_date, end_date)

    # Base queries for sales & purchase
    sales_q = db.query(SalesRecord).filter(SalesRecord.outlet_id == outlet.id)
    purchase_q = db.query(PurchaseRecord).filter(PurchaseRecord.outlet_id == outlet.id)

    if s_d:
        sales_q = sales_q.filter(SalesRecord.transaction_date >= s_d)
        purchase_q = purchase_q.filter(PurchaseRecord.transaction_date >= s_d)
    if e_d:
        sales_q = sales_q.filter(SalesRecord.transaction_date <= e_d)
        purchase_q = purchase_q.filter(PurchaseRecord.transaction_date <= e_d)

    sales_records = sales_q.all()
    purchase_records = purchase_q.all()

    # Aggregate Sales by item
    sales_by_item: Dict[str, Dict] = {}
    tot_sales_amt = 0.0
    tot_sales_qty = 0.0

    for r in sales_records:
        name = r.raw_item_name
        if name not in sales_by_item:
            sales_by_item[name] = {"qty": 0.0, "amount": 0.0, "code": r.item_code}
        sales_by_item[name]["qty"] += r.quantity
        sales_by_item[name]["amount"] += r.amount
        tot_sales_amt += r.amount
        tot_sales_qty += r.quantity

    # Aggregate Purchase by item
    purchase_by_item: Dict[str, Dict] = {}
    tot_purchase_amt = 0.0
    tot_purchase_qty = 0.0

    for r in purchase_records:
        name = r.raw_item_name
        if name not in purchase_by_item:
            purchase_by_item[name] = {"qty": 0.0, "amount": 0.0, "code": r.item_code}
        purchase_by_item[name]["qty"] += r.quantity
        purchase_by_item[name]["amount"] += r.amount
        tot_purchase_amt += r.amount
        tot_purchase_qty += r.quantity

    # Calculate KPIs
    sales_items_count = len(sales_by_item)
    purchase_items_count = len(purchase_by_item)
    sales_avg = round(tot_sales_amt / sales_items_count, 2) if sales_items_count > 0 else None
    purchase_avg = round(tot_purchase_amt / purchase_items_count, 2) if purchase_items_count > 0 else None

    diff_amt = tot_sales_amt - tot_purchase_amt
    diff_qty = tot_sales_qty - tot_purchase_qty
    diff_pct = round((diff_amt / tot_purchase_amt) * 100, 1) if tot_purchase_amt > 0 else None

    kpis = OutletKPIs(
        sales_amount=round(tot_sales_amt, 2),
        sales_quantity=round(tot_sales_qty, 2),
        sales_items_count=sales_items_count,
        sales_avg_per_item=sales_avg,
        purchase_amount=round(tot_purchase_amt, 2),
        purchase_quantity=round(tot_purchase_qty, 2),
        purchase_items_count=purchase_items_count,
        purchase_avg_per_item=purchase_avg,
        diff_amount=round(diff_amt, 2),
        diff_quantity=round(diff_qty, 2),
        diff_pct=diff_pct
    )

    # Combine items comparison
    all_item_names = set(sales_by_item.keys()).union(set(purchase_by_item.keys()))
    items_comparison = []

    for item_name in all_item_names:
        s_data = sales_by_item.get(item_name, {"qty": 0.0, "amount": 0.0, "code": None})
        p_data = purchase_by_item.get(item_name, {"qty": 0.0, "amount": 0.0, "code": None})

        s_q = s_data["qty"]
        s_a = s_data["amount"]
        p_q = p_data["qty"]
        p_a = p_data["amount"]

        s_avg_p = round(s_a / s_q, 2) if s_q > 0 and s_a > 0 else None
        p_avg_p = round(p_a / p_q, 2) if p_q > 0 and p_a > 0 else None

        d_q = s_q - p_q
        d_a = s_a - p_a

        if s_q > 0 and p_q > 0:
            status = "both"
        elif s_q > 0:
            status = "sold_only"
        else:
            status = "purchased_only"

        items_comparison.append(
            ItemComparisonRow(
                item_name=item_name,
                item_code=s_data.get("code") or p_data.get("code"),
                sales_qty=round(s_q, 2),
                sales_amount=round(s_a, 2),
                sales_avg_price=s_avg_p,
                purchase_qty=round(p_q, 2),
                purchase_amount=round(p_a, 2),
                purchase_avg_price=p_avg_p,
                diff_qty=round(d_q, 2),
                diff_amount=round(d_a, 2),
                status=status
            )
        )

    # Sort items comparison: highest sales amount first
    items_comparison.sort(key=lambda x: (x.sales_amount, x.purchase_amount), reverse=True)

    # Charts data
    top_selling_chart = [
        ChartDataPoint(
            label=row.item_name,
            sales=row.sales_amount,
            sales_qty=row.sales_qty
        )
        for row in sorted(items_comparison, key=lambda x: x.sales_amount, reverse=True)[:10]
        if row.sales_amount > 0 or row.sales_qty > 0
    ]

    top_purchased_chart = [
        ChartDataPoint(
            label=row.item_name,
            purchase=row.purchase_amount,
            purchase_qty=row.purchase_qty
        )
        for row in sorted(items_comparison, key=lambda x: x.purchase_amount, reverse=True)[:10]
        if row.purchase_amount > 0 or row.purchase_qty > 0
    ]

    overview_chart = [
        ChartDataPoint(
            label="Total Amount (₹)",
            sales=round(tot_sales_amt, 2),
            purchase=round(tot_purchase_amt, 2)
        ),
        ChartDataPoint(
            label="Total Quantity",
            sales_qty=round(tot_sales_qty, 2),
            purchase_qty=round(tot_purchase_qty, 2)
        )
    ]

    return OutletDetailResponse(
        outlet=OutletResponse.from_orm(outlet),
        date_filter=date_filter,
        start_date=s_d,
        end_date=e_d,
        kpis=kpis,
        items=items_comparison,
        top_selling_items=top_selling_chart,
        top_purchased_items=top_purchased_chart,
        overview_chart=overview_chart
    )


@router.get("/all-outlets", response_model=Dict[str, Any])
def get_all_outlets_summary(
    q: Optional[str] = None,
    sort_by: str = "sales_amount",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 25,
    db: Session = Depends(get_db)
):
    query = db.query(Outlet).filter(Outlet.is_active == True)
    if q:
        query = query.filter(
            or_(
                Outlet.official_name.ilike(f"%{q}%"),
                Outlet.code.ilike(f"%{q}%"),
                Outlet.city.ilike(f"%{q}%")
            )
        )

    all_outlets = query.all()
    rows = []

    for o in all_outlets:
        s_amt = db.query(func.coalesce(func.sum(SalesRecord.amount), 0.0)).filter(SalesRecord.outlet_id == o.id).scalar() or 0.0
        p_amt = db.query(func.coalesce(func.sum(PurchaseRecord.amount), 0.0)).filter(PurchaseRecord.outlet_id == o.id).scalar() or 0.0
        s_qty = db.query(func.coalesce(func.sum(SalesRecord.quantity), 0.0)).filter(SalesRecord.outlet_id == o.id).scalar() or 0.0
        p_qty = db.query(func.coalesce(func.sum(PurchaseRecord.quantity), 0.0)).filter(PurchaseRecord.outlet_id == o.id).scalar() or 0.0

        s_items = db.query(SalesRecord.raw_item_name).filter(SalesRecord.outlet_id == o.id).distinct().count()
        p_items = db.query(PurchaseRecord.raw_item_name).filter(PurchaseRecord.outlet_id == o.id).distinct().count()

        diff_amt = s_amt - p_amt
        pct = round((diff_amt / p_amt) * 100, 1) if p_amt > 0 else None

        rows.append(
            AllOutletsRow(
                id=o.id,
                official_name=o.official_name,
                code=o.code,
                city=o.city,
                sales_amount=round(float(s_amt), 2),
                purchase_amount=round(float(p_amt), 2),
                sales_qty=round(float(s_qty), 2),
                purchase_qty=round(float(p_qty), 2),
                diff_amount=round(float(diff_amt), 2),
                diff_pct=pct,
                items_sold_count=s_items,
                items_purchased_count=p_items
            )
        )

    # Sorting
    reverse = (sort_order.lower() == "desc")
    if hasattr(AllOutletsRow, sort_by):
        rows.sort(key=lambda x: getattr(x, sort_by) or 0, reverse=reverse)
    else:
        rows.sort(key=lambda x: x.sales_amount, reverse=True)

    total_count = len(rows)
    start_idx = (page - 1) * limit
    paginated_rows = rows[start_idx : start_idx + limit]

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "outlets": paginated_rows
    }


def get_master_merged_rows(
    outlet_id: Optional[int] = None,
    item_search: Optional[str] = None,
    status_filter: str = "all",
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = None
) -> List[MasterMergedRow]:
    s_d, e_d = compute_date_bounds(date_filter, start_date, end_date)

    outlets = db.query(Outlet).all()
    outlets_map = {o.id: o for o in outlets}

    # Query Sales
    sales_q = db.query(
        SalesRecord.outlet_id,
        SalesRecord.raw_item_name,
        func.max(SalesRecord.item_code).label("item_code"),
        func.sum(SalesRecord.quantity).label("sales_qty"),
        func.sum(SalesRecord.amount).label("sales_amount")
    )
    if outlet_id:
        sales_q = sales_q.filter(SalesRecord.outlet_id == outlet_id)
    if s_d:
        sales_q = sales_q.filter(SalesRecord.transaction_date >= s_d)
    if e_d:
        sales_q = sales_q.filter(SalesRecord.transaction_date <= e_d)
    sales_q = sales_q.group_by(SalesRecord.outlet_id, SalesRecord.raw_item_name)
    sales_rows = sales_q.all()

    # Query Purchase
    purchase_q = db.query(
        PurchaseRecord.outlet_id,
        PurchaseRecord.raw_item_name,
        func.max(PurchaseRecord.item_code).label("item_code"),
        func.sum(PurchaseRecord.quantity).label("purchase_qty"),
        func.sum(PurchaseRecord.amount).label("purchase_amount")
    )
    if outlet_id:
        purchase_q = purchase_q.filter(PurchaseRecord.outlet_id == outlet_id)
    if s_d:
        purchase_q = purchase_q.filter(PurchaseRecord.transaction_date >= s_d)
    if e_d:
        purchase_q = purchase_q.filter(PurchaseRecord.transaction_date <= e_d)
    purchase_q = purchase_q.group_by(PurchaseRecord.outlet_id, PurchaseRecord.raw_item_name)
    purchase_rows = purchase_q.all()

    merged_dict: Dict[Tuple[int, str], Dict[str, Any]] = {}

    for r in sales_rows:
        o_id = r[0] or 0
        itm = (r[1] or "").strip()
        key = (o_id, itm.lower())
        merged_dict[key] = {
            "outlet_id": o_id,
            "item_name": itm,
            "item_code": r[2],
            "sales_qty": float(r[3] or 0.0),
            "sales_amount": float(r[4] or 0.0),
            "purchase_qty": 0.0,
            "purchase_amount": 0.0,
        }

    for r in purchase_rows:
        o_id = r[0] or 0
        itm = (r[1] or "").strip()
        key = (o_id, itm.lower())
        if key not in merged_dict:
            merged_dict[key] = {
                "outlet_id": o_id,
                "item_name": itm,
                "item_code": r[2],
                "sales_qty": 0.0,
                "sales_amount": 0.0,
                "purchase_qty": float(r[3] or 0.0),
                "purchase_amount": float(r[4] or 0.0),
            }
        else:
            merged_dict[key]["purchase_qty"] += float(r[3] or 0.0)
            merged_dict[key]["purchase_amount"] += float(r[4] or 0.0)
            if not merged_dict[key]["item_code"] and r[2]:
                merged_dict[key]["item_code"] = r[2]

    result_rows: List[MasterMergedRow] = []

    for key, data in merged_dict.items():
        o_id = data["outlet_id"]
        o_rec = outlets_map.get(o_id)
        o_name = o_rec.official_name if o_rec else f"Outlet #{o_id} (Unmapped)"
        o_code = o_rec.code if o_rec else None
        o_city = o_rec.city if o_rec else None

        s_q = data["sales_qty"]
        s_a = data["sales_amount"]
        p_q = data["purchase_qty"]
        p_a = data["purchase_amount"]

        s_avg = round(s_a / s_q, 2) if s_q > 0 and s_a > 0 else None
        p_avg = round(p_a / p_q, 2) if p_q > 0 and p_a > 0 else None

        d_q = round(s_q - p_q, 2)
        d_a = round(s_a - p_a, 2)

        if s_q > 0 and p_q > 0:
            st = "both"
        elif s_q > 0:
            st = "sold_only"
        else:
            st = "purchased_only"

        # Apply item_search filter
        if item_search:
            search_lower = item_search.lower()
            if search_lower not in data["item_name"].lower() and (not data["item_code"] or search_lower not in data["item_code"].lower()):
                continue

        # Apply status filter
        if status_filter == "both" and st != "both":
            continue
        elif status_filter == "sold_only" and st != "sold_only":
            continue
        elif status_filter == "purchased_only" and st != "purchased_only":
            continue
        elif status_filter == "variance_only" and d_q == 0.0 and d_a == 0.0:
            continue

        result_rows.append(
            MasterMergedRow(
                outlet_id=o_id,
                outlet_name=o_name,
                outlet_code=o_code,
                city=o_city,
                item_name=data["item_name"],
                item_code=data["item_code"],
                sales_qty=round(s_q, 2),
                sales_amount=round(s_a, 2),
                sales_avg_price=s_avg,
                purchase_qty=round(p_q, 2),
                purchase_amount=round(p_a, 2),
                purchase_avg_price=p_avg,
                diff_qty=d_q,
                diff_amount=d_a,
                status=st
            )
        )

    return result_rows


@router.get("/master-merged-table", response_model=MasterMergedResponse)
def get_master_merged_table(
    outlet_id: Optional[int] = None,
    item_search: Optional[str] = None,
    status: str = "all",
    date_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = "outlet_name",
    sort_order: str = "asc",
    page: int = 1,
    limit: int = 50,
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

    # Compute overall totals
    tot_s_amt = sum(r.sales_amount for r in rows)
    tot_p_amt = sum(r.purchase_amount for r in rows)
    tot_s_qty = sum(r.sales_qty for r in rows)
    tot_p_qty = sum(r.purchase_qty for r in rows)
    tot_v_amt = tot_s_amt - tot_p_amt

    # Sorting
    reverse = (sort_order.lower() == "desc")
    if hasattr(MasterMergedRow, sort_by):
        rows.sort(key=lambda x: getattr(x, sort_by) or (0 if isinstance(getattr(x, sort_by), (int, float)) else ""), reverse=reverse)
    else:
        rows.sort(key=lambda x: (x.outlet_name, x.item_name), reverse=reverse)

    total_count = len(rows)
    if limit > 0:
        start_idx = (page - 1) * limit
        paginated = rows[start_idx : start_idx + limit]
    else:
        paginated = rows

    return MasterMergedResponse(
        total=total_count,
        page=page,
        limit=limit,
        total_sales_amount=round(tot_s_amt, 2),
        total_purchase_amount=round(tot_p_amt, 2),
        total_sales_qty=round(tot_s_qty, 2),
        total_purchase_qty=round(tot_p_qty, 2),
        total_variance_amount=round(tot_v_amt, 2),
        rows=paginated
    )


_CATEGORY_ANALYSIS_CACHE = None

@router.get("/category-analysis")
def get_category_analysis(force_refresh: bool = False):
    """
    Returns complete structured data for all 10 analysis categories:
    Beverages, Burgers, Pizzas, Sandwiches, Garlic Bread, French Fries,
    Combos, Recipe Details, Outlet Summary, and Grand Summary.
    """
    global _CATEGORY_ANALYSIS_CACHE
    if _CATEGORY_ANALYSIS_CACHE and not force_refresh:
        return _CATEGORY_ANALYSIS_CACHE

    import openpyxl
    import os

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    excel_path = os.path.join(base_dir, "Consolidated_Sales_Purchase_Analysis_Report.xlsx")
    if not os.path.exists(excel_path):
        excel_path = os.path.join(base_dir, "reports", "Item_Wise_Category_Sales_Purchase_Analysis.xlsx")
    if not os.path.exists(excel_path):
        return {
            "categories": {},
            "combos": [],
            "recipes": [],
            "outlet_summary": [],
            "grand_summary": [],
        }

    def to_float(val, default=0.0):
        if val is None or val == '' or val == '-':
            return default
        try:
            return float(val)
        except:
            return default

    def to_int(val, default=0):
        return int(to_float(val, default))

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    cats = ['Beverages', 'Burgers', 'Pizzas', 'Sandwiches', 'Garlic Bread', 'French Fries']
    cat_data = {}

    for cat in cats:
        if cat not in wb.sheetnames:
            continue
        ws = wb[cat]
        items = []
        outlets = []
        reading_items = False
        reading_outlets = False
        raw_mat = ''

        r2 = str(ws.cell(2, 2).value or '')
        if 'Primary Raw Material:' in r2:
            raw_mat = r2.split('Primary Raw Material:')[-1].strip()

        for r in range(4, ws.max_row + 1):
            c1 = ws.cell(r, 1).value
            if c1 == 'A. INDIVIDUAL MENU ITEMS BREAKDOWN':
                reading_items = True
                reading_outlets = False
                continue
            elif c1 and 'B. OUTLET-WISE ANALYSIS' in str(c1):
                reading_items = False
                reading_outlets = True
                continue
            elif c1 and 'Total Individual Menu Items' in str(c1):
                reading_items = False
                continue
            elif c1 and 'Grand Total' in str(c1):
                if reading_outlets:
                    ind_q = to_float(ws.cell(r, 2).value)
                    co_q = to_float(ws.cell(r, 3).value)
                    p_units = to_float(ws.cell(r, 6).value)
                    tot_q = ind_q + co_q
                    outlets.append({
                        'outlet': 'Grand Total',
                        'individual_sales_qty': ind_q,
                        'combo_sales_qty': co_q,
                        'total_sales_qty': tot_q,
                        'purchase_packs': to_float(ws.cell(r, 5).value),
                        'purchase_units': p_units,
                        'variance': round(tot_q - p_units, 2),
                        'sales_amount': to_float(ws.cell(r, 8).value)
                    })
                reading_outlets = False
                continue

            if reading_items and c1 and c1 != 'Item Name':
                items.append({
                    'name': str(c1).replace('<br>\n', ' '),
                    'size': str(ws.cell(r, 2).value or 'Standard'),
                    'material': str(ws.cell(r, 3).value or ''),
                    'making_cost': to_float(ws.cell(r, 4).value),
                    'qty': to_float(ws.cell(r, 5).value),
                    'amount': to_float(ws.cell(r, 6).value),
                    'avg_price': round(to_float(ws.cell(r, 7).value), 2),
                    'profit': to_float(ws.cell(r, 8).value),
                    'margin': str(ws.cell(r, 9).value or '0.0%')
                })
            elif reading_outlets and c1 and c1 != 'Outlet Name':
                ind_q = to_float(ws.cell(r, 2).value)
                co_q = to_float(ws.cell(r, 3).value)
                tot_q = ind_q + co_q
                p_units = to_float(ws.cell(r, 6).value)
                outlets.append({
                    'outlet': str(c1),
                    'individual_sales_qty': ind_q,
                    'combo_sales_qty': co_q,
                    'total_sales_qty': tot_q,
                    'purchase_packs': to_float(ws.cell(r, 5).value),
                    'purchase_units': p_units,
                    'variance': round(tot_q - p_units, 2),
                    'sales_amount': to_float(ws.cell(r, 8).value)
                })
        cat_data[cat] = {'raw_material': raw_mat, 'items': items, 'outlets': outlets}

    # Combos
    combos = []
    if 'Combos' in wb.sheetnames:
        ws_co = wb['Combos']
        for r in range(5, ws_co.max_row + 1):
            c1 = ws_co.cell(r, 1).value
            if c1:
                combos.append({
                    'name': str(c1).replace('<br>\n', ' '),
                    'display_name': str(ws_co.cell(r, 2).value or ''),
                    'sold_packs': to_float(ws_co.cell(r, 3).value),
                    'sales_amount': to_float(ws_co.cell(r, 4).value),
                    'burger': to_int(ws_co.cell(r, 6).value),
                    'pizza': to_int(ws_co.cell(r, 7).value),
                    'sandwich': to_int(ws_co.cell(r, 8).value),
                    'garlic_bread': to_int(ws_co.cell(r, 9).value),
                    'fries': to_int(ws_co.cell(r, 10).value),
                    'beverage': to_int(ws_co.cell(r, 11).value),
                    'beverage_name': str(ws_co.cell(r, 12).value or '')
                })

    # Recipes
    recipes = []
    if 'Recipe Details' in wb.sheetnames:
        ws_rc = wb['Recipe Details']
        for r in range(5, ws_rc.max_row + 1):
            c1 = ws_rc.cell(r, 1).value
            if c1:
                p_disp = to_float(ws_rc.cell(r, 5).value)
                mult = to_float(ws_rc.cell(r, 3).value, 1.0)
                recipes.append({
                    'item': str(c1),
                    'pack_spec': str(ws_rc.cell(r, 2).value or ''),
                    'multiplier': mult,
                    'base_unit': str(ws_rc.cell(r, 4).value or ''),
                    'packs_dispatched': p_disp,
                    'converted_units': p_disp * mult,
                    'category': str(ws_rc.cell(r, 7).value or ''),
                    'instructions': str(ws_rc.cell(r, 8).value or '')
                })

    # Outlet Summary
    outlet_summary = []
    if 'Outlet Summary' in wb.sheetnames:
        ws_os = wb['Outlet Summary']
        for r in range(5, ws_os.max_row + 1):
            c1 = ws_os.cell(r, 1).value
            if c1:
                indiv = to_float(ws_os.cell(r, 3).value)
                combo = to_float(ws_os.cell(r, 4).value)
                outlet_summary.append({
                    'outlet': str(c1),
                    'sales_amount': to_float(ws_os.cell(r, 2).value),
                    'individual_items_qty': indiv,
                    'combo_items_qty': combo,
                    'total_items_sold': indiv + combo,
                    'burgers_sold': to_float(ws_os.cell(r, 6).value),
                    'burger_buns_purchased': to_float(ws_os.cell(r, 7).value),
                    'pizzas_sold': to_float(ws_os.cell(r, 8).value),
                    'pizza_bases_purchased': to_float(ws_os.cell(r, 9).value),
                    'sandwiches_sold': to_float(ws_os.cell(r, 10).value),
                    'bread_purchased': to_float(ws_os.cell(r, 11).value),
                    'fries_sold': to_float(ws_os.cell(r, 12).value),
                    'fries_purchased': to_float(ws_os.cell(r, 13).value),
                    'garlic_bread_sold': to_float(ws_os.cell(r, 14).value),
                    'garlic_bread_purchased': to_float(ws_os.cell(r, 15).value),
                    'beverages_sold': to_float(ws_os.cell(r, 16).value)
                })

    # Grand Summary
    grand_summary = []
    if 'Grand Summary' in wb.sheetnames:
        ws_gs = wb['Grand Summary']
        for r in range(5, ws_gs.max_row + 1):
            c1 = ws_gs.cell(r, 1).value
            if c1:
                grand_summary.append({
                    'category': str(c1),
                    'name': str(ws_gs.cell(r, 2).value or '').replace('<br>\n', ' '),
                    'type': str(ws_gs.cell(r, 3).value or ''),
                    'qty': to_float(ws_gs.cell(r, 4).value),
                    'amount': to_float(ws_gs.cell(r, 5).value),
                    'avg_price': round(to_float(ws_gs.cell(r, 6).value), 2)
                })

    _CATEGORY_ANALYSIS_CACHE = {
        'categories': cat_data,
        'combos': combos,
        'recipes': recipes,
        'outlet_summary': outlet_summary,
        'grand_summary': grand_summary
    }
    return _CATEGORY_ANALYSIS_CACHE


@router.get("/items-list")
def get_available_items_list():
    """
    Returns a sorted list of all individual menu items grouped by category.
    """
    from backend.analysis.item_combo_service import item_service
    return item_service.get_available_items()


@router.get("/item-analysis")
def get_single_item_analysis(item_name: str = Query(..., description="Exact or partial item name")):
    """
    Returns full individual sales, combo decomposition, total consumption,
    and outlet-by-outlet breakdown for any individual food or beverage item.
    """
    from backend.analysis.item_combo_service import item_service
    return item_service.analyze_item(item_name)


@router.get("/recipe-bom")
def get_recipe_bom():
    """
    Returns the uploaded Recipe Bill of Materials (BOM) with full ingredient breakdowns,
    making costs, sale prices, profits, and margins.
    """
    from backend.parsers.recipe_bom import RecipeBOMParser
    return RecipeBOMParser.load_bom()



