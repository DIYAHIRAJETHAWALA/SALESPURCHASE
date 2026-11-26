export interface OutletAlias {
  id: number;
  raw_alias: string;
  normalized_alias: string;
  source_file?: string;
  is_confirmed: boolean;
  confidence: number;
  created_at: string;
}

export interface Outlet {
  id: number;
  official_name: string;
  normalized_name: string;
  code?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  aliases: OutletAlias[];
  created_at: string;
  updated_at: string;
}

export interface OutletCandidate {
  id: number;
  name: string;
  code?: string;
  score: number;
}

export interface OutletPrediction {
  raw_name: string;
  matched_outlet_id?: number;
  matched_outlet_name?: string;
  confidence: number;
  is_auto_matched: boolean;
  needs_confirmation: boolean;
  reason: string;
  candidates: OutletCandidate[];
}

export interface PreviewRecord {
  outlet_raw: string;
  item_raw: string;
  item_code?: string;
  quantity: number;
  unit_price?: number;
  amount: number;
  transaction_date?: string;
  source_row_idx?: number;
}

export interface PreviewResponse {
  filename: string;
  file_hash: string;
  report_type: 'sales' | 'purchase';
  parser_used: string;
  sheet_name?: string;
  start_date?: string;
  end_date?: string;
  total_records: number;
  total_quantity: number;
  total_amount: number;
  items_count: number;
  outlets_count: number;
  outlet_predictions: OutletPrediction[];
  sample_records: PreviewRecord[];
  warnings: string[];
  is_duplicate: boolean;
  existing_batch_id?: string;
}

export interface CommitMapping {
  raw_name: string;
  outlet_id?: number;
  create_new: boolean;
  new_outlet_name?: string;
  new_outlet_code?: string;
  new_outlet_city?: string;
}

export interface ImportCommitRequest {
  file_hash: string;
  report_type: 'sales' | 'purchase';
  filename: string;
  sheet_name?: string;
  parser_type?: string;
  mode: 'append' | 'replace' | 'cancel';
  replace_batch_id?: string;
  confirmed_mappings: CommitMapping[];
}

export interface ImportBatch {
  id: number;
  batch_id: string;
  report_type: 'sales' | 'purchase';
  filename: string;
  file_hash: string;
  parser_used?: string;
  sheet_name?: string;
  start_date?: string;
  end_date?: string;
  total_records: number;
  total_quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export interface OutletSearchResult {
  id: number;
  official_name: string;
  code?: string;
  city?: string;
  aliases: string[];
  match_score: number;
}

export interface OutletKPIs {
  sales_amount: number;
  sales_quantity: number;
  sales_items_count: number;
  sales_avg_per_item?: number;
  purchase_amount: number;
  purchase_quantity: number;
  purchase_items_count: number;
  purchase_avg_per_item?: number;
  diff_amount: number;
  diff_quantity: number;
  diff_pct?: number;
}

export interface ItemComparisonRow {
  item_name: string;
  item_code?: string;
  sales_qty: number;
  sales_amount: number;
  sales_avg_price?: number;
  purchase_qty: number;
  purchase_amount: number;
  purchase_avg_price?: number;
  diff_qty: number;
  diff_amount: number;
  status: 'both' | 'sold_only' | 'purchased_only';
}

export interface ChartDataPoint {
  label: string;
  sales?: number;
  purchase?: number;
  sales_qty?: number;
  purchase_qty?: number;
}

export interface OutletDetail {
  outlet: Outlet;
  date_filter: string;
  start_date?: string;
  end_date?: string;
  kpis: OutletKPIs;
  items: ItemComparisonRow[];
  top_selling_items: ChartDataPoint[];
  top_purchased_items: ChartDataPoint[];
  overview_chart: ChartDataPoint[];
}

export interface MasterMergedRow {
  outlet_id: number;
  outlet_name: string;
  outlet_code?: string;
  city?: string;
  item_id?: number;
  item_name: string;
  item_code?: string;
  sales_qty: number;
  sales_amount: number;
  sales_avg_price?: number;
  purchase_qty: number;
  purchase_amount: number;
  purchase_avg_price?: number;
  diff_qty: number;
  diff_amount: number;
  status: 'both' | 'sold_only' | 'purchased_only';
}

export interface MasterMergedResponse {
  total: number;
  page: number;
  limit: number;
  total_sales_amount: number;
  total_purchase_amount: number;
  total_sales_qty: number;
  total_purchase_qty: number;
  total_variance_amount: number;
  rows: MasterMergedRow[];
}

export interface AllOutletsRow {
  id: number;
  official_name: string;
  code?: string;
  city?: string;
  sales_amount: number;
  purchase_amount: number;
  sales_qty: number;
  purchase_qty: number;
  diff_amount: number;
  diff_pct?: number;
  items_sold_count: number;
  items_purchased_count: number;
}

export interface DashboardSummary {
  total_sales_amount: number;
  total_purchase_amount: number;
  total_sales_qty: number;
  total_purchase_qty: number;
  net_diff_amount: number;
  total_outlets: number;
  total_batches: number;
  sales_batches_count: number;
  purchase_batches_count: number;
  top_outlets: AllOutletsRow[];
  top_selling_items: ChartDataPoint[];
  top_purchased_items: ChartDataPoint[];
  recent_batches: ImportBatch[];
}
