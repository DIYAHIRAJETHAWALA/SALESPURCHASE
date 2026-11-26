import React, { useState, useMemo, useRef } from 'react';
import {
  Search, Store, Upload, X, FileSpreadsheet, ChevronRight,
  TrendingUp, Package, Percent, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';

interface OutletSearchPageProps {
  onSelectOutlet?: (outletId: number) => void;
}

interface OutletRow {
  outlet: string;
  individual_sales: number;
  combo_sales: number;
  total_sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  rmd_pct: number;
}

interface UploadResult {
  mode?: string;
  report_type?: string;
  category: string;
  filename: string;
  outlets: Array<{
    outlet: string;
    summary: {
      individual_sales: number;
      combo_sales: number;
      total_sales_qty: number;
      purchase_packs: number;
      purchase_units: number;
      rmd_pct: number;
    };
  }>;
}

// Simple in-browser fuzzy/partial match scorer
function fuzzyScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const q = query.toLowerCase().replace(/[\s\-().,_]+/g, ' ').trim();
  const t = text.toLowerCase().replace(/[\s\-().,_]+/g, ' ').trim();

  // Exact match
  if (q === t) return 100;
  // Exact substring
  if (t.includes(q)) return 90;

  // Check all words in query appear somewhere in text
  const qWords = q.split(' ').filter(Boolean);
  const tWords = t.split(' ').filter(Boolean);

  // All query words found as substrings in target
  const allFound = qWords.every(qw => tWords.some(tw => tw.includes(qw) || qw.includes(tw)));
  if (allFound && qWords.length > 0) return 85;

  // Partial word match — most query words found
  const foundCount = qWords.filter(qw => tWords.some(tw => tw.includes(qw) || qw.includes(tw))).length;
  if (foundCount > 0 && qWords.length > 0) {
    return Math.round(70 * (foundCount / qWords.length));
  }

  // Consecutive character match (initials like "LP S" → "L P SAVANI")
  // Collapse all spaces and check if query chars appear in order
  const qCompact = q.replace(/\s/g, '');
  const tCompact = t.replace(/\s/g, '');
  if (tCompact.includes(qCompact)) return 80;

  // Check if first letters of target words start with query chars
  const firstLetters = tWords.map(w => w[0]).join('');
  if (firstLetters.includes(qCompact)) return 75;
  if (qCompact.split('').every((ch, i) => firstLetters[i] === ch)) return 72;

  return 0;
}

