import {
  Outlet, OutletSearchResult, PreviewResponse,
  ImportCommitRequest, ImportBatch, OutletDetail,
  DashboardSummary, CommitMapping, MasterMergedResponse
} from './types';

const API_BASE = '/api';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/analytics/dashboard`);
  if (!res.ok) throw new Error('Failed to load dashboard summary');
  return res.json();
}

export async function searchOutlets(q: string): Promise<OutletSearchResult[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_BASE}/search/outlets?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to search outlets');
  return res.json();
}

export async function fetchOutletDetail(
  outletId: number,
  dateFilter: string = 'all',
  startDate?: string,
  endDate?: string
): Promise<OutletDetail> {
  let url = `${API_BASE}/analytics/outlet/${outletId}?date_filter=${dateFilter}`;
  if (startDate) url += `&start_date=${startDate}`;
  if (endDate) url += `&end_date=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load outlet analytics');
  return res.json();
}

export async function fetchMasterMergedTable(params: {
  outletId?: number;
  itemSearch?: string;
  status?: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}): Promise<MasterMergedResponse> {
  const query = new URLSearchParams();
  if (params.outletId) query.append('outlet_id', params.outletId.toString());
  if (params.itemSearch) query.append('item_search', params.itemSearch);
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.dateFilter) query.append('date_filter', params.dateFilter);
  if (params.startDate) query.append('start_date', params.startDate);
  if (params.endDate) query.append('end_date', params.endDate);
  if (params.sortBy) query.append('sort_by', params.sortBy);
  if (params.sortOrder) query.append('sort_order', params.sortOrder);
  if (params.page) query.append('page', params.page.toString());
  if (params.limit !== undefined) query.append('limit', params.limit.toString());

  const res = await fetch(`${API_BASE}/analytics/master-merged-table?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load master merged table');
  return res.json();
}

export async function fetchAllOutlets(
  q?: string,
  sortBy: string = 'sales_amount',
  sortOrder: string = 'desc',
  page: number = 1,
  limit: number = 50
): Promise<{ total: number; page: number; limit: number; outlets: any[] }> {
  let url = `${API_BASE}/analytics/all-outlets?page=${page}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load all outlets summary');
  return res.json();
}

export async function uploadAndPreview(
  file: File,
  reportType: 'sales' | 'purchase',
  sheetName?: string,
  parserType?: string
): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('report_type', reportType);
  if (sheetName) formData.append('sheet_name', sheetName);
  if (parserType) formData.append('parser_type', parserType);

  const res = await fetch(`${API_BASE}/imports/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload preview failed' }));
    throw new Error(err.detail || 'Upload preview failed');
  }
  return res.json();
}

export async function commitImport(data: ImportCommitRequest): Promise<any> {
  const res = await fetch(`${API_BASE}/imports/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import commit failed' }));
    throw new Error(err.detail || 'Import commit failed');
  }
  return res.json();
}

export async function fetchBatches(reportType?: string): Promise<{ total: number; batches: ImportBatch[] }> {
  let url = `${API_BASE}/imports/batches?limit=100`;
  if (reportType) url += `&report_type=${reportType}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load batches');
  return res.json();
}

export async function rollbackBatch(batchId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/imports/batches/${batchId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to rollback batch');
  return res.json();
}

export async function fetchOutletsList(q?: string, city?: string): Promise<Outlet[]> {
  let url = `${API_BASE}/outlets/`;
  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (city) params.append('city', city);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load outlets list');
  return res.json();
}

export async function createOutlet(data: { official_name: string; code?: string; city?: string; state?: string; aliases?: string[] }): Promise<Outlet> {
  const res = await fetch(`${API_BASE}/outlets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create outlet' }));
    throw new Error(err.detail || 'Failed to create outlet');
  }
  return res.json();
}

export async function updateOutlet(id: number, data: any): Promise<Outlet> {
  const res = await fetch(`${API_BASE}/outlets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update outlet');
  return res.json();
}

export async function deleteOutlet(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/outlets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete outlet');
  return res.json();
}

export async function mergeOutlets(sourceId: number, targetId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/outlets/merge?source_outlet_id=${sourceId}&target_outlet_id=${targetId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to merge outlets');
  return res.json();
}

export async function deleteAlias(aliasId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/outlets/aliases/${aliasId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete alias');
  return res.json();
}

export async function fetchUnmatchedReview(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/outlets/unmatched-review`);
  if (!res.ok) throw new Error('Failed to load unmatched aliases');
  return res.json();
}

export async function confirmMapping(data: CommitMapping): Promise<any> {
  const res = await fetch(`${API_BASE}/outlets/confirm-mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to confirm mapping');
  return res.json();
}

export async function fetchSettingsStats(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/stats`);
  if (!res.ok) throw new Error('Failed to load system stats');
  return res.json();
}

export async function seedSampleData(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/seed-samples`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed sample data');
  return res.json();
}

export async function resetDatabase(): Promise<any> {
  const res = await fetch(`${API_BASE}/settings/reset-data`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset database');
  return res.json();
}
