import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet, Download, RefreshCw, Search,
  Utensils, Coffee, Pizza, Sandwich, Sparkles,
  Layers, Package, Building2, ChevronRight, CheckCircle2,
  AlertTriangle, ArrowUpDown, FileDown
} from 'lucide-react';

interface MenuItem {
  name: string;
  size?: string;
  material?: string;
  making_cost?: number;
  qty: number;
  amount: number;
  avg_price: number;
  profit?: number;
  margin?: string;
}

interface OutletRow {
  outlet: string;
  individual_sales_qty: number;
  combo_sales_qty: number;
  total_sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  variance: number;
  sales_amount: number;
}

interface CategoryData {
  raw_material: string;
  items: MenuItem[];
  outlets: OutletRow[];
}

interface ComboItem {
  name: string;
  display_name: string;
  sold_packs: number;
  sales_amount: number;
  burger: number;
  pizza: number;
  sandwich: number;
  garlic_bread: number;
  fries: number;
  beverage: number;
  beverage_name: string;
}

interface RecipeItem {
  item: string;
  pack_spec: string;
  multiplier: number;
  base_unit: string;
  packs_dispatched: number;
  converted_units: number;
  category: string;
  instructions: string;
}

interface OutletSummaryRow {
  outlet: string;
  sales_amount: number;
  individual_items_qty: number;
  combo_items_qty: number;
  total_items_sold: number;
  burgers_sold: number;
  burger_buns_purchased: number;
  pizzas_sold: number;
  pizza_bases_purchased: number;
  sandwiches_sold: number;
  bread_purchased: number;
  fries_sold: number;
  fries_purchased: number;
  garlic_bread_sold: number;
  garlic_bread_purchased: number;
  beverages_sold: number;
}

interface GrandSummaryRow {
  category: string;
  name: string;
  type: string;
  qty: number;
  amount: number;
  avg_price: number;
}

interface AnalysisData {
  categories: Record<string, CategoryData>;
  combos: ComboItem[];
  recipes: RecipeItem[];
  outlet_summary: OutletSummaryRow[];
  grand_summary: GrandSummaryRow[];
}

interface SingleItemAnalysis {
  item_name: string;
  category: string;
  raw_material: string | null;
  pack_desc: string;
  multiplier: number;
  size?: string;
  material?: string;
  making_cost?: number;
  unit_profit?: number;
  margin?: string;
  contributing_combos: Array<{
    combo_raw: string;
    display_name: string;
    units_per_pack: number;
    total_packs_sold: number;
    total_units_consumed: number;
  }>;
  totals: {
    individual_sales_qty: number;
    combo_sales_qty: number;
    total_sales_qty: number;
    purchase_packs: number;
    purchase_units: number;
    variance: number;
    sales_amount: number;
  };
  outlets: OutletRow[];
}

interface AvailableItem {
  name: string;
  category: string;
  total_sold: number;
}

