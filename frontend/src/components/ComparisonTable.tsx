import React, { useState, useMemo } from 'react';
import { ItemComparisonRow } from '../types';
import { Search, ArrowUpDown, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface ComparisonTableProps {
  items: ItemComparisonRow[];
  currencySymbol?: string;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  items,
  currencySymbol = '₹'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'both' | 'sold_only' | 'purchased_only'>('all');
  const [sortField, setSortField] = useState<keyof ItemComparisonRow>('sales_amount');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filteredItems = useMemo(() => {
    return items.filter(itm => {
      // Search filter
      const matchesSearch = itm.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (itm.item_code && itm.item_code.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      // Tab filter
      if (filterTab === 'both') return itm.status === 'both';
      if (filterTab === 'sold_only') return itm.status === 'sold_only';
      if (filterTab === 'purchased_only') return itm.status === 'purchased_only';
      return true;
    });
  }, [items, searchTerm, filterTab]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredItems, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: keyof ItemComparisonRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const counts = useMemo(() => {
    let both = 0, soldOnly = 0, purchasedOnly = 0;
    items.forEach(i => {
      if (i.status === 'both') both++;
      else if (i.status === 'sold_only') soldOnly++;
      else if (i.status === 'purchased_only') purchasedOnly++;
    });
    return { all: items.length, both, soldOnly, purchasedOnly };
  }, [items]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Controls Header */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        {/* Status Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => { setFilterTab('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items ({counts.all})
          </button>
          <button
            onClick={() => { setFilterTab('both'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterTab === 'both'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sold & Purchased ({counts.both})
          </button>
          <button
            onClick={() => { setFilterTab('sold_only'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterTab === 'sold_only'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sold Only ({counts.soldOnly})
          </button>
          <button
            onClick={() => { setFilterTab('purchased_only'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterTab === 'purchased_only'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchased Only ({counts.purchasedOnly})
          </button>
        </div>

        {/* Search in Items */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter item name..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/60" onClick={() => handleSort('item_name')}>
                <div className="flex items-center space-x-1">
                  <span>Item Name</span>
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
                  <span>Sales Amt</span>
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
                  <span>Purch Amt</span>
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
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No items found matching the selected filter.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const diffIsPositive = item.diff_amount > 0;
                const diffIsNegative = item.diff_amount < 0;

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span>{item.item_name}</span>
                        {item.item_code && (
                          <span className="text-[10px] font-mono text-slate-400 px-1 bg-slate-100 rounded">
                            {item.item_code}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {item.sales_qty > 0 ? item.sales_qty.toLocaleString() : <span className="text-slate-300">-</span>}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {item.sales_amount > 0 ? (
                        <span>{currencySymbol}{item.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {item.purchase_qty > 0 ? item.purchase_qty.toLocaleString() : <span className="text-slate-300">-</span>}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {item.purchase_amount > 0 ? (
                        <span>{currencySymbol}{item.purchase_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-bold">
                      <span className={diffIsPositive ? 'text-emerald-600' : diffIsNegative ? 'text-rose-600' : 'text-slate-500'}>
                        {diffIsPositive ? '+' : ''}{currencySymbol}{item.diff_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {item.status === 'both' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Both
                        </span>
                      ) : item.status === 'sold_only' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sold Only
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Purchased Only
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
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedItems.length)} of {sortedItems.length} items
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
