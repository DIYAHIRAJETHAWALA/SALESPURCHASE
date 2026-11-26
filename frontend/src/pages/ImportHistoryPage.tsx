import React, { useEffect, useState } from 'react';
import {
  History, Trash2, Calendar, FileText, CheckCircle2,
  RefreshCw, AlertTriangle
} from 'lucide-react';
import { fetchBatches, rollbackBatch } from '../api';
import { ImportBatch } from '../types';

export const ImportHistoryPage: React.FC = () => {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadBatches();
  }, [filterType]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await fetchBatches(filterType || undefined);
      setBatches(res.batches);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (batchId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to rollback batch '${batchId}' (${filename})? This will delete all records imported in this batch.`)) {
      return;
    }

    try {
      const res = await rollbackBatch(batchId);
      setActionMsg({ type: 'success', text: res.message });
      loadBatches();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Rollback failed' });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Import History & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete traceability of uploaded files, hash signatures, record counts, and rollback controls
          </p>
        </div>

        {/* Filter Type */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setFilterType('')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              !filterType ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Batches
          </button>
          <button
            onClick={() => setFilterType('sales')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterType === 'sales' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sales Batches
          </button>
          <button
            onClick={() => setFilterType('purchase')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              filterType === 'purchase' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Batches
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
          actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Parser / Dates</th>
                <th className="py-3 px-4 text-right">Records</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4">Imported At</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading batch logs...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">No import batches found.</td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {b.batch_id}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        b.report_type === 'sales'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {b.report_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {b.filename}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      <p className="font-semibold text-slate-700">{b.parser_used || 'Standard Parser'}</p>
                      <p className="text-[11px] text-slate-400">
                        {b.start_date ? `${b.start_date} to ${b.end_date}` : 'Date Range N/A'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                      {b.total_records.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{b.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(b.created_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleRollback(b.batch_id, b.filename)}
                        className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] border border-rose-200 transition-colors flex items-center space-x-1 mx-auto"
                        title="Delete batch and remove all its records"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
