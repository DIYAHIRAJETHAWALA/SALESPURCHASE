import React, { useState, useMemo, useRef } from 'react';
import {
  Upload, FileSpreadsheet, X, AlertCircle, Loader2,
  ArrowUpDown, TrendingUp, Package, Factory, Scale,
  CheckCircle2, XCircle, Info, Download, Search, ChevronDown,
} from 'lucide-react';
import { normalizeOutletStr, isTotalRowLabel } from '../utils/outletFuzzy';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RowData {
  outlet: string;
  item: string;
  qty: number;
  packs: number;
  amount: number;
  raw: Record<string, string>;
}

interface ParsedFile {
  filename: string;
  role: 'sales' | 'purchase' | 'dispatch';
  rows: RowData[];
  headers: string[];
  warnings: string[];
}

interface OutletSummary {
  outlet: string;
  salesQty: number;
  salesAmt: number;
  purchaseQty: number;
  purchaseAmt: number;
  dispatchQty: number;
  dispatchPacks: number;
  varianceSP: number;       // sales - purchase
  varianceDP: number;       // dispatch - purchase
  varianceDS: number;       // dispatch - sold
  rmdPct: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/[₹$,\s]/g, '').replace(/[()]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function colScore(header: string, keywords: string[]): number {
  const low = header.toLowerCase();
  return keywords.reduce((s, k) => s + (low.includes(k) ? 1 : 0), 0);
}

function detectColIdx(headers: string[], ...groups: string[][]): number {
  let bestIdx = -1, bestScore = 0;
  headers.forEach((h, i) => {
    for (const keywords of groups) {
      const score = colScore(h, keywords);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
  });
  return bestIdx;
}

function guessRole(filename: string): 'sales' | 'purchase' | 'dispatch' {
  const low = filename.toLowerCase();
  if (low.includes('dispatch') || low.includes('factory') || low.includes('despatch')) return 'dispatch';
  if (low.includes('purchase') || low.includes('order') || low.includes('purch')) return 'purchase';
  return 'sales';
}

function parseSheetRows(
  headers: string[],
  rows: (string | number | null)[][]
): { rows: RowData[]; warnings: string[] } {
  const warnings: string[] = [];

  const outletIdx = detectColIdx(headers,
    ['outlet', 'location', 'branch', 'store', 'franchise', 'party'],
    ['name'],
  );
  const itemIdx = detectColIdx(headers,
    ['item', 'product', 'food', 'sku', 'description', 'particulars'],
    ['name', 'desc'],
  );
  const qtyIdx = detectColIdx(headers,
    ['qty', 'quantity', 'sold', 'sale', 'unit', 'dispatch', 'despatch', 'pcs'],
    ['total', 'sales'],
  );
  const packsIdx = detectColIdx(headers,
    ['pack', 'carton', 'box', 'ctn'],
  );
  const amtIdx = detectColIdx(headers,
    ['amount', 'value', 'total', 'amt', 'sales', 'revenue', '₹'],
    ['sum', 'net'],
  );

  if (outletIdx === -1 && itemIdx === -1) {
    warnings.push('Could not auto-detect outlet/item columns — using first text column as outlet');
  }

  const result: RowData[] = [];
  let lastOutlet = '';

  for (const row of rows) {
    const outletRaw = outletIdx >= 0 ? String(row[outletIdx] ?? '').trim() : '';
    const outlet = outletRaw || lastOutlet;
    if (!outlet || isTotalRowLabel(outlet)) continue;
    if (/^[\d.,\-₹$%]+$/.test(outlet)) continue;

    lastOutlet = outlet;
    const item = itemIdx >= 0 ? String(row[itemIdx] ?? '').trim() : '';
    const qty = qtyIdx >= 0 ? parseNumber(row[qtyIdx]) : 0;
    const packs = packsIdx >= 0 ? parseNumber(row[packsIdx]) : 0;
    const amount = amtIdx >= 0 ? parseNumber(row[amtIdx]) : 0;

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h] = String(row[i] ?? ''); });

    result.push({ outlet, item, qty, packs, amount, raw });
  }
  return { rows: result, warnings };
}

