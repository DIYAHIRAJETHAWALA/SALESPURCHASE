import React, { useEffect, useState } from 'react';
import {
  Settings, Database, Play, Trash2, CheckCircle2,
  AlertTriangle, RefreshCw, Layers, ShieldCheck
} from 'lucide-react';
import { fetchSettingsStats, seedSampleData, resetDatabase } from '../api';

export const SettingsPage: React.FC = () => {
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const data = await fetchSettingsStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSeedSamples = async () => {
    try {
      setLoadingSeed(true);
      setActionMsg(null);
      const res = await seedSampleData();
      setActionMsg({
        type: 'success',
        text: `Sample reports processed: ${res.results.join(' | ')}`
      });
      loadStats();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to seed sample data' });
    } finally {
      setLoadingSeed(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('WARNING: Are you sure you want to wipe all transaction records, outlets, and aliases? This action is irreversible.')) {
      return;
    }

    try {
      setLoadingReset(true);
      setActionMsg(null);
      const res = await resetDatabase();
      setActionMsg({ type: 'success', text: res.message });
      loadStats();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to reset database' });
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          System Settings & Database
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Local SQLite engine configuration, system status, and diagnostic test data management
        </p>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
          actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Database Status Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Local SQLite Storage</h3>
            <p className="text-xs text-slate-500">d:\SPpro\data\franchise_analytics.db</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Outlets</p>
              <p className="text-lg font-bold text-slate-800">{stats.total_outlets} ({stats.active_outlets} active)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Aliases</p>
              <p className="text-lg font-bold text-slate-800">{stats.total_aliases}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Sales Records</p>
              <p className="text-lg font-bold text-slate-800">{stats.total_sales_records.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Purchase Records</p>
              <p className="text-lg font-bold text-slate-800">{stats.total_purchase_records.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sample Data Quick Loader */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Load Sample Datasets with One Click</h3>
            <p className="text-xs text-slate-500">Auto-imports your provided sample reports for immediate exploration</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Automatically imports:
          <br />
          1. <span className="font-mono font-semibold">Location Wise Item Sales Report 20-11-2026 16_42.csv</span> (2,367 Sales records across 49 outlets)
          <br />
          2. <span className="font-mono font-semibold">order-report-From-01-11-2026-to-07-11-2026.xlsx</span> (1,170 Sales records across 45 outlets)
          <br />
          3. Synthetic paired purchase dataset so operational variance and comparisons are visible right away.
        </p>

        <div className="pt-2">
          <button
            onClick={handleSeedSamples}
            disabled={loadingSeed}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-sm transition-all disabled:opacity-50"
          >
            {loadingSeed ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Sample Files...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Load Sample Data Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Factory Reset */}
      <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Reset Database Records</h3>
            <p className="text-xs text-slate-500">Wipe all transactional records and start fresh</p>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          This will delete all sales records, purchase records, outlets, aliases, and import batches from the local SQLite database.
        </p>

        <div className="pt-2">
          <button
            onClick={handleResetData}
            disabled={loadingReset}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            {loadingReset ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Wipe All Records</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
