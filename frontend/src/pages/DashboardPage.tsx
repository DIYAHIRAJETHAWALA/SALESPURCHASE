import React, { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingBag, DollarSign, Store,
  Layers, ArrowUpRight, ArrowDownRight, Clock,
  FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { fetchDashboardSummary } from '../api';
import { DashboardSummary } from '../types';
import { KPIBox } from '../components/KPIBox';
import { OutletSearchBar } from '../components/OutletSearchBar';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid
} from 'recharts';

interface DashboardPageProps {
  onSelectOutlet: (outletId: number) => void;
  onNavigate: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectOutlet, onNavigate }) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const summary = await fetchDashboardSummary();
      setData(summary);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading franchise analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Could not load analytics. Make sure the backend server is running.</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Search Hero Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <Store className="w-80 h-80" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
            One-Click Outlet Intelligence
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-3 text-white">
            Franchise Outlet Analytics
          </h1>
          <p className="text-blue-200 text-sm mt-2 mb-6">
            Type any outlet name (e.g. Bandra, Adajan, Nanpura) or alias. Instant sales vs purchase comparison with item-level variance.
          </p>

          <OutletSearchBar onSelectOutlet={onSelectOutlet} size="large" autoFocus />
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPIBox
          title="Total Franchise Sales"
          value={formatCurrency(data.total_sales_amount)}
          subtitle={`${data.total_sales_qty.toLocaleString()} units sold across all outlets`}
          icon={TrendingUp}
          variant="emerald"
        />
        <KPIBox
          title="Total Franchise Purchase"
          value={formatCurrency(data.total_purchase_amount)}
          subtitle={`${data.total_purchase_qty.toLocaleString()} units purchased`}
          icon={ShoppingBag}
          variant="purple"
        />
        <KPIBox
          title="Operational Variance (S - P)"
          value={formatCurrency(data.net_diff_amount)}
          subtitle="Sales value minus purchase value"
          icon={DollarSign}
          variant={data.net_diff_amount >= 0 ? "blue" : "amber"}
          badge={{
            text: data.net_diff_amount >= 0 ? "+ Positive" : "- Negative",
            isPositive: data.net_diff_amount >= 0,
            isNegative: data.net_diff_amount < 0
          }}
        />
        <KPIBox
          title="Active Franchise Outlets"
          value={data.total_outlets}
          subtitle={`${data.total_batches} import batches processed`}
          icon={Store}
          variant="slate"
        />
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Selling Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top 10 Selling Items</h3>
              <p className="text-xs text-slate-500">By total sales value (₹)</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Franchise Wide
            </span>
          </div>

          <div className="h-72 w-full">
            {data.top_selling_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No sales records imported yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_selling_items} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} textAnchor="middle" />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Sales Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="sales" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 10 Purchased Items */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top 10 Purchased Items</h3>
              <p className="text-xs text-slate-500">By total purchase value (₹)</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
              Procurement
            </span>
          </div>

          <div className="h-72 w-full">
            {data.top_purchased_items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No purchase records imported yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_purchased_items} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} textAnchor="middle" />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Purchase Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="purchase" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Outlets Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Top Franchise Outlets by Sales</h3>
            <p className="text-xs text-slate-500">Click any outlet to open its full sales and purchase analytics</p>
          </div>
          <button
            onClick={() => onNavigate('all_outlets')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>View All Outlets</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4">Outlet Name</th>
                <th className="py-3 px-4">Code / City</th>
                <th className="py-3 px-4 text-right">Sales Amount</th>
                <th className="py-3 px-4 text-right">Purchase Amount</th>
                <th className="py-3 px-4 text-right">Variance (S - P)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.top_outlets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No outlet transactions available yet. Upload sales and purchase files to get started.
                  </td>
                </tr>
              ) : (
                data.top_outlets.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onSelectOutlet(o.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center space-x-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span>{o.official_name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {o.code ? <span className="font-mono font-semibold text-slate-700 mr-2">{o.code}</span> : null}
                      <span>{o.city || 'Gujarat'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      ₹{o.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-purple-600">
                      ₹{o.purchase_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      <span className={o.diff_amount >= 0 ? 'text-slate-900' : 'text-rose-600'}>
                        ₹{o.diff_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100">
                        View Analytics →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Import Batches */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Import Batches</h3>
            <p className="text-xs text-slate-500">Tracking uploaded Sales and Purchase reports</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Full Import History
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {data.recent_batches.length === 0 ? (
            <p className="py-4 text-center text-slate-400 text-xs">No batches imported yet.</p>
          ) : (
            data.recent_batches.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    b.report_type === 'sales' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {b.report_type === 'sales' ? 'S' : 'P'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{b.filename}</p>
                    <p className="text-slate-400 text-[11px]">
                      {b.parser_used} • {b.start_date ? `${b.start_date} to ${b.end_date}` : 'Standard Batch'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-slate-900">₹{b.total_amount.toLocaleString()}</p>
                  <p className="text-slate-400 text-[11px]">{b.total_records.toLocaleString()} records</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
