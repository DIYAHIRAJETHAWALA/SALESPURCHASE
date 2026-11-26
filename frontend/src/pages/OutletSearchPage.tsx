import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Store, Upload, X, FileSpreadsheet, ChevronRight,
  TrendingUp, Package, Percent, AlertCircle, Loader2, ArrowRight, Database
} from 'lucide-react';
import { useUploadedData, UploadResult } from '../context/UploadedDataContext';
import { fetchOutletsList } from '../api';

interface OutletSearchPageProps {
  onSelectOutlet?: (outletId: number) => void;
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
  rawMetrics?: Array<{ label: string; value: string }>;
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\-().,_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

// Fuzzy & partial match scorer (case-insensitive, punctuation-insensitive, typo-tolerant)
function fuzzyScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const q = normalizeStr(query);
  const t = normalizeStr(text);
  if (!q || !t) return 0;

  if (q === t) return 100;
  if (t.includes(q)) return 92;

  const qCompact = q.replace(/\s/g, '');
  const tCompact = t.replace(/\s/g, '');
  if (tCompact.includes(qCompact)) return 88;

  const qWords = q.split(' ').filter(Boolean);
  const tWords = t.split(' ').filter(Boolean);

  // Word-level matching (exact substring or small typo)
  let wordScoreSum = 0;
  let matchedWords = 0;
  for (const qw of qWords) {
    let bestWordScore = 0;
    for (const tw of tWords) {
      if (tw === qw) {
        bestWordScore = 1.0;
        break;
      }
      if (tw.includes(qw) || (qw.length >= 3 && qw.includes(tw))) {
        bestWordScore = Math.max(bestWordScore, 0.9);
      } else if (qw.length >= 3 && tw.length >= 3) {
        const dist = levenshtein(qw, tw);
        const maxLen = Math.max(qw.length, tw.length);
        if (dist <= 2 && dist / maxLen <= 0.45) {
          bestWordScore = Math.max(bestWordScore, 1 - dist / maxLen);
        } else if (tw.startsWith(qw.slice(0, 2)) && dist <= 3) {
          bestWordScore = Math.max(bestWordScore, 0.65);
        }
      }
    }
    if (bestWordScore > 0) matchedWords++;
    wordScoreSum += bestWordScore;
  }

  if (matchedWords === qWords.length && qWords.length > 0) {
    return Math.round(70 + (wordScoreSum / qWords.length) * 18);
  }
  if (matchedWords > 0 && qWords.length > 0) {
    return Math.round((wordScoreSum / qWords.length) * 72);
  }

  // Initials / prefix match (e.g. "LP S" -> "L P SAVANI")
  const firstLetters = tWords.map(w => w[0]).join('');
  if (firstLetters.includes(qCompact)) return 78;

  // Ordered character subsequence match in compact form (e.g. "lps" -> "lpsavani")
  let qi = 0;
  for (let ti = 0; ti < tCompact.length && qi < qCompact.length; ti++) {
    if (tCompact[ti] === qCompact[qi]) qi++;
  }
  if (qi === qCompact.length && qCompact.length >= 2) {
    return 68;
  }

  return 0;
}

function isTotalLabel(name: string): boolean {
  const low = name.trim().toLowerCase();
  return (
    !low ||
    low === 'total' ||
    low === 'grand total' ||
    low.startsWith('total ') ||
    low.startsWith('grand total')
  );
}

