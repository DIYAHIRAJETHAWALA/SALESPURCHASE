import React, { useEffect, useState } from 'react';
import {
  Store, Search, ArrowUpDown, FileSpreadsheet,
  MapPin, ChevronRight, Filter, RefreshCw
} from 'lucide-react';
import { fetchAllOutlets } from '../api';
import { AllOutletsRow } from '../types';

interface AllOutletsPageProps {
  onSelectOutlet: (outletId: number) => void;
}

export const AllOutletsPage: React.FC<AllOutletsPageProps> = ({ onSelectOutlet }) => {
  const [outlets, setOutlets] = useState<AllOutletsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sales_amount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    loadOutlets();
  }, [searchTerm, sortBy, sortOrder, page]);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      const res = await fetchAllOutlets(searchTerm, sortBy, sortOrder, page, pageSize);
      setOutlets(res.outlets);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load outlets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleExportAll = () => {
    window.open('/api/exports/all-outlets/excel', '_blank');
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

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
            Comparative performance directory across all registered franchise locations
          </p>
        </div>

        <button
          onClick={handleExportAll}
          className="self-start sm:self-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export All Outlets (Excel)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search outlet by name, city, or code..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{outlets.length}</span> of{' '}
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
                <th className="py-3 px-4">Code / City</th>
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading outlets...
                  </td>
                </tr>
              ) : outlets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No outlets found matching the query.
                  </td>
                </tr>
              ) : (
                outlets.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onSelectOutlet(o.id)}
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
                      <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">
                        View Analytics <ChevronRight className="w-3 h-3 ml-0.5" />
                      </span>
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
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
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
