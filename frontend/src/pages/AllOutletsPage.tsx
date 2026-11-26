import React, { useEffect, useMemo, useState } from 'react';
import {
  Store, Search, ArrowUpDown, FileSpreadsheet, ChevronRight, Upload
} from 'lucide-react';
import { fetchAllOutlets } from '../api';
import { AllOutletsRow } from '../types';
import { useUploadedData, UploadResult } from '../context/UploadedDataContext';
import {
  extractOutletsFromDatasets,
  fuzzyOutletScore,
  normalizeOutletStr,
} from '../utils/outletFuzzy';
import { BUILT_IN_OUTLETS } from '../data/builtInOutlets';

interface AllOutletsPageProps {
  onSelectOutlet: (outletId: number) => void;
}

interface CombinedOutletRow extends AllOutletsRow {
  source: 'database' | 'excel';
}

export const AllOutletsPage: React.FC<AllOutletsPageProps> = ({ onSelectOutlet }) => {
  const { datasets, setDatasets } = useUploadedData();
  const [dbOutlets, setDbOutlets] = useState<AllOutletsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sales_qty');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    // ── Step 1: Seed built-in outlets immediately ──
    const builtIn: AllOutletsRow[] = BUILT_IN_OUTLETS.map((o, idx) => ({
      id: -(idx + 1000),
      official_name: o.outlet,
      code: o.code ?? undefined,
      city: o.city ?? undefined,
      sales_amount: 0,
      purchase_amount: 0,
      sales_qty: 0,
      purchase_qty: 0,
      diff_amount: 0,
      items_sold_count: 0,
      items_purchased_count: 0,
    }));
    setDbOutlets(builtIn);
    setLoading(false);

    // ── Step 2: Enrich from API if online ──
    let cancelled = false;
    fetchAllOutlets('', 'sales_amount', 'desc', 1, 500)
      .then((res) => {
        if (!cancelled && Array.isArray(res?.outlets) && res.outlets.length > 0) {
          setDbOutlets(res.outlets);
        }
      })
      .catch(() => {
        // Built-in outlets already loaded — table still works
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const combinedOutlets = useMemo<CombinedOutletRow[]>(() => {
    const byKey = new Map<string, CombinedOutletRow>();

    for (const o of dbOutlets) {
      const key = normalizeOutletStr(o.official_name);
      if (!key) continue;
      byKey.set(key, { ...o, source: 'database' });
    }

    const excelOutlets = extractOutletsFromDatasets(datasets);
    excelOutlets.forEach((eo, idx) => {
      const key = normalizeOutletStr(eo.outlet);
      if (!key) return;
      const existing = byKey.get(key);
      if (existing) {
        if (existing.sales_qty === 0 && eo.sales_qty > 0) existing.sales_qty = eo.sales_qty;
        if (existing.purchase_qty === 0 && eo.purchase_qty > 0) existing.purchase_qty = eo.purchase_qty;
      } else {
        byKey.set(key, {
          id: -(idx + 1),
          official_name: eo.outlet,
          code: undefined,
          city: 'Uploaded Excel',
          sales_amount: 0,
          purchase_amount: 0,
          sales_qty: eo.sales_qty,
          purchase_qty: eo.purchase_qty,
          diff_amount: 0,
          items_sold_count: 0,
          items_purchased_count: 0,
          source: 'excel',
        });
      }
    });

    return Array.from(byKey.values());
  }, [dbOutlets, datasets]);

  const filteredAndSorted = useMemo(() => {
    const q = searchTerm.trim();
    let list = combinedOutlets;

    if (q) {
      list = combinedOutlets
        .map((o) => {
          const score = Math.max(
            fuzzyOutletScore(q, o.official_name),
            o.code ? fuzzyOutletScore(q, o.code) : 0,
            o.city ? fuzzyOutletScore(q, o.city) : 0
          );
          return { o, score };
        })
        .filter((x) => x.score >= 55)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.o);
    } else {
      list = [...combinedOutlets].sort((a, b) => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        if (sortBy === 'official_name') {
          return a.official_name.localeCompare(b.official_name) * dir;
        }
        const av = Number((a as any)[sortBy] ?? 0);
        const bv = Number((b as any)[sortBy] ?? 0);
        return (av - bv) * dir;
      });
    }

    return list;
  }, [combinedOutlets, searchTerm, sortBy, sortOrder]);

  const total = filteredAndSorted.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const pagedOutlets = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: UploadResult[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('period_label', file.name);
        formData.append('start_date', '');
        formData.append('end_date', '');
        const res = await fetch('/api/excel-upload', { method: 'POST', body: formData });
        if (res.ok) {
          uploaded.push(await res.json());
        }
      }
      if (uploaded.length > 0) {
        setDatasets((prev) => {
          const map = new Map(prev.map((d) => [d.filename, d]));
          for (const u of uploaded) map.set(u.filename, u);
          return [...map.values()];
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleExportAll = () => {
    window.open('/api/exports/all-outlets/excel', '_blank');
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            All Franchise Outlets
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Comparative performance directory across saved and uploaded Excel outlets
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload Excel / CSV'}</span>
            <input
              type="file"
              multiple
              accept=".xlsx,.xlsm,.xls,.csv"
              className="hidden"
              onChange={handleQuickUpload}
            />
          </label>
          <button
            onClick={handleExportAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export All Outlets (Excel)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search outlet (e.g. LP S, Adajan, Nanpura)..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{pagedOutlets.length}</span> of{' '}
          <span className="font-bold text-slate-800">{total}</span> outlets
        </div>
      </div>

      {/* Outlets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('official_name')}>
                  <div className="flex items-center space-x-1">
                    <span>Outlet Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Code / Source</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('sales_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Sales Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('purchase_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Purchase Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('sales_qty')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Sales Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('purchase_qty')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Purch Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('diff_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Variance (S - P)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && combinedOutlets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading outlets...
                  </td>
                </tr>
              ) : pagedOutlets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {combinedOutlets.length === 0
                      ? 'No outlets loaded yet. Click "Upload Excel / CSV" above or upload in Excel Upload & Viewer.'
                      : 'No outlets found matching the query.'}
                  </td>
                </tr>
              ) : (
                pagedOutlets.map((o) => (
                  <tr
                    key={`${o.source}-${o.id}-${o.official_name}`}
                    onClick={() => {
                      if (o.source === 'database' && o.id > 0) {
                        onSelectOutlet(o.id);
                      }
                    }}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <Store className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>{o.official_name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center space-x-2">
                        {o.code && (
                          <span className="font-mono font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {o.code}
                          </span>
                        )}
                        <span>{o.city || 'Gujarat'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {formatCurrency(o.sales_amount)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-purple-600">
                      {formatCurrency(o.purchase_amount)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      {o.sales_qty.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      {o.purchase_qty.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold">
                      <span className={o.diff_amount >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                        {o.diff_amount >= 0 ? '+' : ''}{formatCurrency(o.diff_amount)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {o.source === 'database' && o.id > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">
                          View Analytics <ChevronRight className="w-3 h-3 ml-0.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                          From Excel
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
            <div>
              Page {page} of {totalPages} ({total} outlets total)
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
