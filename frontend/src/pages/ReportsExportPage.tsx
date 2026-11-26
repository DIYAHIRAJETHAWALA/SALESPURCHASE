import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, FileText, Download, Store,
  Layers, CheckCircle2, Calendar
} from 'lucide-react';
import { fetchOutletsList } from '../api';
import { Outlet } from '../types';

export const ReportsExportPage: React.FC = () => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<number | ''>('');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    fetchOutletsList().then(setOutlets).catch(console.error);
  }, []);

  const downloadOutletExcel = () => {
    if (!selectedOutletId) {
      alert('Please select an outlet first');
      return;
    }
    window.open(`/api/exports/outlet/${selectedOutletId}/excel?date_filter=${dateFilter}`, '_blank');
  };

  const downloadOutletPDF = () => {
    if (!selectedOutletId) {
      alert('Please select an outlet first');
      return;
    }
    window.open(`/api/exports/outlet/${selectedOutletId}/pdf?date_filter=${dateFilter}`, '_blank');
  };

  const downloadAllOutletsExcel = () => {
    window.open('/api/exports/all-outlets/excel', '_blank');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Reports & Export Center
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Generate production-ready Excel workbooks (.xlsx) and executive PDF documents (.pdf)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outlet Report Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Individual Outlet Report</h3>
              <p className="text-xs text-slate-500">Sales, Purchase & Item-wise Reconciliation</p>
            </div>
          </div>

          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Select Outlet *</label>
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 font-medium"
              >
                <option value="">Select an outlet...</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.official_name} {o.code ? `(${o.code})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Period Filter</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 font-medium"
              >
                <option value="all">All Dates Available</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center space-x-3">
            <button
              onClick={downloadOutletExcel}
              disabled={!selectedOutletId}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel (.xlsx)</span>
            </button>
            <button
              onClick={downloadOutletPDF}
              disabled={!selectedOutletId}
              className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              <span>Download PDF (.pdf)</span>
            </button>
          </div>
        </div>

        {/* All Outlets Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Franchise-Wide Summary</h3>
                <p className="text-xs text-slate-500">Master Directory & Variance Ranking</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 leading-relaxed">
              Downloads a master comparative workbook containing every registered franchise outlet, their total sales, total purchase, item count, quantity variance, and variance percentage.
            </p>

            <ul className="text-xs text-slate-500 mt-4 space-y-1.5">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Formatted currency and unit columns</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Sortable by sales, purchase, or variance</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Compatible with Microsoft Excel, Google Sheets, LibreOffice</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={downloadAllOutletsExcel}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Franchise Summary Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Master Merged Sales & Purchase Report Card */}
        <div className="bg-white rounded-xl border-2 border-blue-500/30 p-6 shadow-md space-y-4 flex flex-col justify-between md:col-span-2 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/20">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-900 text-base">Master Merged Sales & Purchase Reconciliation Workbook</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">Multi-Sheet</span>
                </div>
                <p className="text-xs text-slate-500">Cross-outlet & Item Consolidated Master Spreadsheet</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 leading-relaxed max-w-3xl">
              Consolidates every sales and purchase file ever uploaded into a single comprehensive master Excel workbook. It merges all items with their respective master outlets side-by-side, detailing Purchase Quantity & Value, Sales Quantity & Value, and Net Operational Discrepancy (Sales - Purchase) along with Variance Highlight sheets.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs text-slate-600">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-blue-900">Sheet 1: Master Merged Table</p>
                <p className="text-[11px] text-slate-500 mt-1">Every Outlet + Item pair with Sales vs Purchase quantities and values.</p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-rose-900">Sheet 2: Variance Highlights</p>
                <p className="text-[11px] text-slate-500 mt-1">Isolates items with discrepancy (items sold but not purchased or vice versa).</p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-slate-900">Auto Formatted</p>
                <p className="text-[11px] text-slate-500 mt-1">Header styling, currency format, and conditional color fills.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">Ready to download in native Microsoft Excel (.xlsx) format</span>
            <button
              onClick={() => window.open('/api/exports/master-merged-excel', '_blank')}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Master Merged Reconciliation Workbook (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* 10-Sheet Category, Recipe, Combos & Unit Discrepancy Workbook Card */}
        <div className="bg-white rounded-xl border-2 border-emerald-500/40 p-6 shadow-md space-y-4 flex flex-col justify-between md:col-span-2 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    10-Sheet Consolidated Category, Recipe &amp; Combo Reconciliation Workbook
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    10 Sheets · Complete Analysis
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Item-wise, Combo Disaggregation, Recipe Bill of Materials &amp; Outlet Consumption vs Packaging Units
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 leading-relaxed max-w-3xl">
              Generates the comprehensive 10-sheet franchise audit workbook containing dedicated sheets for all 6 food and beverage categories (Beverages &amp; Coffee, Burgers, Pizzas, Sandwiches, Garlic Bread, French Fries), full combo decomposition for all 20 packages, raw material recipe specifications with pack multipliers (buns, bases, cheese, fries, momos, pouches), outlet balance summaries, and grand total reconciliations.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs text-slate-600">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-emerald-900">1. Beverages</p>
                <p className="text-[10px] text-slate-500">Coffee, Cold Choc, Shakes</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-emerald-900">2-6. Food Items</p>
                <p className="text-[10px] text-slate-500">Burgers, Pizzas, Sandwiches, etc.</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-emerald-900">7. Combos (20)</p>
                <p className="text-[10px] text-slate-500">Decomposed items</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-emerald-900">8. Recipe Details</p>
                <p className="text-[10px] text-slate-500">BOM &amp; pack multipliers</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <p className="font-bold text-emerald-900">9-10. Summaries</p>
                <p className="text-[10px] text-slate-500">Outlet &amp; Grand totals</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">Native Excel (.xlsx) with formulas (=SUM, =IF, variances)</span>
            <button
              onClick={() => window.open('/api/exports/category-analysis-excel', '_blank')}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download 10-Sheet Category Analysis Workbook (.xlsx)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