export const OutletSearchPage: React.FC<OutletSearchPageProps> = () => {
  const [datasets, setDatasets] = useState<UploadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Build flat list of all outlets from all uploaded files
  const allOutlets = useMemo<OutletRow[]>(() => {
    const seen = new Set<string>();
    const rows: OutletRow[] = [];
    for (const ds of datasets) {
      for (const o of ds.outlets || []) {
        const key = o.outlet.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            outlet: o.outlet,
            individual_sales: o.summary?.individual_sales ?? 0,
            combo_sales: o.summary?.combo_sales ?? 0,
            total_sales_qty: o.summary?.total_sales_qty ?? 0,
            purchase_packs: o.summary?.purchase_packs ?? 0,
            purchase_units: o.summary?.purchase_units ?? 0,
            rmd_pct: o.summary?.rmd_pct ?? 0,
          });
        }
      }
    }
    return rows;
  }, [datasets]);

  // Fuzzy search results
  const searchResults = useMemo<Array<OutletRow & { score: number }>>(() => {
    const q = query.trim();
    if (!q) return allOutlets.map(o => ({ ...o, score: 100 }));
    return allOutlets
      .map(o => ({ ...o, score: fuzzyScore(q, o.outlet) }))
      .filter(o => o.score >= 60)
      .sort((a, b) => b.score - a.score);
  }, [query, allOutlets]);

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
      setDatasets(prev => {
        // Merge new files, dedup by filename
        const existing = new Map(prev.map(d => [d.filename, d]));
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
  const fileNames = datasets.map(d => d.filename);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pt-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
          <Search className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Outlet Search</h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto">
          Upload any Excel/CSV report, then search any outlet by name — fuzzy matching included.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl p-6 text-center bg-blue-50/50 cursor-pointer transition-all"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv"
          className="hidden"
          onChange={e => handleFileUpload(e.target.files)}
        />
        {loading ? (
          <div className="flex flex-col items-center space-y-2 text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-medium">Parsing file…</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-blue-700">Drop Excel / CSV here, or click to browse</p>
            <p className="text-xs text-slate-500 mt-1">Supports .xlsx .xlsm .xls .csv — any report type</p>
          </>
        )}
      </div>

      {/* Loaded files chips */}
      {fileNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileNames.map(fn => (
            <span key={fn} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium border border-emerald-200">
              <FileSpreadsheet className="w-3 h-3" />
              {fn}
              <button
                className="ml-1 hover:text-red-600"
                onClick={e => { e.stopPropagation(); setDatasets(prev => prev.filter(d => d.filename !== fn)); }}
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

      {/* Search box — only show if outlets loaded */}
      {totalOutlets > 0 && (
        <div className="space-y-3">
          <div className="relative flex items-center bg-white rounded-xl border border-slate-300 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-sm transition-all">
            <div className="pl-4 text-blue-600 pointer-events-none">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedOutlet(null); }}
              autoFocus
              placeholder="Type outlet name e.g. LP S, Adajan, Nanpura, lp savani…"
              className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium py-3.5 px-3 text-sm"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSelectedOutlet(null); }}
                className="mr-3 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="text-xs text-slate-500 font-medium px-1">
            {query
              ? `${searchResults.length} outlet${searchResults.length !== 1 ? 's' : ''} matched for "${query}"`
              : `${totalOutlets} outlets loaded — start typing to search`
            }
          </div>

          {/* Results list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {searchResults.length === 0 && query ? (
              <div className="p-8 text-center text-sm text-slate-400">
                <Store className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="font-medium">No outlets matched "{query}"</p>
                <p className="text-xs mt-1">Try fewer letters or a different part of the name</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {searchResults.slice(0, 30).map((o, idx) => (
                  <button
                    key={o.outlet + idx}
                    onClick={() => setSelectedOutlet(o)}
                    className={`w-full text-left p-3.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors ${
                      selectedOutlet?.outlet === o.outlet ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-slate-800 text-sm">{o.outlet}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {query && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          o.score >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
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
        </div>
      )}

      {/* Empty state — no files yet */}
      {totalOutlets === 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 mb-1">Upload a file to start searching</h3>
          <p className="text-sm text-slate-400 mb-4">
            Upload any Outlet Report, POS Sales CSV, or Purchase Excel — outlets are extracted automatically.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-left max-w-sm mx-auto">
            {[
              ['"LP S"', '→ L P SAVANI- TASTIFY'],
              ['"lp savani"', '→ L P SAVANI- TASTIFY'],
              ['"Adajan"', '→ ADAJAN outlet'],
              ['"NANPURA"', '→ NANPURA outlet'],
            ].map(([q, r]) => (
              <div key={q} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between gap-1">
                <span className="text-slate-500 font-mono">{q}</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                  <ArrowRight className="w-3 h-3" />{r}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel for selected outlet */}
      {selectedOutlet && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-md p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{selectedOutlet.outlet}</h2>
                <p className="text-xs text-slate-400">Outlet Analytics Summary</p>
              </div>
            </div>
            <button onClick={() => setSelectedOutlet(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Individual Sales" value={selectedOutlet.individual_sales} color="blue" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Combo Sales" value={selectedOutlet.combo_sales} color="indigo" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Sales Qty" value={selectedOutlet.total_sales_qty} color="emerald" />
            <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Packs" value={selectedOutlet.purchase_packs} color="amber" />
            <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Units" value={selectedOutlet.purchase_units} color="orange" />
            <StatCard icon={<Percent className="w-4 h-4" />} label="RMD %" value={`${selectedOutlet.rmd_pct.toFixed(2)}%`} color="rose" />
          </div>
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
