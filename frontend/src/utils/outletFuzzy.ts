import { UploadResult } from '../context/UploadedDataContext';

export function normalizeOutletStr(s: string): string {
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

export function fuzzyOutletScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const q = normalizeOutletStr(query);
  const t = normalizeOutletStr(text);
  if (!q || !t) return 0;

  if (q === t) return 100;
  if (t.includes(q)) return 92;

  const qCompact = q.replace(/\s/g, '');
  const tCompact = t.replace(/\s/g, '');
  if (tCompact.includes(qCompact)) return 88;

  const qWords = q.split(' ').filter(Boolean);
  const tWords = t.split(' ').filter(Boolean);

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

  const firstLetters = tWords.map((w) => w[0]).join('');
  if (firstLetters.includes(qCompact)) return 78;

  let qi = 0;
  for (let ti = 0; ti < tCompact.length && qi < qCompact.length; ti++) {
    if (tCompact[ti] === qCompact[qi]) qi++;
  }
  if (qi === qCompact.length && qCompact.length >= 2) {
    return 68;
  }

  return 0;
}

export function isTotalRowLabel(name: string): boolean {
  const low = name.trim().toLowerCase();
  return (
    !low ||
    low === 'total' ||
    low === 'grand total' ||
    low.startsWith('total ') ||
    low.startsWith('grand total')
  );
}

export interface ExtractedExcelOutlet {
  outlet: string;
  sales_qty: number;
  purchase_qty: number;
  rmd_pct: number;
}

export function extractOutletsFromDatasets(datasets: UploadResult[]): ExtractedExcelOutlet[] {
  const byKey = new Map<string, ExtractedExcelOutlet>();

  for (const ds of datasets) {
    for (const o of ds.outlets || []) {
      const key = normalizeOutletStr(o.outlet);
      if (!key || isTotalRowLabel(o.outlet)) continue;
      const existing = byKey.get(key);
      const sq = o.summary?.total_sales_qty ?? 0;
      const pq = o.summary?.purchase_units ?? 0;
      if (existing) {
        existing.sales_qty += sq;
        existing.purchase_qty += pq;
        existing.rmd_pct = existing.purchase_qty > 0 ? Math.round((existing.sales_qty / existing.purchase_qty) * 10000) / 100 : 0;
      } else {
        byKey.set(key, {
          outlet: o.outlet,
          sales_qty: sq,
          purchase_qty: pq,
          rmd_pct: o.summary?.rmd_pct ?? 0,
        });
      }
    }

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
          if (!rawName || isTotalRowLabel(rawName) || /^[\d.,\-%]+$/.test(rawName)) continue;
          const key = normalizeOutletStr(rawName);
          if (!key) continue;

          let rowSum = 0;
          headers.forEach((_, cIdx) => {
            if (cIdx === outletColIdx) return;
            const num = parseFloat(String(row[cIdx] ?? '').replace(/,/g, ''));
            if (!isNaN(num)) rowSum += num;
          });

          if (!byKey.has(key)) {
            byKey.set(key, {
              outlet: rawName,
              sales_qty: rowSum,
              purchase_qty: 0,
              rmd_pct: 0,
            });
          }
        }
      }
    }
  }

  return Array.from(byKey.values());
}
