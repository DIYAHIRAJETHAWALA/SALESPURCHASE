import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet, Search, ArrowUpDown, Filter,
  Store, Upload, Utensils, Trash2
} from 'lucide-react';
import { fetchMasterMergedTable, fetchOutletsList } from '../api';
import { MasterMergedRow, MasterMergedResponse, Outlet } from '../types';
import { useUploadedData, UploadResult } from '../context/UploadedDataContext';
import { fuzzyOutletScore, isTotalRowLabel, normalizeOutletStr, resolveCanonicalOutlet } from '../utils/outletFuzzy';
import { RecipeModal } from '../components/RecipeModal';
import { DEFAULT_OUTLETS } from '../utils/defaultOutlets';
import {
  RecipeBomItem,
  DEFAULT_RECIPE_BOM,
  findMatchingRecipe,
} from '../utils/recipeBom';

interface MasterMergedPageProps {
  onSelectOutlet: (outletId: number) => void;
}

export const MasterMergedPage: React.FC<MasterMergedPageProps> = ({ onSelectOutlet }) => {
  const { datasets, setDatasets } = useUploadedData();
  const [dbData, setDbData] = useState<MasterMergedResponse | null>(null);
  const [dbOutlets, setDbOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [selectedOutletName, setSelectedOutletName] = useState<string>('');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('outlet_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // Recipe BOM & Modal State
  const [dbRecipeBom, setDbRecipeBom] = useState<RecipeBomItem[]>([]);
  const [dbRecipeBomFile, setDbRecipeBomFile] = useState<string>('');
  const [recipeCategory, setRecipeCategory] = useState<string>('All');
  const [recipeSearch, setRecipeSearch] = useState<string>('');
  const [recipeOutlet, setRecipeOutlet] = useState<string>('');
  const [hideDbTotals, setHideDbTotals] = useState<boolean>(false);
  const [modalRecipe, setModalRecipe] = useState<{
    recipe: RecipeBomItem | null;
    clickedItemName?: string;
  } | null>(null);

  useEffect(() => {
    fetchOutletsList().then(setDbOutlets).catch(() => {});
    fetch('/api/analytics/recipe-bom')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.recipes) && json.recipes.length > 0) {
          setDbRecipeBom(json.recipes);
          setDbRecipeBomFile(json.filename || '');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const activeOutlet = recipeOutlet || selectedOutletName;
    const matchedDbOutlet = dbOutlets.find((o) => o.official_name === activeOutlet);
    fetchMasterMergedTable({
      outletId: matchedDbOutlet?.id,
      itemSearch: itemSearch || undefined,
      status: statusFilter,
      dateFilter: dateFilter,
      sortBy: sortBy,
      sortOrder: sortOrder,
      page: 1,
      limit: 5000,
    })
      .then((res) => {
        if (!cancelled) setDbData(res);
      })
      .catch(() => {
        if (!cancelled) setDbData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeOutlet, selectedOutletName, itemSearch, statusFilter, dateFilter, sortBy, sortOrder, page, dbOutlets]);

  // Build rows from uploaded Excel/CSV files when DB has no rows
  const excelRows = useMemo<MasterMergedRow[]>(() => {
    const rows: MasterMergedRow[] = [];
    let nextId = -1;

    for (const ds of datasets) {
      if (ds.mode === 'recipe_bom') continue;
      if (ds.outlets && ds.outlets.length > 0) {
        for (const o of ds.outlets) {
          if (!o.outlet || isTotalRowLabel(o.outlet)) continue;
          if (o.items && o.items.length > 0) {
            for (const it of o.items) {
              const sq = it.sales_qty ?? 0;
              const pq = it.purchase_units ?? 0;
              const unitPrice = parseFloat(String(it.menu_ref || '').replace(/[^0-9.]/g, '')) || 0;
              const status: 'both' | 'sold_only' | 'purchased_only' =
                sq > 0 && pq > 0 ? 'both' : sq > 0 ? 'sold_only' : 'purchased_only';
              rows.push({
                outlet_id: nextId--,
                outlet_name: resolveCanonicalOutlet(o.outlet),
                outlet_code: ds.category || undefined,
                item_id: nextId--,
                item_name: it.name,
                item_code: it.size || undefined,
                purchase_qty: pq,
                purchase_amount: unitPrice * pq,
                sales_qty: sq,
                sales_amount: unitPrice * sq,
                diff_qty: sq - pq,
                diff_amount: unitPrice * (sq - pq),
                status,
              });
            }
          } else {
            const sq = o.summary?.total_sales_qty ?? 0;
            const pq = o.summary?.purchase_units ?? 0;
            const status: 'both' | 'sold_only' | 'purchased_only' =
              sq > 0 && pq > 0 ? 'both' : sq > 0 ? 'sold_only' : 'purchased_only';
            rows.push({
              outlet_id: nextId--,
              outlet_name: o.outlet,
              outlet_code: ds.category || undefined,
              item_id: nextId--,
              item_name: ds.category || ds.filename,
              purchase_qty: pq,
              purchase_amount: 0,
              sales_qty: sq,
              sales_amount: 0,
              diff_qty: sq - pq,
              diff_amount: 0,
              status,
            });
          }
        }
      } else if (ds.raw_sheets && ds.raw_sheets.length > 0) {
        for (const sheet of ds.raw_sheets) {
          const headers = sheet.headers || [];
          const rawRows = sheet.rows || [];
          if (headers.length === 0 || rawRows.length === 0) continue;

          let outletColIdx = headers.findIndex((h) => {
            const low = String(h || '').toLowerCase();
            return low.includes('outlet') || low.includes('location') || low.includes('branch') || low.includes('store');
          });
          if (outletColIdx === -1) outletColIdx = 0;

          for (const r of rawRows) {
            const outletName = String(r[outletColIdx] ?? '').trim();
            if (!outletName || isTotalRowLabel(outletName) || /^[\d.,\-%]+$/.test(outletName)) continue;
            headers.forEach((h, cIdx) => {
              if (cIdx === outletColIdx || !h) return;
              const num = parseFloat(String(r[cIdx] ?? '').replace(/,/g, ''));
              if (isNaN(num)) return;
              rows.push({
                outlet_id: nextId--,
                outlet_name: outletName,
                outlet_code: sheet.sheet_name,
                item_id: nextId--,
                item_name: h,
                purchase_qty: 0,
                purchase_amount: 0,
                sales_qty: num,
                sales_amount: 0,
                diff_qty: num,
                diff_amount: 0,
                status: 'sold_only',
              });
            });
          }
        }
      }
    }
    return rows;
  }, [datasets]);

  const hasUploadedExcel = excelRows.length > 0;
  const useExcelFallback = hasUploadedExcel || hideDbTotals;

  // Unique outlets list for dropdown
  const outletOptions = useMemo<string[]>(() => {
    const seen = new Map<string, string>();
    if (hasUploadedExcel) {
      for (const r of excelRows) {
        const k = normalizeOutletStr(r.outlet_name);
        if (k && !seen.has(k)) seen.set(k, r.outlet_name);
      }
      return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    }
    if (hideDbTotals) return [];
    for (const o of dbOutlets) {
      seen.set(normalizeOutletStr(o.official_name), o.official_name);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [dbOutlets, excelRows, hasUploadedExcel, hideDbTotals]);

  const uploadedBomDataset = useMemo(
    () => [...datasets].reverse().find((d) => d.mode === 'recipe_bom' && d.recipe_bom && d.recipe_bom.length > 0),
    [datasets]
  );

  const bomItems = useMemo<RecipeBomItem[]>(() => {
    if (uploadedBomDataset?.recipe_bom?.length) return uploadedBomDataset.recipe_bom;
    if (dbRecipeBom.length > 0) return dbRecipeBom;
    return hideDbTotals ? [] : DEFAULT_RECIPE_BOM;
  }, [uploadedBomDataset, dbRecipeBom, hideDbTotals]);

  const data = useMemo<MasterMergedResponse | null>(() => {
    if (!useExcelFallback) return dbData;

    if (excelRows.length === 0) {
      if (uploadedBomDataset?.recipe_bom?.length) {
        const items = uploadedBomDataset.recipe_bom;
        const totSale = items.reduce((s, r) => s + (r.sale_price || 0), 0);
        const totMaking = items.reduce((s, r) => s + (r.making_cost || 0), 0);
        return {
          total: items.length,
          page: 1,
          limit: pageSize,
          total_sales_amount: totSale,
          total_purchase_amount: totMaking,
          total_variance_amount: totSale - totMaking,
          total_sales_qty: items.length,
          total_purchase_qty: items.length,
          rows: [],
        };
      }
      return {
        total: 0,
        page: 1,
        limit: pageSize,
        total_sales_amount: 0,
        total_purchase_amount: 0,
        total_variance_amount: 0,
        total_sales_qty: 0,
        total_purchase_qty: 0,
        rows: [],
      };
    }

    let filtered = excelRows;
    if (selectedOutletName) {
      const targetKey = normalizeOutletStr(selectedOutletName);
      filtered = filtered.filter((r) => normalizeOutletStr(r.outlet_name) === targetKey);
    }
    if (itemSearch.trim()) {
      const q = itemSearch.trim();
      filtered = filtered.filter(
        (r) =>
          fuzzyOutletScore(q, r.item_name) >= 55 ||
          fuzzyOutletScore(q, r.outlet_name) >= 55
      );
    }
    if (statusFilter === 'both') {
      filtered = filtered.filter((r) => r.status === 'both');
    } else if (statusFilter === 'sold_only') {
      filtered = filtered.filter((r) => r.status === 'sold_only');
    } else if (statusFilter === 'purchased_only') {
      filtered = filtered.filter((r) => r.status === 'purchased_only');
    } else if (statusFilter === 'variance_only') {
      filtered = filtered.filter((r) => r.diff_qty !== 0);
    }

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'outlet_name' || sortBy === 'item_name') {
        return String(a[sortBy]).localeCompare(String(b[sortBy])) * dir;
      }
      return (Number((a as any)[sortBy] ?? 0) - Number((b as any)[sortBy] ?? 0)) * dir;
    });

    const totalSalesQty = sorted.reduce((acc, r) => acc + r.sales_qty, 0);
    const totalPurchQty = sorted.reduce((acc, r) => acc + r.purchase_qty, 0);
    const startIdx = (page - 1) * pageSize;
    return {
      total: sorted.length,
      page,
      limit: pageSize,
      total_sales_amount: 0,
      total_purchase_amount: 0,
      total_variance_amount: 0,
      total_sales_qty: totalSalesQty,
      total_purchase_qty: totalPurchQty,
      rows: sorted.slice(startIdx, startIdx + pageSize),
    };
  }, [useExcelFallback, dbData, excelRows, selectedOutletName, itemSearch, statusFilter, sortBy, sortOrder, page]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field.includes('amount') || field.includes('qty') ? 'desc' : 'asc');
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
        if (res.ok) uploaded.push(await res.json());
      }
      if (uploaded.length > 0) {
        setHideDbTotals(false);
        const bomUpload = [...uploaded].reverse().find((u) => u.mode === 'recipe_bom' && u.recipe_bom?.length);
        if (bomUpload && bomUpload.recipe_bom) {
          setDbRecipeBom(bomUpload.recipe_bom);
          setDbRecipeBomFile(bomUpload.filename);
          setTimeout(() => {
            document.getElementById('merged-recipes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
        setDatasets((prev) => {
          const map = new Map(prev.map((d) => [d.filename, d]));
          for (const u of uploaded) map.set(u.filename, u);
          return [...map.values()];
        });
        setPage(1);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClearAllExcels = () => {
    setDatasets([]);
    setDbRecipeBom([]);
    setDbRecipeBomFile('');
    setHideDbTotals(true);
    setRecipeOutlet('');
    setRecipeSearch('');
    setRecipeCategory('All');
    setPage(1);
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    const matchedDbOutlet = dbOutlets.find((o) => o.official_name === selectedOutletName);
    if (matchedDbOutlet) params.append('outlet_id', matchedDbOutlet.id.toString());
    if (itemSearch) params.append('item_search', itemSearch);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (dateFilter !== 'all') params.append('date_filter', dateFilter);

    window.open(`/api/exports/master-merged-excel?${params.toString()}`, '_blank');
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) || 1 : 1;

  const bomSourceFilename = uploadedBomDataset?.filename || dbRecipeBomFile || '';

  const recipeCategories = useMemo(
    () => ['All', ...Array.from(new Set(bomItems.map((i) => i.category)))],
    [bomItems]
  );

  const filteredRecipes = useMemo(() => {
    return bomItems.filter((item) => {
      if (recipeCategory !== 'All' && item.category !== recipeCategory) return false;
      if (recipeSearch.trim()) {
        const q = recipeSearch.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.ingredients.some((ing) => ing.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [bomItems, recipeCategory, recipeSearch]);

  const allOutlets = useMemo<string[]>(() => {
    if (outletOptions.length > 0) return outletOptions;
    return DEFAULT_OUTLETS.map((o) => o.official_name).sort((a, b) => a.localeCompare(b));
  }, [outletOptions]);

  const outletMetricsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        qtySold: number;
        making: number;
        sale: number;
        profit: number;
        marginPct: number;
        hasSales: boolean;
      }
    >();

    const sourceRows: MasterMergedRow[] = useExcelFallback
      ? excelRows.filter((r) =>
          recipeOutlet
            ? normalizeOutletStr(r.outlet_name) === normalizeOutletStr(recipeOutlet)
            : true
        )
      : (dbData?.rows || []).filter((r) =>
          recipeOutlet
            ? normalizeOutletStr(r.outlet_name) === normalizeOutletStr(recipeOutlet)
            : true
        );

    const aggByRecipe = new Map<string, { qty: number; amt: number }>();
    for (const row of sourceRows) {
      if ((row.sales_qty || 0) <= 0) continue;
      const matched = findMatchingRecipe(row.item_name, bomItems);
      if (!matched) continue;
      const cur = aggByRecipe.get(matched.name) || { qty: 0, amt: 0 };
      cur.qty += row.sales_qty || 0;
      cur.amt += row.sales_amount || 0;
      aggByRecipe.set(matched.name, cur);
    }

    for (const item of bomItems) {
      const agg = aggByRecipe.get(item.name);
      if (agg && agg.qty > 0) {
        const making = item.making_cost * agg.qty;
        const sale = agg.amt > 0 ? agg.amt : item.sale_price * agg.qty;
        const profit = sale - making;
        const marginPct = sale > 0 ? (profit / sale) * 100 : item.margin_pct;
        map.set(item.name, {
          qtySold: agg.qty,
          making,
          sale,
          profit,
          marginPct,
          hasSales: true,
        });
      } else {
        map.set(item.name, {
          qtySold: 0,
          making: item.making_cost,
          sale: item.sale_price,
          profit: item.profit,
          marginPct: item.margin_pct,
          hasSales: false,
        });
      }
    }
    return map;
  }, [bomItems, useExcelFallback, excelRows, dbData, recipeOutlet]);

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

        <div className="flex items-center gap-2 self-start lg:self-center">
          <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all cursor-pointer">
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
            type="button"
            onClick={handleClearAllExcels}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
            title="Clear all uploaded Excel files and reset totals"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Excels</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-md transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Unified Master Excel (.xlsx)</span>
          </button>
        </div>
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outlets</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{outletOptions.length}</p>
            <p className="text-[11px] text-slate-400">Available locations</p>
          </div>
        </div>
      )}

      {/* Food & Beverage Recipes Section (populated from uploaded Excel or saved BOM) */}
      <div id="merged-recipes-section" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Utensils className="w-4 h-4 text-blue-600" />
                <span>Food &amp; Beverage Recipes</span>
              </h2>
              {bomSourceFilename && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Loaded from {bomSourceFilename} ({bomItems.length} items)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any food or beverage item below to view its full recipe and ingredients.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <select
              value={recipeOutlet}
              onChange={(e) => setRecipeOutlet(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white outline-none focus:border-blue-500 max-w-xs"
            >
              <option value="">All Outlets ({allOutlets.length})</option>
              {allOutlets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search food or beverage..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
          {recipeCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setRecipeCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                recipeCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 z-10">
              <tr>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Food / Beverage Item</th>
                <th className="py-2.5 px-4">Outlet Name</th>
                <th className="py-2.5 px-4 text-right">Qty Sold</th>
                <th className="py-2.5 px-4 text-right">Making (₹)</th>
                <th className="py-2.5 px-4 text-right">Sale (₹)</th>
                <th className="py-2.5 px-4 text-right">Profit (₹)</th>
                <th className="py-2.5 px-4 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecipes.map((item, idx) => {
                const m = outletMetricsMap.get(item.name) || {
                  qtySold: 0,
                  making: item.making_cost,
                  sale: item.sale_price,
                  profit: item.profit,
                  marginPct: item.margin_pct,
                  hasSales: false,
                };
                return (
                  <tr
                    key={`${item.category}-${item.name}-${idx}`}
                    onClick={() => setModalRecipe({ recipe: item })}
                    className="hover:bg-blue-50/40 transition cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{item.category}</td>
                    <td className="py-2.5 px-4 font-bold text-blue-700 hover:underline">{item.name}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">
                      {recipeOutlet ? (
                        <span className="text-slate-800 font-semibold">{recipeOutlet}</span>
                      ) : (
                        <span className="text-slate-500">All Outlets ({allOutlets.length})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-700 tabular-nums">
                      {m.hasSales ? (
                        m.qtySold.toLocaleString()
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">1 unit (recipe)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-rose-700 tabular-nums">
                      ₹{m.making.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      ₹{m.sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                      ₹{m.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center font-extrabold text-blue-700 tabular-nums">
                      {m.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalRecipe && (() => {
        const m = modalRecipe.recipe ? outletMetricsMap.get(modalRecipe.recipe.name) : undefined;
        return (
          <RecipeModal
            recipe={modalRecipe.recipe}
            clickedItemName={modalRecipe.clickedItemName}
            outlets={recipeOutlet ? [recipeOutlet] : allOutlets}
            qtySold={m?.hasSales ? m.qtySold : 1}
            totalMaking={m?.making}
            totalSale={m?.sale}
            totalProfit={m?.profit}
            marginPct={m?.marginPct}
            onClose={() => setModalRecipe(null)}
          />
        );
      })()}
    </div>
  );
};