export const CategoryAnalysisPage: React.FC = () => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Single_Item_Analysis');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Single Item Deep Dive State
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [selectedItemName, setSelectedItemName] = useState<string>('coffee 25');
  const [singleItemData, setSingleItemData] = useState<SingleItemAnalysis | null>(null);
  const [loadingSingleItem, setLoadingSingleItem] = useState<boolean>(false);

  const fetchAnalysis = async (force: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/category-analysis${force ? '?force_refresh=true' : ''}`);
      if (!res.ok) throw new Error('Failed to load category analysis');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading analysis');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsList = async () => {
    try {
      const res = await fetch('/api/analytics/items-list');
      if (res.ok) {
        const json = await res.json();
        setAvailableItems(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSingleItem = async (itemName: string) => {
    setLoadingSingleItem(true);
    try {
      const res = await fetch(`/api/analytics/item-analysis?item_name=${encodeURIComponent(itemName)}`);
      if (res.ok) {
        const json = await res.json();
        setSingleItemData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSingleItem(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
    fetchItemsList();
    fetchSingleItem('coffee 25');
  }, []);

  const downloadWorkbook = () => {
    window.open('/api/exports/category-analysis-excel', '_blank');
  };

  const downloadItemExcel = (name?: string) => {
    const itm = name || selectedItemName;
    window.open(`/api/exports/item-excel?item_name=${encodeURIComponent(itm)}`, '_blank');
  };

  const tabs = [
    { id: 'Single_Item_Analysis', label: 'Item + Combos Export', icon: FileDown, highlight: true },
    { id: 'Burgers', label: 'Burgers', icon: Utensils, count: data?.categories?.Burgers?.items?.length },
    { id: 'Beverages', label: 'Beverages & Coffee', icon: Coffee, count: data?.categories?.Beverages?.items?.length },
    { id: 'Pizzas', label: 'Pizzas', icon: Pizza, count: data?.categories?.Pizzas?.items?.length },
    { id: 'Sandwiches', label: 'Sandwiches', icon: Sandwich, count: data?.categories?.Sandwiches?.items?.length },
    { id: 'Garlic Bread', label: 'Garlic Bread', icon: Sparkles, count: data?.categories?.['Garlic Bread']?.items?.length },
    { id: 'French Fries', label: 'French Fries', icon: Sparkles, count: data?.categories?.['French Fries']?.items?.length },
    { id: 'Combos', label: 'Combos Breakdown', icon: Layers, count: data?.combos?.length },
    { id: 'Recipe Details', label: 'Recipes & Pack Units', icon: Package, count: data?.recipes?.length },
    { id: 'Outlet Summary', label: 'Outlet Matrix', icon: Building2, count: data?.outlet_summary?.length },
    { id: 'Grand Summary', label: 'Grand Summary', icon: CheckCircle2, count: data?.grand_summary?.length },
  ];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading comprehensive franchise analytics...</p>
      </div>
    );
  }

  const currentCategory = data?.categories?.[activeTab];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              10-Sheet Multi-Category Engine
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Individual Item &amp; Combos Reconciled
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2 text-white">
            Category, Recipe &amp; Combo Analytics
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Consolidates individual menu sales + combo-included portions with warehouse dispatches, recipes, and outlet-by-outlet reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAnalysis(true)}
            title="Refresh Data"
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={downloadWorkbook}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs md:text-sm shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Download 10-Sheet Workbook (.xlsx)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchFilter('');
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SINGLE ITEM + COMBOS EXPLORER TAB */}
      {activeTab === 'Single_Item_Analysis' && (
        <div className="space-y-6">
          {/* Item Selector Box */}
          <div className="bg-white border-2 border-blue-500/30 rounded-2xl p-6 shadow-md bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/20 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide">
                  Single Item Excel Generator
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  Individual Item + Combos Deep Dive Report
                </h2>
                <p className="text-xs text-slate-500">
                  Select any food or beverage item to view its individual sales, contributing combos, and download its dedicated Excel report.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadItemExcel(selectedItemName)}
                  disabled={loadingSingleItem}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md transition disabled:opacity-40"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel for {selectedItemName} (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Quick Picker Pills */}
            <div className="pt-2">
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-2">
                Quick Select Popular Items:
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'coffee 25', 'Coffee 30', 'Coffee 35', 'Veg Burger',
                  'Cheesy Tangy Burger', 'Pizza Margherita', 'Veg Pizza',
                  'Salted Fries', 'Peri Peri Fries', 'Cheese Mayo Sandwich',
                  'VEG CHEESE GARLIC BREAD'
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setSelectedItemName(item);
                      fetchSingleItem(item);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedItemName.toLowerCase() === item.toLowerCase()
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Searchable Dropdown */}
            <div className="flex items-center gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedItemName}
                  onChange={(e) => {
                    setSelectedItemName(e.target.value);
                    fetchSingleItem(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white outline-none focus:border-blue-500"
                >
                  {availableItems.map((itm, idx) => (
                    <option key={idx} value={itm.name}>
                      [{itm.category}] {itm.name} (Sold: {itm.total_sold.toLocaleString()} units)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Single Item Details & Numbers */}
          {singleItemData && (
            <div className="space-y-6">
              {/* Size, Material & Recipe Costing Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Size / Variant: {singleItemData.size || 'Standard'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      Formulation: {singleItemData.material || 'Standard Formulation'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                      Category: {singleItemData.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{singleItemData.item_name}</h3>
                </div>

                <div className="flex items-center space-x-6 text-right">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Unit Making Cost</p>
                    <p className="text-lg font-black text-rose-300">₹{singleItemData.making_cost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Unit Profit</p>
                    <p className="text-lg font-black text-emerald-300">₹{singleItemData.unit_profit?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Gross Margin</p>
                    <p className="text-lg font-black text-amber-300">{singleItemData.margin || '0.0%'}</p>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Individual Sales</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {singleItemData.totals.individual_sales_qty.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Direct menu orders</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-amber-600">Combo Sales Qty</p>
                  <p className="text-xl font-extrabold text-amber-600 mt-1 tabular-nums">
                    +{singleItemData.totals.combo_sales_qty.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    From {singleItemData.contributing_combos.length} combo packs
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-blue-800">Total Consumption</p>
                  <p className="text-2xl font-black text-blue-900 mt-1 tabular-nums">
                    {singleItemData.totals.total_sales_qty.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-blue-700 mt-0.5">Individual + Combos</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-purple-800">Warehouse Dispatches</p>
                  <p className="text-2xl font-black text-purple-900 mt-1 tabular-nums">
                    {singleItemData.totals.purchase_units.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-purple-700 mt-0.5">{singleItemData.pack_desc}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Variance (S - P)</p>
                  <p
                    className={`text-xl font-extrabold mt-1 tabular-nums ${
                      singleItemData.totals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {singleItemData.totals.variance > 0
                      ? `+${singleItemData.totals.variance.toLocaleString()}`
                      : singleItemData.totals.variance.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Balance vs stock</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Revenue</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    ₹{Math.round(singleItemData.totals.sales_amount).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Direct sales value</p>
                </div>
              </div>

              {/* Contributing Combos Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      1. Contributing Combos Containing &quot;{singleItemData.item_name}&quot;
                    </h3>
                    <p className="text-xs text-slate-500">
                      Shows how many combo packages were sold and how many units of {singleItemData.item_name} were consumed through each offer.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                    {singleItemData.contributing_combos.length} Contributing Combos
                  </span>
                </div>

                {singleItemData.contributing_combos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-bold">
                        <tr>
                          <th className="py-2.5 px-4">Combo Offer Name</th>
                          <th className="py-2.5 px-4 text-center">Units per Pack</th>
                          <th className="py-2.5 px-4 text-right">Total Combo Packs Sold</th>
                          <th className="py-2.5 px-4 text-right bg-blue-50/80 text-blue-900 font-bold">
                            Total Item Units Consumed
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {singleItemData.contributing_combos.map((cb, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              {cb.display_name}
                            </td>
                            <td className="py-2.5 px-4 text-center font-bold text-slate-700">
                              {cb.units_per_pack}x
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">
                              {cb.total_packs_sold.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-blue-700 bg-blue-50/30">
                              {cb.total_units_consumed.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    This item is sold exclusively as an individual menu item and is not bundled into any combo package.
                  </div>
                )}
              </div>

              {/* Outlet Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      2. Outlet-Wise Sales &amp; Purchase Reconciliation for &quot;{singleItemData.item_name}&quot;
                    </h3>
                    <p className="text-xs text-slate-500">
                      Shows exact individual sales, combo portions, total consumption, and warehouse dispatches for each outlet.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-full md:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search outlet..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => downloadItemExcel(singleItemData.item_name)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Excel</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 z-10 shadow-sm">
                      <tr>
                        <th className="py-3 px-4">Outlet Name</th>
                        <th className="py-3 px-4 text-right">Individual Sales</th>
                        <th className="py-3 px-4 text-right">Combo Sales</th>
                        <th className="py-3 px-4 text-right bg-blue-50/80 text-blue-900">Total Sales Qty</th>
                        <th className="py-3 px-4 text-right">Purchase (Packs)</th>
                        <th className="py-3 px-4 text-right bg-purple-50/80 text-purple-900">Purchase (Units)</th>
                        <th className="py-3 px-4 text-right">Variance (S - P)</th>
                        <th className="py-3 px-4 text-right">Revenue (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {singleItemData.outlets
                        .filter((r) =>
                          searchFilter
                            ? r.outlet.toLowerCase().includes(searchFilter.toLowerCase())
                            : true
                        )
                        .map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{row.outlet}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {row.individual_sales_qty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {row.combo_sales_qty > 0 ? (
                                <span className="text-amber-600 font-bold">
                                  +{row.combo_sales_qty.toLocaleString()}
                                </span>
                              ) : (
                                '0'
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-blue-800 bg-blue-50/40">
                              {row.total_sales_qty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              {row.purchase_packs.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-purple-800 bg-purple-50/40">
                              {row.purchase_units.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  row.variance >= 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {row.variance > 0
                                  ? `+${row.variance.toLocaleString()}`
                                  : row.variance.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                              ₹{Math.round(row.sales_amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-blue-900 text-white font-extrabold z-10 shadow-lg text-xs">
                      <tr>
                        <td className="py-3 px-4">Grand Total</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {singleItemData.totals.individual_sales_qty.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-amber-300">
                          +{singleItemData.totals.combo_sales_qty.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-blue-200">
                          {singleItemData.totals.total_sales_qty.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {singleItemData.totals.purchase_packs.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-purple-200">
                          {singleItemData.totals.purchase_units.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {singleItemData.totals.variance > 0
                            ? `+${singleItemData.totals.variance.toLocaleString()}`
                            : singleItemData.totals.variance.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          ₹{Math.round(singleItemData.totals.sales_amount).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area based on Active Tab (Categories) */}
      {currentCategory && (
        <div className="space-y-6">
          {/* Category Top Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-slate-900">{activeTab} Sales &amp; Dispatches</h2>
                {currentCategory.raw_material && (
                  <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                    Raw Material: {currentCategory.raw_material}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Shows all individual menu items in this category plus outlet-level sales vs warehouse receipts.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center space-x-6 text-right">
              <div>
                <p className="text-[11px] uppercase font-bold text-slate-400">Total Sold Units</p>
                <p className="text-lg font-black text-slate-800">
                  {currentCategory.items.reduce((s, x) => s + x.qty, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-bold text-slate-400">Total Revenue</p>
                <p className="text-lg font-black text-emerald-600">
                  ₹{Math.round(currentCategory.items.reduce((s, x) => s + x.amount, 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Section A: Individual Menu Items Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">A. Individual Menu Items Breakdown</h3>
                <p className="text-xs text-slate-500">
                  Every flavor and variant sold in {activeTab}. Click any item to export its dedicated Excel report.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {currentCategory.items.length} Variants
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4">Size / Variant</th>
                    <th className="py-2.5 px-4">Material &amp; Cheese Spec</th>
                    <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                    <th className="py-2.5 px-4 text-right">Sales Qty</th>
                    <th className="py-2.5 px-4 text-right">Total Revenue (₹)</th>
                    <th className="py-2.5 px-4 text-right">Avg Price (₹)</th>
                    <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                    <th className="py-2.5 px-4 text-center">Margin %</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentCategory.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.size || 'Standard'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={item.material}>
                        {item.material || 'Standard Formulation'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-700 tabular-nums">
                        ₹{(item.making_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-800 tabular-nums">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                        ₹{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-600 tabular-nums">
                        ₹{item.avg_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                        ₹{(item.profit || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                          {item.margin || '0.0%'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedItemName(item.name);
                            fetchSingleItem(item.name);
                            setActiveTab('Single_Item_Analysis');
                            window.scrollTo({ top: 120, behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-md font-bold text-[11px] border border-blue-200 transition inline-flex items-center space-x-1"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>View Combos &amp; Excel</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Outlet-Wise Reconciliation Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  B. Outlet-Wise Analysis: Individual Sales vs Combo Sales vs Purchases
                </h3>
                <p className="text-xs text-slate-500">
                  Reconciles individual item consumption + combo-included portions against warehouse material dispatches.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter outlet name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-4">Outlet Name</th>
                    <th className="py-3 px-4 text-right">Individual Sales</th>
                    <th className="py-3 px-4 text-right">Combo Sales</th>
                    <th className="py-3 px-4 text-right bg-blue-50/80 text-blue-900">Total Sales Qty</th>
                    <th className="py-3 px-4 text-right">Purchase (Packs)</th>
                    <th className="py-3 px-4 text-right bg-purple-50/80 text-purple-900">Purchase (Units)</th>
                    <th className="py-3 px-4 text-right">Variance (S - P)</th>
                    <th className="py-3 px-4 text-right">Sales Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentCategory.outlets
                    .filter((row) =>
                      searchFilter
                        ? row.outlet.toLowerCase().includes(searchFilter.toLowerCase())
                        : true
                    )
                    .map((row, idx) => {
                      const isGrandTotal = row.outlet === 'Grand Total';
                      return (
                        <tr
                          key={idx}
                          className={`${
                            isGrandTotal
                              ? 'bg-blue-900 text-white font-bold sticky bottom-0 z-10 shadow-lg'
                              : 'hover:bg-slate-50 transition'
                          }`}
                        >
                          <td className={`py-2.5 px-4 ${isGrandTotal ? 'font-extrabold text-white text-sm' : 'font-semibold text-slate-800'}`}>
                            {row.outlet}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.individual_sales_qty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.combo_sales_qty > 0 ? (
                              <span className={isGrandTotal ? 'text-amber-300 font-bold' : 'text-amber-600 font-semibold'}>
                                +{row.combo_sales_qty.toLocaleString()}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className={`py-2.5 px-4 text-right tabular-nums font-bold ${isGrandTotal ? 'text-blue-200' : 'bg-blue-50/50 text-blue-800'}`}>
                            {row.total_sales_qty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.purchase_packs.toLocaleString()}
                          </td>
                          <td className={`py-2.5 px-4 text-right tabular-nums font-bold ${isGrandTotal ? 'text-purple-200' : 'bg-purple-50/50 text-purple-800'}`}>
                            {row.purchase_units.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isGrandTotal
                                  ? row.variance >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
                                  : row.variance >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {row.variance > 0 ? `+${row.variance.toLocaleString()}` : row.variance.toLocaleString()}
                            </span>
                          </td>
                          <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${isGrandTotal ? 'text-white' : 'text-slate-900'}`}>
                            ₹{Math.round(row.sales_amount).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Detailed Recipe Bill of Materials & Unit Economics */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                B. Recipe Bill of Materials (BOM), Unit Costing &amp; Profit Margins
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ingredient breakdown: bread, tikki, oil, vegetables, cheese/mozzarella, packaging, unit making cost, sale price, profit, and margin %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                High Margin: &ge; 48%
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                Low Margin: &le; 35%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Size / Variant</th>
                  <th className="py-2.5 px-4">Cheese / Formulation</th>
                  <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                  <th className="py-2.5 px-4 text-center">Margin %</th>
                  <th className="py-2.5 px-4 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Pizzas', name: 'CORN PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Corn', cost: 31.08, sale: 100, profit: 68.92, margin: '68.9%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 2 DIP 70', size: 'With Dips 70', cheese: 'Dips Included', cost: 22.00, sale: 70, profit: 48.00, margin: '68.6%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'TANDOORI PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Paneer', cost: 36.69, sale: 100, profit: 63.31, margin: '63.3%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'GREEN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney', cost: 30.00, sale: 80, profit: 50.00, margin: '62.5%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'SCHEZWAN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan', cost: 36.25, sale: 80, profit: 43.75, margin: '54.7%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'PERI FRIES 55', size: 'Seasoned 55', cheese: 'No Cheese', cost: 24.96, sale: 55, profit: 30.04, margin: '54.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese (Blend)', cost: 27.39, sale: 60, profit: 32.61, margin: '54.4%', cls: 'High Margin' },
                  { cat: 'Garlic Bread', name: 'VEG CHEESE GARLIC BREAD', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese', cost: 36.60, sale: 78, profit: 41.40, margin: '53.1%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 45', size: 'Standard 45', cheese: 'No Cheese', cost: 21.40, sale: 45, profit: 23.60, margin: '52.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANGY CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 19.60, sale: 40, profit: 20.40, margin: '51.0%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN TWISTER 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 24.70, sale: 50, profit: 25.30, margin: '50.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANDOORI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'PERI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'MARGHERITA PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 25.95, sale: 50, profit: 24.05, margin: '48.1%', cls: 'High Margin' },
                  { cat: 'Sandwiches', name: 'FLAVOURED MAYO SANDWICH 75', size: 'Premium 75', cheese: 'Without Cheese', cost: 39.73, sale: 75, profit: 35.27, margin: '47.0%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese', cost: 32.39, sale: 60, profit: 27.61, margin: '46.0%', cls: 'Medium Margin' },
                  { cat: 'Pizzas', name: 'VEG PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 27.95, sale: 50, profit: 22.05, margin: '44.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANDOORI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'PERI PERI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 45', size: 'Bigger (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 45, profit: 19.25, margin: '42.8%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 29', size: 'Regular (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 29, profit: 12.20, margin: '42.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 29.70, sale: 50, profit: 20.30, margin: '40.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SIMPLY VEG 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.30, sale: 30, profit: 11.70, margin: '39.0%', cls: 'Medium Margin' },
                  { cat: 'Garlic Bread', name: 'PLAIN GARLIC BREAD', size: 'Standard 36', cheese: 'Without Cheese', cost: 36.25, sale: 59, profit: 22.75, margin: '38.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 24.89, sale: 40, profit: 15.11, margin: '37.8%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANGY 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 25', size: 'Small (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 25, profit: 8.20, margin: '32.8%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 30', size: 'Medium (300ml)', cheese: 'No Cheese', cost: 20.30, sale: 30, profit: 9.70, margin: '32.3%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 35', size: 'Large (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 35, profit: 9.25, margin: '26.4%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'MAYO SANDWICH 45', size: 'Standard 45', cheese: 'Without Cheese', cost: 37.03, sale: 45, profit: 7.97, margin: '17.7%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER SANDWICH 30', size: 'Simple 30', cheese: 'Without Cheese', cost: 24.88, sale: 30, profit: 5.12, margin: '17.1%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'CHEESE MAYO SANDWICH 65', size: 'Cheesy 65', cheese: 'With Cheese', cost: 54.03, sale: 65, profit: 10.97, margin: '16.9%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER CHUTNEY 35', size: 'Simple 35', cheese: 'Without Cheese', cost: 29.38, sale: 35, profit: 5.62, margin: '16.1%', cls: 'Low Margin' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.cat}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.size}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{item.cheese}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700 tabular-nums">
                      ₹{item.cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{item.sale.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-800">
                      {item.margin}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.cls === 'High Margin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.cls === 'Low Margin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMBOS TAB */}
      {activeTab === 'Combos' && data?.combos && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Combos Master &amp; Component Disaggregation</h3>
              <p className="text-xs text-slate-500">
                Detailed decomposition of all 20 franchise combos into individual component counts (Burgers, Pizzas, Sandwiches, Fries, Beverages, etc.)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Combo Packs Sold: </span>
              <span className="text-sm font-extrabold text-blue-700">
                {data.combos.reduce((s, c) => s + c.sold_packs, 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Combo Name</th>
                  <th className="py-3 px-4 text-right">Packs Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                  <th className="py-3 px-4 text-center">Burgers</th>
                  <th className="py-3 px-4 text-center">Pizzas</th>
                  <th className="py-3 px-4 text-center">Sandwiches</th>
                  <th className="py-3 px-4 text-center">Fries</th>
                  <th className="py-3 px-4 text-center">Garlic Bread</th>
                  <th className="py-3 px-4 text-center">Beverage Included</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.combos.map((c, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{c.display_name || c.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{c.name}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-blue-700 tabular-nums text-sm">
                      {c.sold_packs.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                      ₹{c.sales_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {c.burger > 0 ? <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded">{c.burger}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {c.pizza > 0 ? <span className="px-2 py-0.5 bg-red-100 text-red-900 rounded">{c.pizza}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {c.sandwich > 0 ? <span className="px-2 py-0.5 bg-green-100 text-green-900 rounded">{c.sandwich}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {c.fries > 0 ? <span className="px-2 py-0.5 bg-yellow-100 text-yellow-900 rounded">{c.fries}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {c.garlic_bread > 0 ? <span className="px-2 py-0.5 bg-orange-100 text-orange-900 rounded">{c.garlic_bread}</span> : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.beverage > 0 ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[11px]">
                          {c.beverage}x {c.beverage_name || 'Drink'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section B: Detailed Recipe Bill of Materials & Unit Economics */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                B. Recipe Bill of Materials (BOM), Unit Costing &amp; Profit Margins
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ingredient breakdown: bread, tikki, oil, vegetables, cheese/mozzarella, packaging, unit making cost, sale price, profit, and margin %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                High Margin: &ge; 48%
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                Low Margin: &le; 35%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Size / Variant</th>
                  <th className="py-2.5 px-4">Cheese / Formulation</th>
                  <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                  <th className="py-2.5 px-4 text-center">Margin %</th>
                  <th className="py-2.5 px-4 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Pizzas', name: 'CORN PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Corn', cost: 31.08, sale: 100, profit: 68.92, margin: '68.9%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 2 DIP 70', size: 'With Dips 70', cheese: 'Dips Included', cost: 22.00, sale: 70, profit: 48.00, margin: '68.6%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'TANDOORI PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Paneer', cost: 36.69, sale: 100, profit: 63.31, margin: '63.3%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'GREEN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney', cost: 30.00, sale: 80, profit: 50.00, margin: '62.5%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'SCHEZWAN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan', cost: 36.25, sale: 80, profit: 43.75, margin: '54.7%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'PERI FRIES 55', size: 'Seasoned 55', cheese: 'No Cheese', cost: 24.96, sale: 55, profit: 30.04, margin: '54.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese (Blend)', cost: 27.39, sale: 60, profit: 32.61, margin: '54.4%', cls: 'High Margin' },
                  { cat: 'Garlic Bread', name: 'VEG CHEESE GARLIC BREAD', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese', cost: 36.60, sale: 78, profit: 41.40, margin: '53.1%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 45', size: 'Standard 45', cheese: 'No Cheese', cost: 21.40, sale: 45, profit: 23.60, margin: '52.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANGY CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 19.60, sale: 40, profit: 20.40, margin: '51.0%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN TWISTER 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 24.70, sale: 50, profit: 25.30, margin: '50.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANDOORI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'PERI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'MARGHERITA PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 25.95, sale: 50, profit: 24.05, margin: '48.1%', cls: 'High Margin' },
                  { cat: 'Sandwiches', name: 'FLAVOURED MAYO SANDWICH 75', size: 'Premium 75', cheese: 'Without Cheese', cost: 39.73, sale: 75, profit: 35.27, margin: '47.0%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese', cost: 32.39, sale: 60, profit: 27.61, margin: '46.0%', cls: 'Medium Margin' },
                  { cat: 'Pizzas', name: 'VEG PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 27.95, sale: 50, profit: 22.05, margin: '44.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANDOORI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'PERI PERI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 45', size: 'Bigger (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 45, profit: 19.25, margin: '42.8%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 29', size: 'Regular (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 29, profit: 12.20, margin: '42.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 29.70, sale: 50, profit: 20.30, margin: '40.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SIMPLY VEG 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.30, sale: 30, profit: 11.70, margin: '39.0%', cls: 'Medium Margin' },
                  { cat: 'Garlic Bread', name: 'PLAIN GARLIC BREAD', size: 'Standard 36', cheese: 'Without Cheese', cost: 36.25, sale: 59, profit: 22.75, margin: '38.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 24.89, sale: 40, profit: 15.11, margin: '37.8%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANGY 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 25', size: 'Small (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 25, profit: 8.20, margin: '32.8%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 30', size: 'Medium (300ml)', cheese: 'No Cheese', cost: 20.30, sale: 30, profit: 9.70, margin: '32.3%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 35', size: 'Large (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 35, profit: 9.25, margin: '26.4%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'MAYO SANDWICH 45', size: 'Standard 45', cheese: 'Without Cheese', cost: 37.03, sale: 45, profit: 7.97, margin: '17.7%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER SANDWICH 30', size: 'Simple 30', cheese: 'Without Cheese', cost: 24.88, sale: 30, profit: 5.12, margin: '17.1%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'CHEESE MAYO SANDWICH 65', size: 'Cheesy 65', cheese: 'With Cheese', cost: 54.03, sale: 65, profit: 10.97, margin: '16.9%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER CHUTNEY 35', size: 'Simple 35', cheese: 'Without Cheese', cost: 29.38, sale: 35, profit: 5.62, margin: '16.1%', cls: 'Low Margin' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.cat}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.size}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{item.cheese}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700 tabular-nums">
                      ₹{item.cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{item.sale.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-800">
                      {item.margin}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.cls === 'High Margin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.cls === 'Low Margin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECIPES & PACKAGING TAB */}
      {activeTab === 'Recipe Details' && data?.recipes && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Recipe Details, Pack Specs &amp; Bill of Materials (BOM)</h3>
              <p className="text-xs text-slate-500">
                Central warehouse dispatch sizes, unit multipliers, and preparation usage formulas.
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {data.recipes.length} Verified Raw Materials
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Raw Material / Item</th>
                  <th className="py-3 px-4">Pack Specification</th>
                  <th className="py-3 px-4 text-center">Multiplier</th>
                  <th className="py-3 px-4">Base Unit</th>
                  <th className="py-3 px-4 text-right">Packs Dispatched</th>
                  <th className="py-3 px-4 text-right font-bold text-blue-900">Total Converted Units</th>
                  <th className="py-3 px-4">Category Mapped</th>
                  <th className="py-3 px-4">Recipe &amp; Usage Formula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recipes.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{r.item}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{r.pack_spec}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {r.multiplier > 0 ? r.multiplier : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{r.base_unit}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800 tabular-nums">
                      {r.packs_dispatched > 0 ? r.packs_dispatched.toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-blue-700 tabular-nums text-sm">
                      {r.converted_units > 0 ? r.converted_units.toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                        {r.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs leading-relaxed">
                      {r.instructions || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section B: Detailed Recipe Bill of Materials & Unit Economics */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                B. Recipe Bill of Materials (BOM), Unit Costing &amp; Profit Margins
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ingredient breakdown: bread, tikki, oil, vegetables, cheese/mozzarella, packaging, unit making cost, sale price, profit, and margin %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                High Margin: &ge; 48%
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                Low Margin: &le; 35%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Size / Variant</th>
                  <th className="py-2.5 px-4">Cheese / Formulation</th>
                  <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                  <th className="py-2.5 px-4 text-center">Margin %</th>
                  <th className="py-2.5 px-4 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Pizzas', name: 'CORN PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Corn', cost: 31.08, sale: 100, profit: 68.92, margin: '68.9%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 2 DIP 70', size: 'With Dips 70', cheese: 'Dips Included', cost: 22.00, sale: 70, profit: 48.00, margin: '68.6%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'TANDOORI PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Paneer', cost: 36.69, sale: 100, profit: 63.31, margin: '63.3%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'GREEN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney', cost: 30.00, sale: 80, profit: 50.00, margin: '62.5%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'SCHEZWAN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan', cost: 36.25, sale: 80, profit: 43.75, margin: '54.7%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'PERI FRIES 55', size: 'Seasoned 55', cheese: 'No Cheese', cost: 24.96, sale: 55, profit: 30.04, margin: '54.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese (Blend)', cost: 27.39, sale: 60, profit: 32.61, margin: '54.4%', cls: 'High Margin' },
                  { cat: 'Garlic Bread', name: 'VEG CHEESE GARLIC BREAD', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese', cost: 36.60, sale: 78, profit: 41.40, margin: '53.1%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 45', size: 'Standard 45', cheese: 'No Cheese', cost: 21.40, sale: 45, profit: 23.60, margin: '52.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANGY CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 19.60, sale: 40, profit: 20.40, margin: '51.0%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN TWISTER 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 24.70, sale: 50, profit: 25.30, margin: '50.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANDOORI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'PERI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'MARGHERITA PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 25.95, sale: 50, profit: 24.05, margin: '48.1%', cls: 'High Margin' },
                  { cat: 'Sandwiches', name: 'FLAVOURED MAYO SANDWICH 75', size: 'Premium 75', cheese: 'Without Cheese', cost: 39.73, sale: 75, profit: 35.27, margin: '47.0%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese', cost: 32.39, sale: 60, profit: 27.61, margin: '46.0%', cls: 'Medium Margin' },
                  { cat: 'Pizzas', name: 'VEG PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 27.95, sale: 50, profit: 22.05, margin: '44.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANDOORI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'PERI PERI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 45', size: 'Bigger (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 45, profit: 19.25, margin: '42.8%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 29', size: 'Regular (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 29, profit: 12.20, margin: '42.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 29.70, sale: 50, profit: 20.30, margin: '40.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SIMPLY VEG 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.30, sale: 30, profit: 11.70, margin: '39.0%', cls: 'Medium Margin' },
                  { cat: 'Garlic Bread', name: 'PLAIN GARLIC BREAD', size: 'Standard 36', cheese: 'Without Cheese', cost: 36.25, sale: 59, profit: 22.75, margin: '38.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 24.89, sale: 40, profit: 15.11, margin: '37.8%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANGY 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 25', size: 'Small (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 25, profit: 8.20, margin: '32.8%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 30', size: 'Medium (300ml)', cheese: 'No Cheese', cost: 20.30, sale: 30, profit: 9.70, margin: '32.3%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 35', size: 'Large (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 35, profit: 9.25, margin: '26.4%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'MAYO SANDWICH 45', size: 'Standard 45', cheese: 'Without Cheese', cost: 37.03, sale: 45, profit: 7.97, margin: '17.7%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER SANDWICH 30', size: 'Simple 30', cheese: 'Without Cheese', cost: 24.88, sale: 30, profit: 5.12, margin: '17.1%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'CHEESE MAYO SANDWICH 65', size: 'Cheesy 65', cheese: 'With Cheese', cost: 54.03, sale: 65, profit: 10.97, margin: '16.9%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER CHUTNEY 35', size: 'Simple 35', cheese: 'Without Cheese', cost: 29.38, sale: 35, profit: 5.62, margin: '16.1%', cls: 'Low Margin' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.cat}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.size}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{item.cheese}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700 tabular-nums">
                      ₹{item.cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{item.sale.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-800">
                      {item.margin}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.cls === 'High Margin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.cls === 'Low Margin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OUTLET SUMMARY MATRIX TAB */}
      {activeTab === 'Outlet Summary' && data?.outlet_summary && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Outlet-Wise Cross-Category Balance Matrix</h3>
              <p className="text-xs text-slate-500">
                Consolidated sales revenue, total individual and combo sales, and raw material balance across all franchise outlets.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter outlet..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 z-10">
                <tr>
                  <th className="py-3 px-4">Outlet Name</th>
                  <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                  <th className="py-3 px-4 text-right">Items Sold</th>
                  <th className="py-3 px-4 text-right">Burgers Sold</th>
                  <th className="py-3 px-4 text-right">Buns Purchased</th>
                  <th className="py-3 px-4 text-right">Pizzas Sold</th>
                  <th className="py-3 px-4 text-right">Bases Purchased</th>
                  <th className="py-3 px-4 text-right">Sandwiches Sold</th>
                  <th className="py-3 px-4 text-right">Fries Sold</th>
                  <th className="py-3 px-4 text-right">Beverages Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.outlet_summary
                  .filter((row) => (searchFilter ? row.outlet.toLowerCase().includes(searchFilter.toLowerCase()) : true))
                  .map((row, idx) => {
                    const isTotal = row.outlet === 'Grand Total';
                    return (
                      <tr
                        key={idx}
                        className={`${
                          isTotal ? 'bg-blue-900 text-white font-extrabold sticky bottom-0 z-10' : 'hover:bg-slate-50 transition'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-semibold">{row.outlet}</td>
                        <td className="py-2.5 px-4 text-right font-bold tabular-nums">
                          ₹{Math.round(row.sales_amount).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                          {row.total_items_sold.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-amber-700 font-semibold">
                          {row.burgers_sold.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                          {row.burger_buns_purchased.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-rose-700 font-semibold">
                          {row.pizzas_sold.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-medium">
                          {row.pizza_bases_purchased.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700 font-semibold">
                          {row.sandwiches_sold.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-yellow-700 font-semibold">
                          {row.fries_sold.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-blue-700 font-semibold">
                          {row.beverages_sold.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Section B: Detailed Recipe Bill of Materials & Unit Economics */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                B. Recipe Bill of Materials (BOM), Unit Costing &amp; Profit Margins
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ingredient breakdown: bread, tikki, oil, vegetables, cheese/mozzarella, packaging, unit making cost, sale price, profit, and margin %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                High Margin: &ge; 48%
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                Low Margin: &le; 35%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Size / Variant</th>
                  <th className="py-2.5 px-4">Cheese / Formulation</th>
                  <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                  <th className="py-2.5 px-4 text-center">Margin %</th>
                  <th className="py-2.5 px-4 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Pizzas', name: 'CORN PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Corn', cost: 31.08, sale: 100, profit: 68.92, margin: '68.9%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 2 DIP 70', size: 'With Dips 70', cheese: 'Dips Included', cost: 22.00, sale: 70, profit: 48.00, margin: '68.6%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'TANDOORI PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Paneer', cost: 36.69, sale: 100, profit: 63.31, margin: '63.3%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'GREEN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney', cost: 30.00, sale: 80, profit: 50.00, margin: '62.5%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'SCHEZWAN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan', cost: 36.25, sale: 80, profit: 43.75, margin: '54.7%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'PERI FRIES 55', size: 'Seasoned 55', cheese: 'No Cheese', cost: 24.96, sale: 55, profit: 30.04, margin: '54.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese (Blend)', cost: 27.39, sale: 60, profit: 32.61, margin: '54.4%', cls: 'High Margin' },
                  { cat: 'Garlic Bread', name: 'VEG CHEESE GARLIC BREAD', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese', cost: 36.60, sale: 78, profit: 41.40, margin: '53.1%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 45', size: 'Standard 45', cheese: 'No Cheese', cost: 21.40, sale: 45, profit: 23.60, margin: '52.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANGY CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 19.60, sale: 40, profit: 20.40, margin: '51.0%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN TWISTER 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 24.70, sale: 50, profit: 25.30, margin: '50.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANDOORI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'PERI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'MARGHERITA PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 25.95, sale: 50, profit: 24.05, margin: '48.1%', cls: 'High Margin' },
                  { cat: 'Sandwiches', name: 'FLAVOURED MAYO SANDWICH 75', size: 'Premium 75', cheese: 'Without Cheese', cost: 39.73, sale: 75, profit: 35.27, margin: '47.0%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese', cost: 32.39, sale: 60, profit: 27.61, margin: '46.0%', cls: 'Medium Margin' },
                  { cat: 'Pizzas', name: 'VEG PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 27.95, sale: 50, profit: 22.05, margin: '44.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANDOORI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'PERI PERI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 45', size: 'Bigger (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 45, profit: 19.25, margin: '42.8%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 29', size: 'Regular (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 29, profit: 12.20, margin: '42.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 29.70, sale: 50, profit: 20.30, margin: '40.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SIMPLY VEG 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.30, sale: 30, profit: 11.70, margin: '39.0%', cls: 'Medium Margin' },
                  { cat: 'Garlic Bread', name: 'PLAIN GARLIC BREAD', size: 'Standard 36', cheese: 'Without Cheese', cost: 36.25, sale: 59, profit: 22.75, margin: '38.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 24.89, sale: 40, profit: 15.11, margin: '37.8%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANGY 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 25', size: 'Small (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 25, profit: 8.20, margin: '32.8%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 30', size: 'Medium (300ml)', cheese: 'No Cheese', cost: 20.30, sale: 30, profit: 9.70, margin: '32.3%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 35', size: 'Large (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 35, profit: 9.25, margin: '26.4%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'MAYO SANDWICH 45', size: 'Standard 45', cheese: 'Without Cheese', cost: 37.03, sale: 45, profit: 7.97, margin: '17.7%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER SANDWICH 30', size: 'Simple 30', cheese: 'Without Cheese', cost: 24.88, sale: 30, profit: 5.12, margin: '17.1%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'CHEESE MAYO SANDWICH 65', size: 'Cheesy 65', cheese: 'With Cheese', cost: 54.03, sale: 65, profit: 10.97, margin: '16.9%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER CHUTNEY 35', size: 'Simple 35', cheese: 'Without Cheese', cost: 29.38, sale: 35, profit: 5.62, margin: '16.1%', cls: 'Low Margin' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.cat}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.size}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{item.cheese}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700 tabular-nums">
                      ₹{item.cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{item.sale.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-800">
                      {item.margin}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.cls === 'High Margin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.cls === 'Low Margin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRAND SUMMARY TAB */}
      {activeTab === 'Grand Summary' && data?.grand_summary && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Grand Summary: All Menu Items &amp; Combos Consolidated</h3>
              <p className="text-xs text-slate-500">
                Complete reconciliation of every food item, beverage, and combo sold across all outlets.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter item name or category..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 z-10">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Item / Combo Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Total Qty Sold</th>
                  <th className="py-3 px-4 text-right">Total Sales Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Average Price (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.grand_summary
                  .filter((row) =>
                    searchFilter
                      ? row.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        row.category.toLowerCase().includes(searchFilter.toLowerCase())
                      : true
                  )
                  .map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{row.category}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{row.name}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.type === 'Combo Item'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-blue-700 tabular-nums">
                        {row.qty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                        ₹{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-600 tabular-nums">
                        ₹{row.avg_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Section B: Detailed Recipe Bill of Materials & Unit Economics */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                B. Recipe Bill of Materials (BOM), Unit Costing &amp; Profit Margins
              </h3>
              <p className="text-xs text-slate-500">
                Detailed ingredient breakdown: bread, tikki, oil, vegetables, cheese/mozzarella, packaging, unit making cost, sale price, profit, and margin %.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                High Margin: &ge; 48%
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                Low Margin: &le; 35%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">Size / Variant</th>
                  <th className="py-2.5 px-4">Cheese / Formulation</th>
                  <th className="py-2.5 px-4 text-right">Making Cost (₹)</th>
                  <th className="py-2.5 px-4 text-right">Sale Price (₹)</th>
                  <th className="py-2.5 px-4 text-right">Unit Profit (₹)</th>
                  <th className="py-2.5 px-4 text-center">Margin %</th>
                  <th className="py-2.5 px-4 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { cat: 'Pizzas', name: 'CORN PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Corn', cost: 31.08, sale: 100, profit: 68.92, margin: '68.9%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 2 DIP 70', size: 'With Dips 70', cheese: 'Dips Included', cost: 22.00, sale: 70, profit: 48.00, margin: '68.6%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'TANDOORI PIZZA 100', size: 'Premium 100', cheese: 'With Mozzarella + Paneer', cost: 36.69, sale: 100, profit: 63.31, margin: '63.3%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'GREEN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Chutney', cost: 30.00, sale: 80, profit: 50.00, margin: '62.5%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'SCHEZWAN PIZZA 80', size: 'Deluxe 80', cheese: 'With Mozzarella & Schezwan', cost: 36.25, sale: 80, profit: 43.75, margin: '54.7%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'PERI FRIES 55', size: 'Seasoned 55', cheese: 'No Cheese', cost: 24.96, sale: 55, profit: 30.04, margin: '54.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese (Blend)', cost: 27.39, sale: 60, profit: 32.61, margin: '54.4%', cls: 'High Margin' },
                  { cat: 'Garlic Bread', name: 'VEG CHEESE GARLIC BREAD', size: 'Cheesy 78', cheese: 'With Mozzarella Cheese', cost: 36.60, sale: 78, profit: 41.40, margin: '53.1%', cls: 'High Margin' },
                  { cat: 'French Fries', name: 'FRIES 45', size: 'Standard 45', cheese: 'No Cheese', cost: 21.40, sale: 45, profit: 23.60, margin: '52.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANGY CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 19.60, sale: 40, profit: 20.40, margin: '51.0%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'GREEN TWISTER 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 24.70, sale: 50, profit: 25.30, margin: '50.6%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'TANDOORI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Burgers', name: 'PERI CHEEZY 50', size: 'Cheesy 50', cheese: 'With Cheese', cost: 25.29, sale: 50, profit: 24.71, margin: '49.4%', cls: 'High Margin' },
                  { cat: 'Pizzas', name: 'MARGHERITA PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 25.95, sale: 50, profit: 24.05, margin: '48.1%', cls: 'High Margin' },
                  { cat: 'Sandwiches', name: 'FLAVOURED MAYO SANDWICH 75', size: 'Premium 75', cheese: 'Without Cheese', cost: 39.73, sale: 75, profit: 35.27, margin: '47.0%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN CHEEZY 60', size: 'Cheesy 60', cheese: 'With Cheese', cost: 32.39, sale: 60, profit: 27.61, margin: '46.0%', cls: 'Medium Margin' },
                  { cat: 'Pizzas', name: 'VEG PIZZA 50', size: 'Standard 50', cheese: 'With Mozzarella', cost: 27.95, sale: 50, profit: 22.05, margin: '44.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANDOORI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'PERI PERI 40', size: 'Premium 40', cheese: 'Without Cheese', cost: 22.60, sale: 40, profit: 17.40, margin: '43.5%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 45', size: 'Bigger (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 45, profit: 19.25, margin: '42.8%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'CHOCOLATE 29', size: 'Regular (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 29, profit: 12.20, margin: '42.1%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SCHEZWAN 50', size: 'Deluxe 50', cheese: 'Without Cheese', cost: 29.70, sale: 50, profit: 20.30, margin: '40.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'SIMPLY VEG 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.30, sale: 30, profit: 11.70, margin: '39.0%', cls: 'Medium Margin' },
                  { cat: 'Garlic Bread', name: 'PLAIN GARLIC BREAD', size: 'Standard 36', cheese: 'Without Cheese', cost: 36.25, sale: 59, profit: 22.75, margin: '38.6%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA CHEEZY 40', size: 'Cheesy 40', cheese: 'With Cheese', cost: 24.89, sale: 40, profit: 15.11, margin: '37.8%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'TANGY 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Burgers', name: 'CHATPATA 30', size: 'Standard 30', cheese: 'Without Cheese', cost: 18.80, sale: 30, profit: 11.20, margin: '37.3%', cls: 'Medium Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 25', size: 'Small (250ml)', cheese: 'No Cheese', cost: 16.80, sale: 25, profit: 8.20, margin: '32.8%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 30', size: 'Medium (300ml)', cheese: 'No Cheese', cost: 20.30, sale: 30, profit: 9.70, margin: '32.3%', cls: 'Low Margin' },
                  { cat: 'Beverages', name: 'COLD COFFEE 35', size: 'Large (350ml)', cheese: 'No Cheese', cost: 25.75, sale: 35, profit: 9.25, margin: '26.4%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'MAYO SANDWICH 45', size: 'Standard 45', cheese: 'Without Cheese', cost: 37.03, sale: 45, profit: 7.97, margin: '17.7%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER SANDWICH 30', size: 'Simple 30', cheese: 'Without Cheese', cost: 24.88, sale: 30, profit: 5.12, margin: '17.1%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'CHEESE MAYO SANDWICH 65', size: 'Cheesy 65', cheese: 'With Cheese', cost: 54.03, sale: 65, profit: 10.97, margin: '16.9%', cls: 'Low Margin' },
                  { cat: 'Sandwiches', name: 'BREAD BUTTER CHUTNEY 35', size: 'Simple 35', cheese: 'Without Cheese', cost: 29.38, sale: 35, profit: 5.62, margin: '16.1%', cls: 'Low Margin' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.cat}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.size}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">{item.cheese}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-rose-700 tabular-nums">
                      ₹{item.cost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{item.sale.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-slate-800">
                      {item.margin}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.cls === 'High Margin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.cls === 'Low Margin'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.cls}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
