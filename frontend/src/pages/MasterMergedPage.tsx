import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet, Search, ArrowUpDown, Filter,
  Store, ShoppingBag, TrendingUp, DollarSign,
  Download, ChevronRight, Layers, RefreshCw
} from 'lucide-react';
import { fetchMasterMergedTable, fetchOutletsList } from '../api';
import { MasterMergedRow, MasterMergedResponse, Outlet } from '../types';

interface MasterMergedPageProps {
  onSelectOutlet: (outletId: number) => void;
}

export const MasterMergedPage: React.FC<MasterMergedPageProps> = ({ onSelectOutlet }) => {
  const [data, setData] = useState<MasterMergedResponse | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedOutletId, setSelectedOutletId] = useState<number | undefined>(undefined);
  const [itemSearch, setItemSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('outlet_name');
  const [sortOrder, setSortOrder] = useState<string>('asc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  useEffect(() => {
    fetchOutletsList().then(setOutlets).catch(console.error);
  }, []);

  useEffect(() => {
    loadMergedData();
  }, [selectedOutletId, itemSearch, statusFilter, dateFilter, sortBy, sortOrder, page]);

  const loadMergedData = async () => {
    try {
      setLoading(true);
      const res = await fetchMasterMergedTable({
        outletId: selectedOutletId,
        itemSearch: itemSearch || undefined,
        status: statusFilter,
        dateFilter: dateFilter,
        sortBy: sortBy,
        sortOrder: sortOrder,
        page: page,
        limit: pageSize,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load merged data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field.includes('amount') || field.includes('qty') ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (selectedOutletId) params.append('outlet_id', selectedOutletId.toString());
    if (itemSearch) params.append('item_search', itemSearch);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (dateFilter !== 'all') params.append('date_filter', dateFilter);

    window.open(`/api/exports/master-merged-excel?${params.toString()}`, '_blank');
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
              Unified Master Reconciliation
            </span>
            <span className="text-slate-400 text-xs">• Cross-Outlet & Item Consolidated</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Master Sales & Purchase Merged Table
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Every item across every franchise outlet merged into a single reconciliation table with side-by-side sales and purchase figures.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="self-start lg:self-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Unified Master Excel (.xlsx)</span>
        </button>
      </div>

      {/* Aggregate KPI Strip */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rows</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{data.total.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">Outlet x Item pairs</p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Sales Value</p>
            <p className="text-lg font-bold text-emerald-800 mt-0.5">{formatCurrency(data.total_sales_amount)}</p>
            <p className="text-[11px] text-emerald-600 font-medium">{data.total_sales_qty.toLocaleString()} units</p>
          </div>
          <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total Purchase Value</p>
            <p className="text-lg font-bold text-purple-800 mt-0.5">{formatCurrency(data.total_purchase_amount)}</p>
            <p className="text-[11px] text-purple-600 font-medium">{data.total_purchase_qty.toLocaleString()} units</p>
          </div>
          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Net Variance (S - P)</p>
            <p className={`text-lg font-bold mt-0.5 ${data.total_variance_amount >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
              {data.total_variance_amount >= 0 ? '+' : ''}{formatCurrency(data.total_variance_amount)}
            </p>
            <p className="text-[11px] text-blue-600 font-medium">Operational variance</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Master Outlets</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{outlets.length}</p>
            <p className="text-[11px] text-slate-400">Registered locations</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Outlet Dropdown */}
          <div className="w-full sm:w-64">
            <select
              value={selectedOutletId || ''}
              onChange={(e) => {
                setSelectedOutletId(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-50 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="">All Master Outlets ({outlets.length})</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.official_name} {o.code ? `(${o.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Item Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item name or code..."
              value={itemSearch}
              onChange={(e) => { setItemSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-blue-500 font-medium"
            />
          </div>

          {/* Date Filter */}
          <div className="w-full sm:w-44">
            <select
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-50 outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="all">All Date Records</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-100 text-xs font-semibold overflow-x-auto">
          <span className="text-slate-400 mr-2 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" />
            Filter Status:
          </span>
          <button
            onClick={() => { setStatusFilter('all'); setPage(1); }}
            className={`px-3 py-1 rounded-md transition-all ${
              statusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => { setStatusFilter('both'); setPage(1); }}
            className={`px-3 py-1 rounded-md transition-all ${
              statusFilter === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Sold & Purchased (Both)
          </button>
          <button
            onClick={() => { setStatusFilter('sold_only'); setPage(1); }}
            className={`px-3 py-1 rounded-md transition-all ${
              statusFilter === 'sold_only' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Sold Only
          </button>
          <button
            onClick={() => { setStatusFilter('purchased_only'); setPage(1); }}
            className={`px-3 py-1 rounded-md transition-all ${
              statusFilter === 'purchased_only' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Purchased Only
          </button>
          <button
            onClick={() => { setStatusFilter('variance_only'); setPage(1); }}
            className={`px-3 py-1 rounded-md transition-all ${
              statusFilter === 'variance_only' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Variance Only (Discrepancies)
          </button>
        </div>
      </div>

      {/* Main Consolidated Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('outlet_name')}>
                  <div className="flex items-center space-x-1">
                    <span>Master Outlet</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('item_name')}>
                  <div className="flex items-center space-x-1">
                    <span>Item Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('purchase_qty')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Purch Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('purchase_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Purch Amt (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('sales_qty')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Sales Qty</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('sales_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Sales Amt (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('diff_qty')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Qty Diff</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('diff_amount')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Variance (S - P)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Merging sales and purchase records across outlets...
                  </td>
                </tr>
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    No matching sales & purchase records found with current filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((row, idx) => {
                  const isPositive = row.diff_amount > 0;
                  const isNegative = row.diff_amount < 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Master Outlet */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <button
                          onClick={() => onSelectOutlet(row.outlet_id)}
                          className="hover:text-blue-600 text-left flex items-center space-x-1.5 group"
                        >
                          <Store className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-700 flex-shrink-0" />
                          <span>{row.outlet_name}</span>
                        </button>
                        {row.outlet_code && (
                          <span className="text-[10px] font-mono text-slate-400 ml-5 font-normal">
                            Code: {row.outlet_code}
                          </span>
                        )}
                      </td>

                      {/* Item Name */}
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <span>{row.item_name}</span>
                          {row.item_code && (
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1 rounded">
                              {row.item_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purchase Qty */}
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {row.purchase_qty > 0 ? row.purchase_qty.toLocaleString() : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Purchase Amount */}
                      <td className="py-3 px-4 text-right font-bold text-purple-700">
                        {row.purchase_amount > 0 ? formatCurrency(row.purchase_amount) : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Sales Qty */}
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {row.sales_qty > 0 ? row.sales_qty.toLocaleString() : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Sales Amount */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {row.sales_amount > 0 ? formatCurrency(row.sales_amount) : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Qty Diff */}
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {row.diff_qty !== 0 ? (
                          <span className={row.diff_qty > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {row.diff_qty > 0 ? '+' : ''}{row.diff_qty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Variance Amount */}
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400'}>
                          {isPositive ? '+' : ''}{formatCurrency(row.diff_amount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {row.status === 'both' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Both
                          </span>
                        ) : row.status === 'sold_only' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Sold Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Purch Only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && totalPages > 1 && (
          <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
            <div>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total.toLocaleString()} rows
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-medium"
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
