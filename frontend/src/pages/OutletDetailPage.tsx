import React, { useEffect, useState } from 'react';
import {
  Store, Calendar, FileSpreadsheet, FileText, ArrowLeft,
  TrendingUp, ShoppingCart, DollarSign, Package,
  Layers, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { fetchOutletDetail } from '../api';
import { OutletDetail } from '../types';
import { KPIBox } from '../components/KPIBox';
import { ComparisonTable } from '../components/ComparisonTable';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid
} from 'recharts';

interface OutletDetailPageProps {
  outletId: number;
  onBack: () => void;
}

export const OutletDetailPage: React.FC<OutletDetailPageProps> = ({ outletId, onBack }) => {
  const [data, setData] = useState<OutletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [outletId, dateFilter]);

  const loadDetail = async (overrideStart?: string, overrideEnd?: string) => {
    try {
      setLoading(true);
      const detail = await fetchOutletDetail(
        outletId,
        dateFilter,
        overrideStart ?? (dateFilter === 'custom' ? startDate : undefined),
        overrideEnd ?? (dateFilter === 'custom' ? endDate : undefined)
      );
      setData(detail);
    } catch (err) {
      console.error('Failed to load outlet details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomDates = () => {
    if (startDate && endDate) {
      setDateFilter('custom');
      loadDetail(startDate, endDate);
    }
  };

  const handleExportExcel = () => {
    let url = `/api/exports/outlet/${outletId}/excel?date_filter=${dateFilter}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    window.open(url, '_blank');
  };

  const handleExportPDF = () => {
    let url = `/api/exports/outlet/${outletId}/pdf?date_filter=${dateFilter}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading outlet analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500 space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-base font-semibold">Outlet not found or data unavailable.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { outlet, kpis, items, top_selling_items, top_purchased_items, overview_chart } = data;

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {outlet.official_name}
                </h1>
                {outlet.code && (
                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {outlet.code}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  outlet.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {outlet.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                {outlet.city && <span className="font-medium text-slate-600">City: {outlet.city}</span>}
                {outlet.aliases && outlet.aliases.length > 0 && (
                  <span className="text-slate-400">
                    • Known Aliases: {outlet.aliases.map(a => a.raw_alias).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Export Excel / PDF */}
        <div className="flex items-center space-x-2.5 self-start md:self-center">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Period:</span>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
            {['all', 'today', 'this_week', 'this_month'].map((f) => (
              <button
                key={f}
                onClick={() => { setDateFilter(f); setCustomOpen(false); }}
                className={`px-3 py-1 rounded-md capitalize transition-all ${
                  dateFilter === f && !customOpen
                    ? 'bg-white text-blue-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
            <button
              onClick={() => setCustomOpen(!customOpen)}
              className={`px-3 py-1 rounded-md transition-all ${
                customOpen || dateFilter === 'custom'
                  ? 'bg-white text-blue-700 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        {customOpen && (
          <div className="flex items-center space-x-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleApplyCustomDates}
              className="bg-blue-600 text-white px-3 py-1 rounded font-semibold hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        )}

        <div className="text-[11px] text-slate-400 italic">
          Operational comparison of Sales & Purchase datasets
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Sales Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Sales Summary
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Sales Amount</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {formatCurrency(kpis.sales_amount)}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Total Sales Qty</p>
                <p className="font-bold text-slate-700 text-sm">{kpis.sales_quantity.toLocaleString()} units</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Distinct Items Sold</p>
                <p className="font-bold text-slate-700 text-sm">{kpis.sales_items_count} items</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Avg Sales per Item: <span className="font-semibold text-slate-700">{kpis.sales_avg_per_item ? formatCurrency(kpis.sales_avg_per_item) : 'Not Available'}</span>
            </div>
          </div>
        </div>

        {/* Purchase Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
              Purchase Summary
            </span>
            <ShoppingCart className="w-5 h-5 text-purple-600" />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Purchase Amount</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {formatCurrency(kpis.purchase_amount)}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Total Purchase Qty</p>
                <p className="font-bold text-slate-700 text-sm">{kpis.purchase_quantity.toLocaleString()} units</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Distinct Items Purchased</p>
                <p className="font-bold text-slate-700 text-sm">{kpis.purchase_items_count} items</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Avg Purchase per Item: <span className="font-semibold text-slate-700">{kpis.purchase_avg_per_item ? formatCurrency(kpis.purchase_avg_per_item) : 'Not Available'}</span>
            </div>
          </div>
        </div>

        {/* Comparison / Variance Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              Operational Comparison
            </span>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Sales vs Purchase Variance</p>
              <h3 className={`text-2xl font-black mt-0.5 ${kpis.diff_amount >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {kpis.diff_amount >= 0 ? '+' : ''}{formatCurrency(kpis.diff_amount)}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Quantity Variance</p>
                <p className="font-bold text-slate-700 text-sm">{kpis.diff_quantity >= 0 ? '+' : ''}{kpis.diff_quantity.toLocaleString()} units</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Variance %</p>
                <p className="font-bold text-slate-700 text-sm">
                  {kpis.diff_pct !== null && kpis.diff_pct !== undefined ? `${kpis.diff_pct}%` : 'Not Available'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Note: Represents operational flow; not direct accounting net profit.
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items for Outlet */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top Selling Items ({outlet.official_name})</h3>
              <p className="text-xs text-slate-500">By sales revenue (₹)</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
              Sales
            </span>
          </div>

          <div className="h-64 w-full">
            {top_selling_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No sales items recorded for this outlet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_selling_items} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Sales']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="sales" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Purchased Items for Outlet */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top Purchased Items ({outlet.official_name})</h3>
              <p className="text-xs text-slate-500">By purchase cost (₹)</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
              Procurement
            </span>
          </div>

          <div className="h-64 w-full">
            {top_purchased_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No purchase items recorded for this outlet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_purchased_items} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Purchase']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="purchase" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Complete Item-wise Comparison Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              Item-wise Sales vs Purchase Comparison
            </h3>
            <p className="text-xs text-slate-500">
              Detailed side-by-side reconciliation of units, revenues, costs and operational variance
            </p>
          </div>
        </div>

        <ComparisonTable items={items} />
      </div>
    </div>
  );
};
