import React, { useMemo, useState } from 'react';
import {
  useUploadedData,
  UploadResult,
  OutletData,
  ItemRow,
} from '../context/UploadedDataContext';
import { normalizeOutletStr, resolveCanonicalOutlet } from '../utils/outletFuzzy';
import {
  UploadCloud,
  Store,
  Search,
  FileSpreadsheet,
  Package,
  TrendingUp,
  Percent,
  Layers,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react';

export const CategoryUploadPage: React.FC = () => {
  const { datasets, setDatasets } = useUploadedData();
  // -1 = Merged view, 0+ = individual file tab
  const [activeCategoryIdx, setActiveCategoryIdx] = useState<number>(-1);
  const [activeRawSheetIdx, setActiveRawSheetIdx] = useState<number>(0);
  const [selectedOutlet, setSelectedOutlet] = useState<string>(() =>
    datasets.length > 0 ? '__ALL__' : ''
  );
  const [selectedItem, setSelectedItem] = useState<string>('__SUMMARY__');
  // Date / period controls
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [showDateInput, setShowDateInput] = useState<boolean>(false);
  const [itemSearch, setItemSearch] = useState<string>('');
  const [hideZeroSales, setHideZeroSales] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (datasets.length > 0 && !selectedOutlet) {
      setSelectedOutlet('__ALL__');
    }
  }, [datasets.length, selectedOutlet]);

  // When activeCategoryIdx is -1 → merged view; else show that specific dataset
  const data = activeCategoryIdx >= 0 ? (datasets[activeCategoryIdx] || null) : null;

  // ── Merged data across ALL datasets ──────────────────────────────────────
  const mergedData = useMemo(() => {
    if (datasets.length === 0) return null;
    // Collect all outlets across all datasets, merge items by canonical outlet key
    const outletMap = new Map<string, OutletData>();
    for (const ds of datasets) {
      for (const o of ds.outlets) {
        const canonical = resolveCanonicalOutlet(o.outlet);
        const key = normalizeOutletStr(canonical);
        if (!key) continue;
        if (outletMap.has(key)) {
          const existing = outletMap.get(key)!;
          // Merge items
          existing.items = [...existing.items, ...o.items];
          // Merge summary
          existing.summary.individual_sales += o.summary.individual_sales;
          existing.summary.combo_sales += o.summary.combo_sales;
          existing.summary.total_sales_qty += o.summary.total_sales_qty;
          existing.summary.purchase_packs += o.summary.purchase_packs;
          existing.summary.purchase_units += o.summary.purchase_units;
        } else {
          outletMap.set(key, {
            outlet: canonical,
            items: [...o.items],
            summary: { ...o.summary },
          });
        }
      }
    }
    const outlets = Array.from(outletMap.values());
    // Recalculate RMD for merged
    for (const o of outlets) {
      o.summary.rmd_pct = o.summary.purchase_units > 0
        ? Math.round((o.summary.total_sales_qty / o.summary.purchase_units) * 10000) / 100
        : 0;
    }
    return {
      filename: `${datasets.length} files merged`,
      category: `All Files Merged (${datasets.length})`,
      outlets,
      raw_sheets: datasets.flatMap(d => d.raw_sheets || []),
    } as unknown as UploadResult;
  }, [datasets]);

  // Active data: merged or single file
  const activeData = activeCategoryIdx === -1 ? mergedData : data;

  const outletAmountMap = useMemo(() => {
    const map = new Map<string, { salesAmt: number; purchAmt: number }>();
    if (!activeData) return map;
    for (const o of activeData.outlets) {
      let salesAmt = 0;
      let purchAmt = 0;
      for (const it of o.items || []) {
        if ((it.sales_amount ?? 0) > 0 || (it.purchase_amount ?? 0) > 0) {
          salesAmt += it.sales_amount ?? 0;
          purchAmt += it.purchase_amount ?? 0;
        } else {
          const unitPrice = parseFloat(String(it.menu_ref || '').replace(/[^0-9.]/g, '')) || 0;
          if (unitPrice > 0) {
            salesAmt += unitPrice * (it.sales_qty || 0);
            purchAmt += unitPrice * (it.purchase_units || 0);
          }
        }
      }
      map.set(o.outlet, { salesAmt, purchAmt });
    }
    return map;
  }, [activeData]);

  const mergedTotals = useMemo(() => {
    if (!activeData) {
      return { salesQty: 0, salesAmt: 0, purchQty: 0, purchAmt: 0, diffQty: 0, rmdPct: 0 };
    }
    let salesQty = 0;
    let salesAmt = 0;
    let purchQty = 0;
    let purchAmt = 0;
    for (const o of activeData.outlets) {
      salesQty += o.summary.total_sales_qty || 0;
      purchQty += o.summary.purchase_units || 0;
      const amts = outletAmountMap.get(o.outlet);
      if (amts) {
        salesAmt += amts.salesAmt;
        purchAmt += amts.purchAmt;
      }
    }
    const rmdPct = purchQty > 0 ? Math.round((salesQty / purchQty) * 10000) / 100 : 0;
    return { salesQty, salesAmt, purchQty, purchAmt, diffQty: salesQty - purchQty, rmdPct };
  }, [activeData, outletAmountMap]);

  const handleFilesUpload = async (files: FileList | File[], sdOverride?: string, edOverride?: string, labelOverride?: string) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const uploaded: UploadResult[] = [];
      for (const file of fileArr) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('period_label', labelOverride || periodLabel || file.name);
        formData.append('start_date', sdOverride || startDate || '');
        formData.append('end_date', edOverride || endDate || '');

        const res = await fetch('/api/excel-upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.detail || `Upload failed for ${file.name} (${res.status})`);
        }

        const json: UploadResult = await res.json();
        uploaded.push(json);
      }

      setDatasets((prev) => {
        const existing = new Map(prev.map((d) => [d.filename, d]));
        for (const u of uploaded) existing.set(u.filename, u);
        return [...existing.values()];
      });
      // Always switch to Merged view after upload so ALL files are visible together
      setActiveCategoryIdx(-1);
      setActiveRawSheetIdx(0);
      setSelectedOutlet('__ALL__');
      setSelectedItem('__SUMMARY__');
      setItemSearch('');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
      e.target.value = '';
    }
  };

  const handleCategorySwitch = (idx: number) => {
    setActiveCategoryIdx(idx);
    setActiveRawSheetIdx(0);
    const nextData = idx === -1 ? mergedData : datasets[idx];
    if (selectedOutlet !== '__ALL__' && nextData && !nextData.outlets.some((o) => o.outlet === selectedOutlet)) {
      setSelectedOutlet('__ALL__');
    }
    setSelectedItem('__SUMMARY__');
  };

  const uniqueItemNames = useMemo(() => {
    if (!activeData) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const o of activeData.outlets) {
      for (const it of o.items) {
        if (!seen.has(it.name)) {
          seen.add(it.name);
          names.push(it.name);
        }
      }
    }
    return names;
  }, [activeData]);

  const activeOutletData = useMemo(() => {
    if (!activeData || !selectedOutlet || selectedOutlet === '__ALL__') return null;
    return activeData.outlets.find((o) => o.outlet === selectedOutlet) || null;
  }, [activeData, selectedOutlet]);

  const filteredOutlets = useMemo(() => {
    if (!activeData) return [];
    const q = itemSearch.trim().toLowerCase();
    return activeData.outlets.filter((o) => {
      if (!q) return true;
      return (
        o.outlet.toLowerCase().includes(q) ||
        o.items.some((it) => it.sales_qty > 0 && it.name.toLowerCase().includes(q))
      );
    });
  }, [activeData, itemSearch]);

  const filteredAllOutletItems = useMemo(() => {
    if (!activeData || selectedOutlet !== '__ALL__' || selectedItem === '__SUMMARY__') return [];
    const q = itemSearch.trim().toLowerCase();
    const rows: Array<{ outlet: string; item: ItemRow }> = [];
    for (const o of activeData.outlets) {
      for (const it of o.items) {
        if (selectedItem !== '__ALL_ITEMS__' && it.name !== selectedItem) continue;
        if (hideZeroSales && it.sales_qty === 0) continue;
        if (
          q &&
          !o.outlet.toLowerCase().includes(q) &&
          !it.name.toLowerCase().includes(q) &&
          !it.size.toLowerCase().includes(q) &&
          !it.menu_ref.toLowerCase().includes(q)
        ) {
          continue;
        }
        rows.push({ outlet: o.outlet, item: it });
      }
    }
    return rows;
  }, [activeData, selectedOutlet, selectedItem, itemSearch, hideZeroSales]);

  const filteredItems = useMemo(() => {
    if (!activeOutletData) return [];
    const q = itemSearch.trim().toLowerCase();
    return activeOutletData.items.filter((item) => {
      if (selectedItem !== '__ALL_ITEMS__' && selectedItem !== '__SUMMARY__' && item.name !== selectedItem) {
        return false;
      }
      if (hideZeroSales && item.sales_qty === 0) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.menu_ref.toLowerCase().includes(q)
      );
    });
  }, [activeOutletData, selectedItem, itemSearch, hideZeroSales]);

  const formatNum = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" />
            <span>Universal Excel &amp; CSV Viewer</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload any Excel or CSV file from anywhere (Outlet Reports, POS Sales, Purchase/Order Reports, or any custom sheet) to inspect sales, purchases, and RMD %.
          </p>
        </div>

        {/* Upload Button */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Date range toggle */}
          <button
            type="button"
            onClick={() => setShowDateInput((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              showDateInput
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            {startDate ? `${startDate}${endDate ? ' → ' + endDate : ''}` : 'Set Date / Week / Month'}
            {startDate && (
              <X
                className="w-3.5 h-3.5 text-slate-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setStartDate('');
                  setEndDate('');
                  setPeriodLabel('');
                }}
              />
            )}
          </button>

          <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm cursor-pointer transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{loading ? 'Processing...' : 'Upload Sales Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              multiple
              onChange={onFileChange}
              disabled={loading}
              className="hidden"
            />
          </label>

          <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm cursor-pointer transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{loading ? 'Processing...' : 'Upload Purchase Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              multiple
              onChange={onFileChange}
              disabled={loading}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setActiveCategoryIdx(-1);
              setActiveRawSheetIdx(0);
              setSelectedOutlet('__ALL__');
              setSelectedItem('__SUMMARY__');
              setItemSearch('');
            }}
            disabled={datasets.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-sm shadow-sm transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>Merge All</span>
          </button>

          {datasets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDatasets([]);
                setActiveCategoryIdx(-1);
                setSelectedOutlet('');
                setSelectedItem('__SUMMARY__');
                setItemSearch('');
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Date / Period Input Panel */}
      {showDateInput && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 whitespace-nowrap">
              Period Label (optional):
            </span>
            <input
              type="text"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="e.g. Week 45, Nov 2026..."
              className="flex-1 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-indigo-600 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <span className="text-xs font-bold uppercase text-indigo-600 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <p className="text-xs text-indigo-500">
            Upload your Excel file after setting these — the period will be tagged to it.
          </p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State Dropzone */}
      {!activeData && !loading && (
        <label className="block border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-2xl p-12 text-center cursor-pointer transition-colors">
          <UploadCloud className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-800">
            Click to upload any Excel or CSV file (.xlsx, .xls, .csv)
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Works with Category Outlet Reports, raw POS Sales CSVs, Purchase/Order Excel files, and any unknown spreadsheet.
          </p>
          <input
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            multiple
            onChange={onFileChange}
            className="hidden"
          />
        </label>
      )}

      {/* Loaded Content */}
      {activeData && (
        <>
          {/* File Tabs — Merged first, then each individual file */}
          {datasets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Merged tab */}
              <button
                onClick={() => handleCategorySwitch(-1)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  activeCategoryIdx === -1
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                📊 All Files Merged ({datasets.length})
              </button>
              {/* Individual file tabs */}
              {datasets.map((ds, idx) => (
                <button
                  key={`${ds.filename}-${idx}`}
                  onClick={() => handleCategorySwitch(idx)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    idx === activeCategoryIdx
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {ds.category}
                </button>
              ))}
            </div>
          )}
          {/* File Info + Outlet Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {activeCategoryIdx === -1 ? 'All Files Merged' : 'Loaded Category Workbook'}
                </div>
                <div className="text-base font-bold text-slate-900">
                  {activeData.category}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({activeData.filename} • {activeData.outlets.length} outlets)
                  </span>
                  {activeCategoryIdx >= 0 && (data?.start_date || data?.week_label || data?.month_label || (data?.period_label && data?.period_label !== data?.filename)) && (
                    <div className="text-xs font-normal text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      {data?.period_label && data?.period_label !== data?.filename && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                          {data.period_label}
                        </span>
                      )}
                      {data?.start_date && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">
                          <Calendar className="w-3 h-3" />
                          {data.start_date}{data.end_date ? ` → ${data.end_date}` : ''}
                        </span>
                      )}
                      {data?.week_label && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold">
                          {data.week_label}
                        </span>
                      )}
                      {data?.month_label && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                          {data.month_label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Outlet & Item Selectors */}
            {activeData.outlets.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                    <Store className="w-4 h-4 text-blue-600" />
                    Outlet:
                  </label>
                  <select
                    value={selectedOutlet}
                    onChange={(e) => {
                      const nextOutlet = e.target.value;
                      setSelectedOutlet(nextOutlet);
                      if (nextOutlet !== '__ALL__' && selectedItem === '__SUMMARY__') {
                        setSelectedItem('__ALL_ITEMS__');
                      } else if (nextOutlet === '__ALL__' && selectedItem === '__ALL_ITEMS__') {
                        setSelectedItem('__SUMMARY__');
                      }
                      setItemSearch('');
                    }}
                    className="w-full sm:w-72 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="__ALL__">All Outlets ({activeData.outlets.length})</option>
                    {activeData.outlets.map((o) => (
                      <option key={o.outlet} value={o.outlet}>
                        {o.outlet}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Item:
                  </label>
                  <select
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-full sm:w-64 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {selectedOutlet === '__ALL__' ? (
                      <option value="__SUMMARY__">Outlet Summary (1 row per Outlet)</option>
                    ) : (
                      <option value="__ALL_ITEMS__">All Items ({uniqueItemNames.length})</option>
                    )}
                    {uniqueItemNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Generic Table Fallback for any unknown spreadsheet */}
          {activeData.outlets.length === 0 && activeData.raw_sheets && activeData.raw_sheets.length > 0 && (() => {
            const activeSheet = activeData.raw_sheets[activeRawSheetIdx] || activeData.raw_sheets[0];
            const q = itemSearch.trim().toLowerCase();
            const visibleRows = q
              ? activeSheet.rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)))
              : activeSheet.rows;

            return (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeData.raw_sheets.map((sh, idx) => (
                      <button
                        key={`${sh.sheet_name}-${idx}`}
                        type="button"
                        onClick={() => setActiveRawSheetIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          idx === activeRawSheetIdx
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {sh.sheet_name}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 flex-1 max-w-md">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Search any column in this sheet..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {visibleRows.length} rows
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        {activeSheet.headers.map((h, i) => (
                          <th key={i} className="py-3 px-4 whitespace-nowrap border-r border-slate-100">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {visibleRows.map((r, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80">
                          {r.map((cell, cIdx) => (
                            <td key={cIdx} className="py-2.5 px-4 text-slate-700 whitespace-nowrap border-r border-slate-50">
                              {cell || '0'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Merged Totals KPI Strip */}
          {selectedOutlet === '__ALL__' && activeData.outlets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">Total Sales Qty</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">{formatNum(mergedTotals.salesQty)}</p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-emerald-700">Sales Amount (₹)</p>
                <p className="text-xl font-extrabold text-emerald-900 mt-1">
                  ₹{mergedTotals.salesAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">Total Purchase Qty</p>
                <p className="text-xl font-extrabold text-amber-700 mt-1">{formatNum(mergedTotals.purchQty)}</p>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-amber-700">Purchase Amount (₹)</p>
                <p className="text-xl font-extrabold text-amber-900 mt-1">
                  ₹{mergedTotals.purchAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">Total Variance (S−P)</p>
                <p className={`text-xl font-extrabold mt-1 ${mergedTotals.diffQty >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                  {mergedTotals.diffQty > 0 ? '+' : ''}{formatNum(mergedTotals.diffQty)}
                </p>
              </div>
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-indigo-700">Overall RMD %</p>
                <p className="text-xl font-extrabold text-indigo-900 mt-1">{mergedTotals.rmdPct.toFixed(2)}%</p>
              </div>
            </div>
          )}

          {/* All Outlets Table (Detailed with Item Name, or Combined Summary) */}
          {selectedOutlet === '__ALL__' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Filter by outlet or item (e.g. coffee, mango, chocolate, Adajan)..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-4">
                  {selectedItem !== '__SUMMARY__' && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hideZeroSales}
                        onChange={(e) => setHideZeroSales(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hide 0-sales items</span>
                    </label>
                  )}
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedItem === '__SUMMARY__'
                      ? `Showing ${filteredOutlets.length} of ${activeData.outlets.length} outlets`
                      : `Showing ${filteredAllOutletItems.length} rows`}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      <th
                        rowSpan={2}
                        className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200 sticky left-0 z-10 min-w-[230px]"
                      >
                        Outlet Name
                      </th>
                      {selectedItem === '__SUMMARY__' ? (
                        <th
                          colSpan={uniqueItemNames.length}
                          className="py-2 px-4 text-center bg-slate-100 text-slate-700 border-b border-r border-slate-200"
                        >
                          Item Name (Individual Sales Qty)
                        </th>
                      ) : (
                        <>
                          <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                            Item Name
                          </th>
                          <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                            Size / Variant
                          </th>
                          <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                            Menu Ref
                          </th>
                        </>
                      )}
                      <th colSpan={4} className="py-2 px-4 text-center bg-blue-50/70 text-blue-800 border-b border-r border-slate-200">
                        Sales
                      </th>
                      <th colSpan={3} className="py-2 px-4 text-center bg-amber-50/70 text-amber-800 border-b border-r border-slate-200">
                        Purchase
                      </th>
                      <th rowSpan={2} className="py-3 px-4 text-right align-bottom bg-slate-50">
                        RMD %
                      </th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      {selectedItem === '__SUMMARY__' &&
                        uniqueItemNames.map((itemName) => (
                          <th
                            key={itemName}
                            className="py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-200"
                          >
                            {itemName}
                          </th>
                        ))}
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">Individual</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">Combo</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">Total Sales Qty</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap border-r border-slate-200">Sales Amt (₹)</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">Packs</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap">Units (Total Qty)</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap border-r border-slate-200">Purch Amt (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {selectedItem === '__SUMMARY__'
                      ? filteredOutlets.map((o) => {
                          const itemQtyMap = new Map(o.items.map((it) => [it.name, it.individual_sales]));
                          return (
                            <tr
                              key={o.outlet}
                              onClick={() => {
                                setSelectedOutlet(o.outlet);
                                setSelectedItem('__ALL_ITEMS__');
                                setItemSearch('');
                              }}
                              className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4 font-semibold text-blue-700 hover:underline sticky left-0 bg-white border-r border-slate-100 whitespace-nowrap">
                                {o.outlet}
                              </td>
                              {uniqueItemNames.map((itemName) => {
                                const val = itemQtyMap.get(itemName) ?? 0;
                                return (
                                  <td
                                    key={itemName}
                                    className={`py-3 px-3 text-right border-r border-slate-100 ${
                                      val > 0 ? 'font-medium text-slate-800' : 'text-slate-400'
                                    }`}
                                  >
                                    {formatNum(val)}
                                  </td>
                                );
                              })}
                              <td className="py-3 px-4 text-right font-medium text-slate-700">
                                {formatNum(o.summary.individual_sales)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-indigo-700">
                                {formatNum(o.summary.combo_sales)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-700">
                                {formatNum(o.summary.total_sales_qty)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-emerald-800 border-r border-slate-100">
                                {outletAmountMap.get(o.outlet)?.salesAmt
                                  ? `₹${outletAmountMap.get(o.outlet)!.salesAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-slate-700">
                                {formatNum(o.summary.purchase_packs)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-amber-700">
                                {formatNum(o.summary.purchase_units)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-amber-800 border-r border-slate-100">
                                {outletAmountMap.get(o.outlet)?.purchAmt
                                  ? `₹${outletAmountMap.get(o.outlet)!.purchAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900">
                                {o.summary.rmd_pct.toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })
                      : filteredAllOutletItems.map(({ outlet, item }, idx) => (
                          <tr key={`${outlet}-${item.name}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td
                              onClick={() => {
                                setSelectedOutlet(outlet);
                                setItemSearch('');
                              }}
                              className="py-3 px-4 font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              {outlet}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                            <td className="py-3 px-4 text-slate-600">
                              {item.size ? (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                                  {item.size}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">{item.menu_ref || '-'}</td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">
                              {formatNum(item.individual_sales)}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-indigo-700">
                              {formatNum(item.combo_sales)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700">
                              {formatNum(item.sales_qty)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-emerald-800 border-r border-slate-100">
                              {(() => {
                                const p = parseFloat(String(item.menu_ref || '').replace(/[^0-9.]/g, '')) || 0;
                                return p > 0 && item.sales_qty > 0 ? `₹${(p * item.sales_qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
                              })()}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">
                              {formatNum(item.purchase_packs)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-amber-700">
                              {formatNum(item.purchase_units)}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-amber-800 border-r border-slate-100">
                              {(() => {
                                const p = parseFloat(String(item.menu_ref || '').replace(/[^0-9.]/g, '')) || 0;
                                return p > 0 && item.purchase_units > 0 ? `₹${(p * item.purchase_units).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
                              })()}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                              {item.rmd_pct.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                  </tbody>
                  {selectedItem === '__SUMMARY__' && filteredOutlets.length > 0 && (
                    <tfoot className="bg-slate-900 text-white font-bold text-xs">
                      <tr>
                        <td
                          colSpan={1 + uniqueItemNames.length}
                          className="py-3 px-4 sticky left-0 bg-slate-900 border-r border-slate-700"
                        >
                          Grand Total ({filteredOutlets.length} outlets)
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatNum(filteredOutlets.reduce((s, o) => s + o.summary.individual_sales, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-300">
                          {formatNum(filteredOutlets.reduce((s, o) => s + o.summary.combo_sales, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-300">
                          {formatNum(mergedTotals.salesQty)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-200 border-r border-slate-700">
                          {mergedTotals.salesAmt > 0 ? `₹${mergedTotals.salesAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatNum(filteredOutlets.reduce((s, o) => s + o.summary.purchase_packs, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-300">
                          {formatNum(mergedTotals.purchQty)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-200 border-r border-slate-700">
                          {mergedTotals.purchAmt > 0 ? `₹${mergedTotals.purchAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-300">
                          {mergedTotals.rmdPct.toFixed(2)}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Outlet Summary KPIs */}
          {activeOutletData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>Individual Sales</span>
                    <Layers className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {formatNum(activeOutletData.summary.individual_sales)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>Combo Sales</span>
                    <Layers className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-indigo-700 mt-2">
                    {formatNum(activeOutletData.summary.combo_sales)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>Total Sales Qty</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-2">
                    {formatNum(activeOutletData.summary.total_sales_qty)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>Purchase Packs</span>
                    <Package className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {formatNum(activeOutletData.summary.purchase_packs)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>Total Purchase (Units)</span>
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold text-orange-700 mt-2">
                    {formatNum(activeOutletData.summary.purchase_units)}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
                    <span>RMD %</span>
                    <Percent className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {activeOutletData.summary.rmd_pct.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Size Breakdown Chips */}
              {Object.keys(activeOutletData.summary.size_breakdown).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 shadow-sm flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Size / Variant Sales:
                  </span>
                  {Object.entries(activeOutletData.summary.size_breakdown).map(([label, val]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold"
                    >
                      <span>{label}:</span>
                      <span className="text-blue-700 font-bold">{formatNum(val)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Search & Filter Controls + Items Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Filter items (e.g. cheese, veg, jain, tandoori)..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hideZeroSales}
                        onChange={(e) => setHideZeroSales(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Hide 0-sales items</span>
                    </label>
                    <span className="text-xs font-semibold text-slate-500">
                      Showing {filteredItems.length} of {activeOutletData.items.length} items
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                          Item Name
                        </th>
                        <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                          Size / Variant
                        </th>
                        <th rowSpan={2} className="py-3 px-4 align-bottom bg-slate-50 border-r border-slate-200">
                          Menu Ref
                        </th>
                        <th colSpan={3} className="py-2 px-4 text-center bg-blue-50/70 text-blue-800 border-b border-r border-slate-200">
                          Sales
                        </th>
                        <th colSpan={2} className="py-2 px-4 text-center bg-amber-50/70 text-amber-800 border-b border-r border-slate-200">
                          Purchase
                        </th>
                        <th rowSpan={2} className="py-3 px-4 text-right align-bottom bg-slate-50">
                          RMD %
                        </th>
                      </tr>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-2.5 px-4 text-right">Individual</th>
                        <th className="py-2.5 px-4 text-right">Combo</th>
                        <th className="py-2.5 px-4 text-right border-r border-slate-200">Total Sales Qty</th>
                        <th className="py-2.5 px-4 text-right">Packs</th>
                        <th className="py-2.5 px-4 text-right border-r border-slate-200">Units (Total Qty)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredItems.map((item, idx) => (
                        <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {item.size ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                                {item.size}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">{item.menu_ref || '-'}</td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatNum(item.individual_sales)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-indigo-700">
                            {formatNum(item.combo_sales)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700 border-r border-slate-100">
                            {formatNum(item.sales_qty)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatNum(item.purchase_packs)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-amber-700 border-r border-slate-100">
                            {formatNum(item.purchase_units)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {item.rmd_pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            No items match your current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
