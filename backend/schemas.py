from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# --- OUTLET SCHEMAS ---
class OutletAliasResponse(BaseModel):
    id: int
    raw_alias: str
    normalized_alias: str
    source_file: Optional[str] = None
    is_confirmed: bool
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class OutletBase(BaseModel):
    official_name: str
    code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_active: bool = True


class OutletCreate(OutletBase):
    aliases: Optional[List[str]] = None


class OutletUpdate(BaseModel):
    official_name: Optional[str] = None
    code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_active: Optional[bool] = None


class OutletResponse(OutletBase):
    id: int
    normalized_name: str
    aliases: List[OutletAliasResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OutletCandidate(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    score: float


class OutletMatchPrediction(BaseModel):
    raw_name: str
    matched_outlet_id: Optional[int] = None
    matched_outlet_name: Optional[str] = None
    confidence: float
    is_auto_matched: bool
    needs_confirmation: bool
    reason: str
    candidates: List[OutletCandidate] = []


# --- IMPORT SCHEMAS ---
class InspectFileResponse(BaseModel):
    filename: str
    is_excel: bool
    sheets: List[str] = []
    selected_sheet: Optional[str] = None
    detected_parser: str
    sample_rows: List[List[Any]] = []


class PreviewRecord(BaseModel):
    outlet_raw: str
    item_raw: str
    item_code: Optional[str] = None
    quantity: float
    unit_price: Optional[float] = None
    amount: float
    transaction_date: Optional[str] = None
    source_row_idx: Optional[int] = None


class PreviewResponse(BaseModel):
    filename: str
    file_hash: str
    report_type: str
    parser_used: str
    sheet_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_records: int
    total_quantity: float
    total_amount: float
    items_count: int
    outlets_count: int
    outlet_predictions: List[OutletMatchPrediction] = []
    sample_records: List[PreviewRecord] = []
    warnings: List[str] = []
    is_duplicate: bool = False
    existing_batch_id: Optional[str] = None


class CommitMapping(BaseModel):
    raw_name: str
    outlet_id: Optional[int] = None
    create_new: bool = False
    new_outlet_name: Optional[str] = None
    new_outlet_code: Optional[str] = None
    new_outlet_city: Optional[str] = None


class ImportCommitRequest(BaseModel):
    file_hash: str
    report_type: str  # 'sales' or 'purchase'
    filename: str
    sheet_name: Optional[str] = None
    parser_type: Optional[str] = None
    mode: str = "append"  # 'append' or 'replace'
    replace_batch_id: Optional[str] = None
    confirmed_mappings: List[CommitMapping] = []


class ImportCommitResponse(BaseModel):
    success: bool
    batch_id: str
    report_type: str
    total_imported: int
    total_quantity: float
    total_amount: float
    new_outlets_created: int
    aliases_saved: int
    message: str


class ImportBatchResponse(BaseModel):
    id: int
    batch_id: str
    report_type: str
    filename: str
    file_hash: str
    parser_used: Optional[str] = None
    sheet_name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_records: int
    total_quantity: float
    total_amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- SEARCH & ANALYTICS SCHEMAS ---
class OutletSearchResult(BaseModel):
    id: int
    official_name: str
    code: Optional[str] = None
    city: Optional[str] = None
    aliases: List[str] = []
    match_score: float = 100.0


class OutletKPIs(BaseModel):
    sales_amount: float = 0.0
    sales_quantity: float = 0.0
    sales_items_count: int = 0
    sales_avg_per_item: Optional[float] = None
    purchase_amount: float = 0.0
    purchase_quantity: float = 0.0
    purchase_items_count: int = 0
    purchase_avg_per_item: Optional[float] = None
    diff_amount: float = 0.0
    diff_quantity: float = 0.0
    diff_pct: Optional[float] = None


class ItemComparisonRow(BaseModel):
    item_name: str
    item_code: Optional[str] = None
    sales_qty: float = 0.0
    sales_amount: float = 0.0
    sales_avg_price: Optional[float] = None
    purchase_qty: float = 0.0
    purchase_amount: float = 0.0
    purchase_avg_price: Optional[float] = None
    diff_qty: float = 0.0
    diff_amount: float = 0.0
    status: str  # 'both', 'sold_only', 'purchased_only'


class ChartDataPoint(BaseModel):
    label: str
    sales: float = 0.0
    purchase: float = 0.0
    sales_qty: float = 0.0
    purchase_qty: float = 0.0


class OutletDetailResponse(BaseModel):
    outlet: OutletResponse
    date_filter: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    kpis: OutletKPIs
    items: List[ItemComparisonRow] = []
    top_selling_items: List[ChartDataPoint] = []
    top_purchased_items: List[ChartDataPoint] = []
    overview_chart: List[ChartDataPoint] = []


class MasterMergedRow(BaseModel):
    outlet_id: int
    outlet_name: str
    outlet_code: Optional[str] = None
    city: Optional[str] = None
    item_id: Optional[int] = None
    item_name: str
    item_code: Optional[str] = None
    sales_qty: float = 0.0
    sales_amount: float = 0.0
    sales_avg_price: Optional[float] = None
    purchase_qty: float = 0.0
    purchase_amount: float = 0.0
    purchase_avg_price: Optional[float] = None
    diff_qty: float = 0.0
    diff_amount: float = 0.0
    status: str  # 'both', 'sold_only', 'purchased_only'


class MasterMergedResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_sales_amount: float
    total_purchase_amount: float
    total_sales_qty: float
    total_purchase_qty: float
    total_variance_amount: float
    rows: List[MasterMergedRow] = []


class AllOutletsRow(BaseModel):
    id: int
    official_name: str
    code: Optional[str] = None
    city: Optional[str] = None
    sales_amount: float = 0.0
    purchase_amount: float = 0.0
    sales_qty: float = 0.0
    purchase_qty: float = 0.0
    diff_amount: float = 0.0
    diff_pct: Optional[float] = None
    items_sold_count: int = 0
    items_purchased_count: int = 0


class DashboardSummaryResponse(BaseModel):
    total_sales_amount: float
    total_purchase_amount: float
    total_sales_qty: float
    total_purchase_qty: float
    net_diff_amount: float
    total_outlets: int
    total_batches: int
    sales_batches_count: int
    purchase_batches_count: int
    top_outlets: List[AllOutletsRow] = []
    top_selling_items: List[ChartDataPoint] = []
    top_purchased_items: List[ChartDataPoint] = []
    recent_batches: List[ImportBatchResponse] = []