// ─── Upload Zone Component ────────────────────────────────────────────────────

function UploadZone({
  label, role, onFile, files, onRemove, loading, color,
}: {
  label: string; role: 'sales' | 'purchase' | 'dispatch';
  onFile: (f: File[]) => void; files: ParsedFile[];
  onRemove: (name: string) => void; loading: boolean; color: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const myFiles = files.filter(f => f.role === role);

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 text-emerald-700',
    blue:    'border-blue-300    hover:border-blue-500    bg-blue-50/40    text-blue-700',
    violet:  'border-violet-300  hover:border-violet-500  bg-violet-50/40  text-violet-700',
  };
  const chipMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    blue:    'bg-blue-100    text-blue-800    border-blue-200',
    violet:  'bg-violet-100  text-violet-800  border-violet-200',
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        onDrop={e => { e.preventDefault(); onFile(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${colorMap[color]}`}
      >
        <input ref={ref} type="file" multiple accept=".xlsx,.xlsm,.xls,.csv" className="hidden"
          onChange={e => onFile(Array.from(e.target.files || []))} />
        {loading
          ? <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          : <><Upload className="w-6 h-6 mx-auto mb-1 opacity-70" />
              <p className="text-xs font-semibold">Drop {label} Excel or click</p>
              <p className="text-[11px] opacity-60 mt-0.5">Multiple files OK</p></>
        }
      </div>
      {myFiles.map(f => (
        <div key={f.filename} className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${chipMap[color]}`}>
          <span className="flex items-center gap-1.5"><FileSpreadsheet className="w-3 h-3" />{f.filename} <span className="opacity-60">({f.rows.length} rows)</span></span>
          <button onClick={() => onRemove(f.filename)}><X className="w-3 h-3" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Variance Badge ───────────────────────────────────────────────────────────

function VBadge({ val, label }: { val: number; label: string }) {
  const cls = val > 10 ? 'bg-red-100 text-red-700' : val < -10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const sign = val > 0 ? '+' : '';
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{sign}{val.toLocaleString()} {label}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const CompareDispatchPage: React.FC = () => {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<'compare' | 'dispatch' | 'detail'>('compare');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'outlet' | 'varianceSP' | 'varianceDP' | 'salesQty' | 'purchaseQty' | 'dispatchQty'>('varianceSP');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailOutlet, setDetailOutlet] = useState<OutletSummary | null>(null);

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = async (fileList: File[], role: 'sales' | 'purchase' | 'dispatch') => {
    setLoading(prev => ({ ...prev, [role]: true }));
    const newErrors: string[] = [];

    for (const file of fileList) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('period_label', file.name);
        formData.append('start_date', '');
        formData.append('end_date', '');
        const res = await fetch('/api/excel-upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const e = await res.json().catch(() => ({ detail: 'Upload failed' }));
          newErrors.push(`${file.name}: ${e.detail}`);
          continue;
        }
        const data = await res.json();

        // Parse all sheets generically
        let allRows: RowData[] = [];
        let allHeaders: string[] = [];
        const warnings: string[] = [];

        // Try structured outlets first
        if (data.outlets && data.outlets.length > 0) {
          for (const o of data.outlets) {
            for (const item of (o.items || [])) {
              allRows.push({
                outlet: o.outlet,
                item: item.name || '',
                qty: (item.individual_sales ?? 0) + (item.combo_sales ?? 0),
                packs: item.purchase_packs ?? 0,
                amount: (item.individual_sales ?? 0) + (item.combo_sales ?? 0),
                raw: {},
              });
            }
            // If outlet has no items, still add outlet-level summary
            if (!o.items || o.items.length === 0) {
              allRows.push({
                outlet: o.outlet,
                item: '_OUTLET_TOTAL_',
                qty: o.summary?.total_sales_qty ?? 0,
                packs: o.summary?.purchase_packs ?? 0,
                amount: o.summary?.individual_sales ?? 0,
                raw: {},
              });
            }
          }
        }

        // Also parse raw sheets for more data
        if (data.raw_sheets && data.raw_sheets.length > 0) {
          for (const sheet of data.raw_sheets) {
            if (!sheet.headers || !sheet.rows || sheet.rows.length === 0) continue;
            if (allHeaders.length === 0) allHeaders = sheet.headers;
            const parsed = parseSheetRows(sheet.headers, sheet.rows);
            allRows = [...allRows, ...parsed.rows];
            warnings.push(...parsed.warnings);
          }
        }

        // If nothing parsed from structured, try raw
        if (allRows.length === 0) {
          warnings.push('Could not detect outlet/item structure — please check column headers');
        }

        const detectedRole = guessRole(file.name);
        const finalRole = role; // User explicitly chose the role

        setFiles(prev => {
          const without = prev.filter(f => f.filename !== file.name);
          return [...without, {
            filename: file.name,
            role: finalRole,
            rows: allRows,
            headers: allHeaders,
            warnings,
          }];
        });
      } catch (e: any) {
        newErrors.push(`${file.name}: ${e.message}`);
      }
    }

    if (newErrors.length > 0) setErrors(prev => [...prev, ...newErrors]);
    setLoading(prev => ({ ...prev, [role]: false }));
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.filename !== name));

  // ── Outlet Summary Computation ──────────────────────────────────────────────
  const summary = useMemo<OutletSummary[]>(() => {
    const map = new Map<string, OutletSummary>();

    const accum = (role: 'sales' | 'purchase' | 'dispatch', rows: RowData[]) => {
      for (const row of rows) {
        const key = normalizeOutletStr(row.outlet);
        if (!key) continue;
        const existing = map.get(key) || {
          outlet: row.outlet,
          salesQty: 0, salesAmt: 0,
          purchaseQty: 0, purchaseAmt: 0,
          dispatchQty: 0, dispatchPacks: 0,
          varianceSP: 0, varianceDP: 0, varianceDS: 0, rmdPct: 0,
        };
        if (role === 'sales') {
          existing.salesQty += row.qty;
          existing.salesAmt += row.amount;
        } else if (role === 'purchase') {
          existing.purchaseQty += row.qty;
          existing.purchaseAmt += row.amount;
        } else {
          existing.dispatchQty += row.qty;
          existing.dispatchPacks += row.packs;
        }
        map.set(key, existing);
      }
    };

    for (const f of files) accum(f.role, f.rows);

    return Array.from(map.values()).map(o => ({
      ...o,
      varianceSP: o.salesQty - o.purchaseQty,
      varianceDP: o.dispatchQty - o.purchaseQty,
      varianceDS: o.dispatchQty - o.salesQty,
      rmdPct: o.purchaseQty > 0 ? Math.round((o.salesQty / o.purchaseQty) * 10000) / 100 : 0,
    }));
  }, [files]);

  const hasDispatch = files.some(f => f.role === 'dispatch');
  const hasSales = files.some(f => f.role === 'sales');
  const hasPurchase = files.some(f => f.role === 'purchase');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = q ? summary.filter(o => o.outlet.toLowerCase().includes(q)) : summary;
    rows = [...rows].sort((a, b) => {
      const v = sort === 'outlet'
        ? a.outlet.localeCompare(b.outlet)
        : (a[sort] as number) - (b[sort] as number);
      return sortDir === 'asc' ? v : -v;
    });
    return rows;
  }, [summary, search, sort, sortDir]);

  const toggleSort = (col: typeof sort) => {
    if (sort === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setSortDir('desc'); }
  };

  const allWarnings = files.flatMap(f => f.warnings.map(w => `${f.filename}: ${w}`));
  const totalOutlets = summary.length;

  // Export CSV
  const exportCsv = () => {
    const headers = ['Outlet', 'Sales Qty', 'Sales Amt', 'Purchase Qty', 'Purchase Amt',
      'Dispatch Qty', 'Dispatch Packs', 'Variance (S-P)', 'Variance (D-P)', 'RMD%'];
    const rows = filtered.map(o => [
      o.outlet, o.salesQty, o.salesAmt, o.purchaseQty, o.purchaseAmt,
      o.dispatchQty, o.dispatchPacks, o.varianceSP, o.varianceDP, o.rmdPct,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `compare_dispatch_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Compare & Dispatch</h1>
              <p className="text-slate-500 text-sm">Upload Sales, Purchase & Factory Dispatch Excels — compare per outlet</p>
            </div>
          </div>
        </div>
        {totalOutlets > 0 && (
          <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* ── Upload Row ── */}
      <div className={`grid gap-4 ${hasDispatch || files.length === 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        <UploadZone label="📈 Sales Excel" role="sales" color="emerald"
          onFile={fs => handleUpload(fs, 'sales')} files={files}
          onRemove={removeFile} loading={!!loading.sales} />
        <UploadZone label="📦 Purchase Excel" role="purchase" color="blue"
          onFile={fs => handleUpload(fs, 'purchase')} files={files}
          onRemove={removeFile} loading={!!loading.purchase} />
        <UploadZone label="🏭 Factory Dispatch Excel" role="dispatch" color="violet"
          onFile={fs => handleUpload(fs, 'dispatch')} files={files}
          onRemove={removeFile} loading={!!loading.dispatch} />
      </div>

      {/* ── Errors & Warnings ── */}
      {errors.map((e, i) => (
        <div key={i} className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />{e}
          <button className="ml-auto" onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
        </div>
      ))}
      {allWarnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Auto-detect notes:</strong> {allWarnings.join(' | ')}</div>
        </div>
      )}

      {/* ── Empty State ── */}
      {totalOutlets === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <Scale className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h2 className="font-bold text-slate-700 text-lg mb-2">Upload Excels to Compare</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Drop your Sales Excel, Purchase Excel, and optionally your Factory Dispatch Excel above.
            The app will auto-match outlets across all files and show the full comparison.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-xs text-left">
            {[
              { icon: '📈', title: 'Sales Excel', desc: 'Any outlet report with item-wise sales quantities' },
              { icon: '📦', title: 'Purchase Excel', desc: 'Purchase orders or stock received per outlet' },
              { icon: '🏭', title: 'Factory Dispatch', desc: 'What was dispatched from factory to each outlet' },
            ].map(c => (
              <div key={c.title} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-2xl mb-1">{c.icon}</div>
                <p className="font-semibold text-slate-700">{c.title}</p>
                <p className="text-slate-400 mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {totalOutlets > 0 && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 font-medium">Outlets Detected</p>
              <p className="text-2xl font-extrabold text-slate-900">{totalOutlets}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 shadow-sm">
              <p className="text-xs text-emerald-700 font-medium">Total Sales Qty</p>
              <p className="text-2xl font-extrabold text-emerald-800">{summary.reduce((s, o) => s + o.salesQty, 0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 shadow-sm">
              <p className="text-xs text-blue-700 font-medium">Total Purchase Qty</p>
              <p className="text-2xl font-extrabold text-blue-800">{summary.reduce((s, o) => s + o.purchaseQty, 0).toLocaleString()}</p>
            </div>
            {hasDispatch && (
              <div className="bg-violet-50 rounded-xl border border-violet-100 p-4 shadow-sm">
                <p className="text-xs text-violet-700 font-medium">Total Dispatched</p>
                <p className="text-2xl font-extrabold text-violet-800">{summary.reduce((s, o) => s + o.dispatchQty, 0).toLocaleString()}</p>
              </div>
            )}
            {!hasDispatch && (
              <div className="bg-rose-50 rounded-xl border border-rose-100 p-4 shadow-sm">
                <p className="text-xs text-rose-700 font-medium">S−P Variance</p>
                <p className="text-2xl font-extrabold text-rose-800">{summary.reduce((s, o) => s + o.varianceSP, 0).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-0">
            {[
              { id: 'compare', label: '📊 Sales vs Purchase' },
              ...(hasDispatch ? [{ id: 'dispatch', label: '🏭 Dispatch Tracking' }] : []),
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search + Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filter outlets…"
                  className="pl-9 pr-3 py-2 w-full text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:bg-white" />
              </div>
              <p className="text-xs text-slate-400 font-medium shrink-0">{filtered.length} of {totalOutlets} outlets</p>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              {tab === 'compare' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('outlet')}>
                        <span className="flex items-center gap-1">Outlet <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 text-emerald-700" onClick={() => toggleSort('salesQty')}>
                        <span className="flex items-center justify-end gap-1">Sales Qty <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right text-emerald-600">Sales Amt</th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 text-blue-700" onClick={() => toggleSort('purchaseQty')}>
                        <span className="flex items-center justify-end gap-1">Purch Qty <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right text-blue-600">Purch Amt</th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('varianceSP')}>
                        <span className="flex items-center justify-end gap-1">S−P Var <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right">RMD %</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((o, i) => {
                      const balanced = Math.abs(o.varianceSP) <= 5;
                      const bigLoss = o.varianceSP < -50;
                      return (
                        <tr key={o.outlet + i}
                          onClick={() => { setDetailOutlet(o); setTab('detail'); }}
                          className={`cursor-pointer hover:bg-indigo-50/40 transition-colors ${bigLoss ? 'bg-red-50/30' : ''}`}>
                          <td className="py-3 px-4 font-semibold text-slate-800 max-w-[220px] truncate">{o.outlet}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">{o.salesQty.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600">{o.salesAmt > 0 ? o.salesAmt.toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-700 font-semibold">{o.purchaseQty.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-600">{o.purchaseAmt > 0 ? o.purchaseAmt.toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold font-mono ${o.varianceSP > 0 ? 'text-emerald-700' : o.varianceSP < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {o.varianceSP > 0 ? '+' : ''}{o.varianceSP.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">{o.rmdPct > 0 ? `${o.rmdPct.toFixed(1)}%` : '—'}</td>
                          <td className="py-3 px-4 text-right">
                            {balanced
                              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><CheckCircle2 className="w-3 h-3" />OK</span>
                              : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200"><XCircle className="w-3 h-3" />Gap</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {tab === 'dispatch' && hasDispatch && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Outlet</th>
                      <th className="py-3 px-4 text-right text-violet-700 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('dispatchQty')}>
                        <span className="flex items-center justify-end gap-1">Dispatched <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right text-violet-600">Dispatch Packs</th>
                      <th className="py-3 px-4 text-right text-blue-700 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('purchaseQty')}>
                        <span className="flex items-center justify-end gap-1">Purchased <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right text-emerald-700 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('salesQty')}>
                        <span className="flex items-center justify-end gap-1">Sold <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('varianceDP')}>
                        <span className="flex items-center justify-end gap-1">D−P Var <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="py-3 px-4 text-right">D−Sold Var</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((o, i) => {
                      const dispOk = Math.abs(o.varianceDP) <= 5;
                      return (
                        <tr key={o.outlet + i}
                          onClick={() => { setDetailOutlet(o); setTab('detail'); }}
                          className="cursor-pointer hover:bg-violet-50/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 max-w-[200px] truncate">{o.outlet}</td>
                          <td className="py-3 px-4 text-right font-mono text-violet-700 font-semibold">{o.dispatchQty.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono text-violet-600">{o.dispatchPacks > 0 ? o.dispatchPacks.toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-700 font-semibold">{o.purchaseQty.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">{o.salesQty.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold font-mono ${o.varianceDP > 10 ? 'text-red-600' : o.varianceDP < -10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {o.varianceDP > 0 ? '+' : ''}{o.varianceDP.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold font-mono ${o.varianceDS > 10 ? 'text-red-600' : o.varianceDS < -10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {o.varianceDS > 0 ? '+' : ''}{o.varianceDS.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {dispOk
                              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><CheckCircle2 className="w-3 h-3" />OK</span>
                              : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200"><XCircle className="w-3 h-3" />Gap</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {tab === 'detail' && detailOutlet && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">{detailOutlet.outlet}</h2>
                      <p className="text-xs text-slate-400">Detailed S / P / Dispatch breakdown</p>
                    </div>
                    <button onClick={() => setTab('compare')} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg">
                      ← Back to table
                    </button>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Sales Qty', val: detailOutlet.salesQty, color: 'emerald' },
                      { label: 'Sales Amount', val: detailOutlet.salesAmt, color: 'emerald' },
                      { label: 'Purchase Qty', val: detailOutlet.purchaseQty, color: 'blue' },
                      { label: 'Purchase Amount', val: detailOutlet.purchaseAmt, color: 'blue' },
                      ...(hasDispatch ? [
                        { label: 'Dispatched Qty', val: detailOutlet.dispatchQty, color: 'violet' },
                        { label: 'Dispatch Packs', val: detailOutlet.dispatchPacks, color: 'violet' },
                      ] : []),
                      { label: 'Sales−Purchase', val: detailOutlet.varianceSP, color: detailOutlet.varianceSP >= 0 ? 'emerald' : 'red' },
                      { label: 'RMD %', val: `${detailOutlet.rmdPct.toFixed(2)}%`, color: 'slate' },
                    ].map(c => (
                      <div key={c.label} className={`rounded-xl border p-3 ${
                        c.color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                        c.color === 'blue'    ? 'bg-blue-50    border-blue-100    text-blue-800' :
                        c.color === 'violet'  ? 'bg-violet-50  border-violet-100  text-violet-800' :
                        c.color === 'red'     ? 'bg-red-50     border-red-100     text-red-800' :
                        'bg-slate-50 border-slate-100 text-slate-800'}`}>
                        <p className="text-[11px] font-medium opacity-70">{c.label}</p>
                        <p className="text-xl font-extrabold">{typeof c.val === 'number' ? c.val.toLocaleString() : c.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Variance Badges */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-semibold text-slate-600">Variances:</span>
                    <VBadge val={detailOutlet.varianceSP} label="Sales vs Purchase" />
                    {hasDispatch && <>
                      <VBadge val={detailOutlet.varianceDP} label="Dispatch vs Purchase" />
                      <VBadge val={detailOutlet.varianceDS} label="Dispatch vs Sold" />
                    </>}
                  </div>

                  {/* Raw items from each file */}
                  {files.map(f => {
                    const outletKey = normalizeOutletStr(detailOutlet.outlet);
                    const rows = f.rows.filter(r => normalizeOutletStr(r.outlet) === outletKey && r.item && r.item !== '_OUTLET_TOTAL_');
                    if (rows.length === 0) return null;
                    const roleColor = f.role === 'sales' ? 'emerald' : f.role === 'purchase' ? 'blue' : 'violet';
                    return (
                      <div key={f.filename} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className={`px-4 py-2.5 text-xs font-bold ${
                          roleColor === 'emerald' ? 'bg-emerald-50 text-emerald-800' :
                          roleColor === 'blue' ? 'bg-blue-50 text-blue-800' : 'bg-violet-50 text-violet-800'
                        }`}>
                          {f.role === 'sales' ? '📈' : f.role === 'purchase' ? '📦' : '🏭'} {f.filename} ({f.role})
                        </div>
                        <div className="overflow-x-auto max-h-56 overflow-y-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                              <tr>
                                <th className="py-2 px-3">Item</th>
                                <th className="py-2 px-3 text-right">Qty</th>
                                <th className="py-2 px-3 text-right">Packs</th>
                                <th className="py-2 px-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {rows.map((r, ri) => (
                                <tr key={ri} className="hover:bg-slate-50">
                                  <td className="py-1.5 px-3 font-medium text-slate-800">{r.item || '—'}</td>
                                  <td className="py-1.5 px-3 text-right font-mono text-slate-700">{r.qty > 0 ? r.qty.toLocaleString() : '—'}</td>
                                  <td className="py-1.5 px-3 text-right font-mono text-slate-700">{r.packs > 0 ? r.packs.toLocaleString() : '—'}</td>
                                  <td className="py-1.5 px-3 text-right font-mono text-slate-700">{r.amount > 0 ? r.amount.toLocaleString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Green variance = Sales &gt; Purchase (more sold than received)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Red variance = Sales &lt; Purchase (stock gap)</span>
            {hasDispatch && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />D−P = Factory dispatched minus outlet received (transit loss?)</span>}
          </div>
        </>
      )}
    </div>
  );
};
