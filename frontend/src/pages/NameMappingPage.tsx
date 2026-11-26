import React, { useEffect, useState } from 'react';
import {
  Tags, Sparkles, CheckCircle2, AlertCircle,
  Store, Plus, ArrowRight, RefreshCw
} from 'lucide-react';
import { fetchUnmatchedReview, confirmMapping, fetchOutletsList } from '../api';
import { Outlet } from '../types';

export const NameMappingPage: React.FC = () => {
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [unmatchedData, outletsList] = await Promise.all([
        fetchUnmatchedReview(),
        fetchOutletsList()
      ]);
      setUnmatched(unmatchedData);
      setOutlets(outletsList);
    } catch (err) {
      console.error('Failed to load unmatched items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (rawName: string, outletId: number) => {
    try {
      const res = await confirmMapping({
        raw_name: rawName,
        outlet_id: outletId,
        create_new: false,
      });
      setActionMsg({
        type: 'success',
        text: `Mapped '${rawName}' to ${res.official_name}. Backfilled ${res.updated_sales_records} sales & ${res.updated_purchase_records} purchase rows.`
      });
      loadData();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Mapping failed' });
    }
  };

  const handleCreateNew = async (rawName: string) => {
    try {
      const cleanName = rawName.replace(/[()]/g, '').trim();
      const res = await confirmMapping({
        raw_name: rawName,
        create_new: true,
        new_outlet_name: cleanName,
      });
      setActionMsg({
        type: 'success',
        text: `Created new outlet '${res.official_name}' and linked alias '${rawName}'.`
      });
      loadData();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to create new outlet' });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Intelligent Alias Management</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Outlet Mapping & Discrepancy Review
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review and approve raw outlet variations found in uploaded reports. Confirmed mappings apply automatically to past and future imports.
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

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Analyzing unmapped names...
        </div>
      ) : unmatched.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">All Outlet Names Resolved!</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Every transaction record in your Sales and Purchase datasets is accurately linked to an official franchise outlet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-600">
            {unmatched.length} unmapped name{unmatched.length !== 1 ? 's' : ''} require attention:
          </div>

          <div className="space-y-3">
            {unmatched.map((item) => {
              const pred = item.prediction;
              const hasCandidate = pred.candidates && pred.candidates.length > 0;
              const topCand = hasCandidate ? pred.candidates[0] : null;

              return (
                <div key={item.raw_name} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          "{item.raw_name}"
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.sales_records_count} sales, {item.purchase_records_count} purchase rows
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Fuzzy analysis: {pred.reason}
                      </p>
                    </div>

                    {topCand && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Suggested match:</span>
                        <span className="font-bold text-blue-700 text-xs">{topCand.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          {topCand.score}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">Assign to:</span>
                      <select
                        defaultValue={topCand ? topCand.id : ''}
                        id={`select-${item.raw_name}`}
                        className="border border-slate-300 rounded px-2.5 py-1 text-xs outline-none focus:border-blue-500 font-medium"
                      >
                        <option value="">Choose an existing outlet...</option>
                        {outlets.map(o => (
                          <option key={o.id} value={o.id}>{o.official_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const el = document.getElementById(`select-${item.raw_name}`) as HTMLSelectElement;
                          if (el && el.value) {
                            handleConfirm(item.raw_name, Number(el.value));
                          } else {
                            alert('Please select an outlet from the dropdown');
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
                      >
                        Confirm Match
                      </button>
                    </div>

                    <button
                      onClick={() => handleCreateNew(item.raw_name)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                    >
                      + Create as New Outlet
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