export const OutletSearchPage: React.FC<OutletSearchPageProps> = ({ onSelectOutlet }) => {
  const { datasets, setDatasets } = useUploadedData();
  const [dbOutlets, setDbOutlets] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load any outlets stored in backend DB so search works even without uploading an Excel
  useEffect(() => {
    let cancelled = false;
    fetchOutletsList()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const mapped: OutletRow[] = list.map((o) => ({
          outlet: o.official_name,
          dbId: o.id,
          code: o.code,
          city: o.city,
          aliases: (o.aliases || []).map((a) => a.raw_alias),
          source: 'database',
          individual_sales: 0,
          combo_sales: 0,
          total_sales_qty: 0,
          purchase_packs: 0,
          purchase_units: 0,
          rmd_pct: 0,
        }));
        setDbOutlets(mapped);
      })
      .catch(() => {
        // Backend may be offline or empty; Excel upload still works
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build flat list of all outlets from uploaded files (both structured `outlets` and generic `raw_sheets`) + DB outlets
  const allOutlets = useMemo<OutletRow[]>(() => {
    const byKey = new Map<string, OutletRow>();

    // 1. Structured outlets from uploaded Excel/CSV files
    for (const ds of datasets) {
      for (const o of ds.outlets || []) {
        const key = normalizeStr(o.outlet);
        if (!key || isTotalLabel(o.outlet)) continue;
        if (!byKey.has(key)) {
          byKey.set(key, {
            outlet: o.outlet,
            source: 'excel',
            individual_sales: o.summary?.individual_sales ?? 0,
            combo_sales: o.summary?.combo_sales ?? 0,
            total_sales_qty: o.summary?.total_sales_qty ?? 0,
            purchase_packs: o.summary?.purchase_packs ?? 0,
            purchase_units: o.summary?.purchase_units ?? 0,
            rmd_pct: o.summary?.rmd_pct ?? 0,
          });
        }
      }

      // 2. Generic / raw_sheets fallback (e.g. matrix Excel with OUTLET NAME | VEG BURGER | COFFEE 25 ...)
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
              low.includes('store')
            );
          });
          if (outletColIdx === -1) outletColIdx = 0;

          for (const row of rows) {
            const rawName = String(row[outletColIdx] ?? '').trim();
            if (!rawName || isTotalLabel(rawName)) continue;
            // Skip purely numeric first cells
            if (/^[\d.,\-%]+$/.test(rawName)) continue;

            const key = normalizeStr(rawName);
            if (!key) continue;

            const rawMetrics: Array<{ label: string; value: string }> = [];
            let rowSum = 0;
            headers.forEach((h, cIdx) => {
              if (cIdx === outletColIdx) return;
              const val = String(row[cIdx] ?? '').trim();
              if (h || val) {
                rawMetrics.push({ label: h || `Col ${cIdx + 1}`, value: val || '0' });
                const num = parseFloat(val.replace(/,/g, ''));
                if (!isNaN(num)) rowSum += num;
              }
            });

            if (!byKey.has(key)) {
              byKey.set(key, {
                outlet: rawName,
                source: 'excel',
                individual_sales: rowSum,
                combo_sales: 0,
                total_sales_qty: rowSum,
                purchase_packs: 0,
                purchase_units: 0,
                rmd_pct: 0,
                rawMetrics,
              });
            }
          }
        }
      }
    }

    // 3. Merge DB outlets (don't overwrite Excel rows, just add DB metadata or missing outlets)
    for (const dbo of dbOutlets) {
      const key = normalizeStr(dbo.outlet);
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

  // Fuzzy search results across outlet name, code, city, and aliases
  const searchResults = useMemo<Array<OutletRow & { score: number }>>(() => {
    const q = query.trim();
    if (!q) return allOutlets.map((o) => ({ ...o, score: 100 }));
    return allOutlets
      .map((o) => {
        let best = fuzzyScore(q, o.outlet);
        if (o.code) best = Math.max(best, fuzzyScore(q, o.code));
        if (o.city) best = Math.max(best, fuzzyScore(q, o.city));
        if (o.aliases) {
          for (const a of o.aliases) {
            best = Math.max(best, fuzzyScore(q, a));
          }
        }
        return { ...o, score: best };
      })
      .filter((o) => o.score >= 55)
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

  const handleSelectRow = (o: OutletRow) => {
    if (o.source === 'database' && o.dbId && onSelectOutlet && !o.rawMetrics) {
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
          Search any outlet by name, short form, or spelling — works with uploaded Excel/CSV files and saved database outlets.
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
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {searchResults.slice(0, 40).map((o, idx) => (
                  <button
                    key={o.outlet + idx}
                    onClick={() => handleSelectRow(o)}
                    className={`w-full text-left p-3.5 flex items-center justify-between hover:bg-blue-50/60 transition-colors ${
                      selectedOutlet?.outlet === o.outlet ? 'bg-blue-50 border-l-2 border-blue-500' : ''
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
                              <FileSpreadsheet className="w-3 h-3" /> From Uploaded File
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
              Supports .xlsx .xlsm .xls .csv — files uploaded in Excel Upload & Viewer also appear here automatically
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
            <div className="flex items-center gap-2">
              {selectedOutlet.dbId && onSelectOutlet && (
                <button
                  onClick={() => onSelectOutlet(selectedOutlet.dbId!)}
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

          {selectedOutlet.rawMetrics && selectedOutlet.rawMetrics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {selectedOutlet.rawMetrics.map((m, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold text-slate-500 truncate">{m.label}</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">{m.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Individual Sales" value={selectedOutlet.individual_sales} color="blue" />
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Combo Sales" value={selectedOutlet.combo_sales} color="indigo" />
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Sales Qty" value={selectedOutlet.total_sales_qty} color="emerald" />
              <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Packs" value={selectedOutlet.purchase_packs} color="amber" />
              <StatCard icon={<Package className="w-4 h-4" />} label="Purchase Units" value={selectedOutlet.purchase_units} color="orange" />
              <StatCard icon={<Percent className="w-4 h-4" />} label="RMD %" value={`${selectedOutlet.rmd_pct.toFixed(2)}%`} color="rose" />
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
