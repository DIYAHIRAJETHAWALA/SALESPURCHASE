import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Store, Upload, X, FileSpreadsheet, ChevronRight,
  TrendingUp, Package, Percent, AlertCircle, Loader2, ArrowRight, Database, Utensils
} from 'lucide-react';
import { useUploadedData, UploadResult, ItemRow } from '../context/UploadedDataContext';
import { fetchOutletsList } from '../api';
import { fuzzyOutletScore, isTotalRowLabel, normalizeOutletStr } from '../utils/outletFuzzy';
import { BUILT_IN_OUTLETS } from '../data/builtInOutlets';

interface OutletSearchPageProps {
  onSelectOutlet?: (outletId: number) => void;
}

interface OutletItemDetail {
  name: string;
  category: string;
  size: string;
  individual_sales: number;
  combo_sales: number;
  sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  rmd_pct: number;
}

interface OutletRow {
  outlet: string;
  dbId?: number;
  code?: string | null;
  city?: string | null;
  aliases?: string[];
  source: 'excel' | 'database';
  individual_sales: number;
  combo_sales: number;
  total_sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  rmd_pct: number;
  items: OutletItemDetail[];
  rawMetrics?: Array<{ label: string; value: string }>;
}

export const OutletSearchPage: React.FC<OutletSearchPageProps> = ({ onSelectOutlet }) => {
  const { datasets, setDatasets } = useUploadedData();
  const [dbOutlets, setDbOutlets] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // ── Step 1: Seed built-in outlets immediately (no network needed) ──
    const builtIn: OutletRow[] = BUILT_IN_OUTLETS.map((o) => ({
      outlet: o.outlet,
      code: o.code,
      city: o.city,
      aliases: o.aliases,
      source: 'database' as const,
      individual_sales: 0,
      combo_sales: 0,
      total_sales_qty: 0,
      purchase_packs: 0,
      purchase_units: 0,
      rmd_pct: 0,
      items: [],
    }));
    setDbOutlets(builtIn);

    // ── Step 2: Try to enrich from API (richer aliases, codes, cities) ──
    let cancelled = false;
    fetchOutletsList()
      .then((list) => {
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        const mapped: OutletRow[] = list.map((o) => ({
          outlet: o.official_name,
          dbId: o.id,
          code: o.code,
          city: o.city,
          aliases: (o.aliases || []).map((a: any) => a.raw_alias),
          source: 'database' as const,
          individual_sales: 0,
          combo_sales: 0,
          total_sales_qty: 0,
          purchase_packs: 0,
          purchase_units: 0,
          rmd_pct: 0,
          items: [],
        }));
        setDbOutlets(mapped);
      })
      .catch(() => {
        // Built-in outlets already set above — search still works
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge all outlets AND their food items across ALL uploaded Excel/CSV files + DB outlets
  const allOutlets = useMemo<OutletRow[]>(() => {
    const byKey = new Map<string, OutletRow>();

    for (const ds of datasets) {
      const catLabel = ds.category || ds.filename;

      // 1. Structured outlets
      for (const o of ds.outlets || []) {
        const key = normalizeOutletStr(o.outlet);
        if (!key || isTotalRowLabel(o.outlet)) continue;

        const mappedItems: OutletItemDetail[] = (o.items || []).map((it: ItemRow) => ({
          name: it.name,
          category: catLabel,
          size: it.size || '',
          individual_sales: it.individual_sales ?? 0,
          combo_sales: it.combo_sales ?? 0,
          sales_qty: it.sales_qty ?? 0,
          purchase_packs: it.purchase_packs ?? 0,
          purchase_units: it.purchase_units ?? 0,
          rmd_pct: it.rmd_pct ?? 0,
        }));

        const existing = byKey.get(key);
        if (existing) {
          existing.individual_sales += o.summary?.individual_sales ?? 0;
          existing.combo_sales += o.summary?.combo_sales ?? 0;
          existing.total_sales_qty += o.summary?.total_sales_qty ?? 0;
          existing.purchase_packs += o.summary?.purchase_packs ?? 0;
          existing.purchase_units += o.summary?.purchase_units ?? 0;
          existing.rmd_pct =
            existing.purchase_units > 0
              ? Math.round((existing.total_sales_qty / existing.purchase_units) * 10000) / 100
              : existing.rmd_pct;
          existing.items.push(...mappedItems);
        } else {
          byKey.set(key, {
            outlet: o.outlet,
            source: 'excel',
            individual_sales: o.summary?.individual_sales ?? 0,
            combo_sales: o.summary?.combo_sales ?? 0,
            total_sales_qty: o.summary?.total_sales_qty ?? 0,
            purchase_packs: o.summary?.purchase_packs ?? 0,
            purchase_units: o.summary?.purchase_units ?? 0,
            rmd_pct: o.summary?.rmd_pct ?? 0,
            items: mappedItems,
          });
        }
      }

      // 2. Generic / raw_sheets fallback (matrix or summary spreadsheets)
      if ((!ds.outlets || ds.outlets.length === 0) && ds.raw_sheets && ds.raw_sheets.length > 0) {
        for (const sheet of ds.raw_sheets) {
          const headers = sheet.headers || [];
          const rows = sheet.rows || [];
          if (headers.length === 0 || rows.length === 0) continue;

          let outletColIdx = headers.findIndex((h) => {
            const low = String(h || '').toLowerCase();
            return (
              low.includes('outlet') ||
              low.includes('location') ||
              low.includes('branch') ||
              low.includes('store') ||
              low.includes('franchise')
            );
          });
          // Fallback: pick first column that contains non-numeric text values
          if (outletColIdx === -1) {
            outletColIdx = headers.findIndex((_, cIdx) =>
              rows.slice(0, 10).some((r) => {
                const v = String(r[cIdx] ?? '').trim();
                return v.length > 2 && !/^[\d.,\-%₹$]+$/.test(v);
              })
            );
          }
          if (outletColIdx === -1) outletColIdx = 0;

          for (const row of rows) {
            const rawName = String(row[outletColIdx] ?? '').trim();
            if (!rawName || isTotalRowLabel(rawName)) continue;
            if (/^[\d.,\-%₹$]+$/.test(rawName)) continue;

            const key = normalizeOutletStr(rawName);
            if (!key) continue;

            const rawMetrics: Array<{ label: string; value: string }> = [];
            const rowItems: OutletItemDetail[] = [];
            let rowSum = 0;
            headers.forEach((h, cIdx) => {
              if (cIdx === outletColIdx) return;
              const val = String(row[cIdx] ?? '').trim();
              const label = h || `Col ${cIdx + 1}`;
              if (h || val) {
                rawMetrics.push({ label, value: val || '0' });
                const num = parseFloat(val.replace(/[₹$,%]/g, '').replace(/,/g, ''));
                if (!isNaN(num)) {
                  rowSum += num;
                  rowItems.push({
                    name: label,
                    category: sheet.sheet_name || catLabel,
                    size: '',
                    individual_sales: num,
                    combo_sales: 0,
                    sales_qty: num,
                    purchase_packs: 0,
                    purchase_units: 0,
                    rmd_pct: 0,
                  });
                }
              }
            });

            const existing = byKey.get(key);
            if (existing) {
              existing.total_sales_qty += rowSum;
              existing.items.push(...rowItems);
              if (!existing.rawMetrics) existing.rawMetrics = [];
              existing.rawMetrics.push(...rawMetrics);
            } else {
              byKey.set(key, {
                outlet: rawName,
                source: 'excel',
                individual_sales: rowSum,
                combo_sales: 0,
                total_sales_qty: rowSum,
                purchase_packs: 0,
                purchase_units: 0,
                rmd_pct: 0,
                items: rowItems,
                rawMetrics,
              });
            }
          }
        }
      }
    }

    // 3. Merge DB outlets
    for (const dbo of dbOutlets) {
      const key = normalizeOutletStr(dbo.outlet);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.dbId = dbo.dbId;
        existing.code = dbo.code;
        existing.city = dbo.city;
        existing.aliases = dbo.aliases;
      } else {
        byKey.set(key, dbo);
      }
    }

    return Array.from(byKey.values());
  }, [datasets, dbOutlets]);

  // Keep selectedOutlet synced when datasets change
  const activeOutlet = useMemo(() => {
    if (!selectedOutlet) return null;
    const key = normalizeOutletStr(selectedOutlet.outlet);
    return allOutlets.find((o) => normalizeOutletStr(o.outlet) === key) || selectedOutlet;
  }, [selectedOutlet, allOutlets]);

  // Fuzzy search results across outlet name, code, city, and aliases
  const searchResults = useMemo<Array<OutletRow & { score: number }>>(() => {
    const q = query.trim();
    if (!q) return allOutlets.map((o) => ({ ...o, score: 100 }));
    return allOutlets
      .map((o) => {
        let best = fuzzyOutletScore(q, o.outlet);
        if (o.code) best = Math.max(best, fuzzyOutletScore(q, o.code));
        if (o.city) best = Math.max(best, fuzzyOutletScore(q, o.city));
        if (o.aliases) {
          for (const a of o.aliases) {
            best = Math.max(best, fuzzyOutletScore(q, a));
          }
        }
        return { ...o, score: best };
      })
      .filter((o) => o.score >= 50)
      .sort((a, b) => b.score - a.score);
  }, [query, allOutlets]);

  const filteredItems = useMemo(() => {
    if (!activeOutlet) return [];
    const f = itemFilter.trim().toLowerCase();
    if (!f) return activeOutlet.items;
    return activeOutlet.items.filter(
      (it) =>
        it.name.toLowerCase().includes(f) ||
        it.category.toLowerCase().includes(f) ||
        it.size.toLowerCase().includes(f)
    );
  }, [activeOutlet, itemFilter]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const uploaded: UploadResult[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('period_label', file.name);
        formData.append('start_date', '');
        formData.append('end_date', '');
        const res = await fetch('/api/excel-upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
          throw new Error(err.detail || 'Upload failed');
        }
        const data: UploadResult = await res.json();
        uploaded.push(data);
      }
      setDatasets((prev) => {
        const existing = new Map(prev.map((d) => [d.filename, d]));
        for (const u of uploaded) existing.set(u.filename, u);
        return [...existing.values()];
      });
      setSelectedOutlet(null);
    } catch (e: any) {
      setError(e.message || 'Upload error');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  };

  const totalOutlets = allOutlets.length;
  const fileNames = datasets.map((d) => d.filename);
  const emptyFiles = datasets
    .filter(
      (d) =>
        (!d.outlets || d.outlets.length === 0) &&
        (!d.raw_sheets || d.raw_sheets.every((s) => !s.rows || s.rows.length === 0))
    )
    .map((d) => d.filename);

  const handleSelectRow = (o: OutletRow) => {
    setItemFilter('');
    if (o.source === 'database' && o.dbId && onSelectOutlet && o.items.length === 0 && !o.rawMetrics) {
      onSelectOutlet(o.dbId);
    } else {
      setSelectedOutlet(o);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
          <Search className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Outlet Search</h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto">
          Search any outlet (e.g. LP Savani, lp savani, Adajan, Nanpura) to view its full sales, purchase, and all food items.
        </p>
      </div>

      {/* ALWAYS-VISIBLE Search Bar */}
      <div className="space-y-3">
        <div className="relative flex items-center bg-white rounded-xl border border-slate-300 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-sm transition-all">
          <div className="pl-4 text-blue-600 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedOutlet(null);
            }}
            autoFocus
            placeholder="Search outlet name (e.g. LP S, lp savani, Adajan, Nanpura)..."
            className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium py-3.5 px-3 text-sm"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedOutlet(null);
              }}
              className="mr-3 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>
            {totalOutlets === 0
              ? 'No outlets loaded yet — upload an Excel/CSV below'
              : query
              ? `${searchResults.length} outlet${searchResults.length !== 1 ? 's' : ''} matched for "${query}"`
              : `${totalOutlets} outlets ready — click any outlet or type to filter`}
          </span>
        </div>

        {/* Outlet Options List */}
        {totalOutlets > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                <Store className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="font-medium">No outlets matched "{query}"</p>
                <p className="text-xs mt-1">Try fewer letters or a different part of the name</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {searchResults.slice(0, 50).map((o, idx) => (
                  <button
                    key={o.outlet + idx}
                    onClick={() => handleSelectRow(o)}
                    className={`w-full text-left p-3.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors ${
                      activeOutlet?.outlet === o.outlet ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 text-sm block">{o.outlet}</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          {o.source === 'database' ? (
                            <>
                              <Database className="w-3 h-3" /> Saved Outlet
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-3 h-3" /> {o.items.length} food items
                            </>
                          )}
                          {o.city ? ` • ${o.city}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {query && (
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            o.score >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {o.score}% match
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl p-5 text-center bg-blue-50/40 cursor-pointer transition-all"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        {loading ? (
          <div className="flex flex-col items-center space-y-2 text-blue-600">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-sm font-medium">Parsing file…</span>
          </div>
        ) : (
          <>
            <Upload className="w-7 h-7 text-blue-400 mx-auto mb-1.5" />
            <p className="text-sm font-semibold text-blue-700">
              Drop Excel / CSV here, or click to upload
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload one or multiple reports (e.g. Burgers, Beverages, All Outlets) — food items merge per outlet
            </p>
          </>
        )}
      </div>

      {/* Loaded files chips */}
      {fileNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileNames.map((fn) => (
            <span
              key={fn}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium border border-emerald-200"
            >
              <FileSpreadsheet className="w-3 h-3" />
              {fn}
              <button
                className="ml-1 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setDatasets((prev) => prev.filter((d) => d.filename !== fn));
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {emptyFiles.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>{emptyFiles.join(', ')}</strong> has 0 data rows inside (only column headers). Upload a report with outlet rows (e.g. Burgers/Beverages Outlet Report or Sales/Purchase Excel).
          </span>
        </div>
      )}

      {/* Example patterns when no outlets are loaded */}
      {totalOutlets === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-600 mb-3">
            Smart Fuzzy Search Examples (works after uploading any Excel or when DB has outlets):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-left max-w-md mx-auto">
            {[
              ['"LP S"', 'L P SAVANI- TASTIFY'],
              ['"lp savani"', 'L P SAVANI- TASTIFY'],
              ['"adjan"', 'ADAJAN -VAIBHAV LAXMI'],
              ['"NANPURA"', 'NANPURA-TASTIFY'],
            ].map(([q, r]) => (
              <div
                key={q}
                className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between gap-1"
              >
                <span className="text-slate-500 font-mono">{q}</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                  <ArrowRight className="w-3 h-3" />
                  {r}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel for selected outlet WITH ALL FOOD ITEMS */}
      {activeOutlet && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-md p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{activeOutlet.outlet}</h2>
                <p className="text-xs text-slate-400">
                  Outlet Analytics Summary • {activeOutlet.items.length} Food Items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeOutlet.dbId && onSelectOutlet && (
                <button
                  onClick={() => onSelectOutlet(activeOutlet.dbId!)}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Open Full Analytics
                </button>
              )}
              <button
                onClick={() => setSelectedOutlet(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Individual Sales" value={activeOutlet.individual_sales} color="blue" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Combo Sales" value={activeOutlet.combo_sales} color="indigo" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Sales Qty" value={activeOutlet.total_sales_qty} color="emerald" />
            <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Packs" value={activeOutlet.purchase_packs} color="amber" />
            <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Units" value={activeOutlet.purchase_units} color="orange" />
            <StatCard icon={<Percent className="w-4 h-4" />} label="RMD %" value={`${activeOutlet.rmd_pct.toFixed(2)}%`} color="rose" />
          </div>

          {/* Food Items Table */}
          {activeOutlet.items.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-blue-600" />
                  Food Items for {activeOutlet.outlet} ({filteredItems.length})
                </h3>
                <input
                  type="text"
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  placeholder="Filter food items..."
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-blue-500 w-full sm:w-56"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Food Item</th>
                      <th className="py-2.5 px-3">Category / Sheet</th>
                      <th className="py-2.5 px-3 text-right">Indiv Sales</th>
                      <th className="py-2.5 px-3 text-right">Combo Sales</th>
                      <th className="py-2.5 px-3 text-right">Total Sales</th>
                      <th className="py-2.5 px-3 text-right">Purch Packs</th>
                      <th className="py-2.5 px-3 text-right">Purch Units</th>
                      <th className="py-2.5 px-3 text-right">RMD %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((it, idx) => (
                      <tr key={`${it.name}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {it.name}
                          {it.size && (
                            <span className="ml-1.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {it.size}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{it.category}</td>
                        <td className="py-2 px-3 text-right text-slate-700">{it.individual_sales.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-purple-600">{it.combo_sales.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{it.sales_qty.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-700">{it.purchase_packs.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-semibold text-amber-700">{it.purchase_units.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{it.rmd_pct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'indigo' | 'emerald' | 'amber' | 'orange' | 'rose';
}) {
  const colorMap = {
    blue:    'bg-blue-50 text-blue-700 border-blue-100',
    indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber:   'bg-amber-50 text-amber-700 border-amber-100',
    orange:  'bg-orange-50 text-orange-700 border-orange-100',
    rose:    'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}
