import React, { useEffect, useState } from 'react';
import {
  Store, Plus, Edit2, Trash2, GitMerge, Tags,
  MapPin, Check, X, Search, RefreshCw, AlertCircle
} from 'lucide-react';
import {
  fetchOutletsList, createOutlet, updateOutlet,
  deleteOutlet, mergeOutlets, deleteAlias
} from '../api';
import { Outlet } from '../types';

export const OutletMasterPage: React.FC = () => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Outlet | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showAliasesModal, setShowAliasesModal] = useState<Outlet | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newAliases, setNewAliases] = useState('');

  const [mergeSourceId, setMergeSourceId] = useState<number | ''>('');
  const [mergeTargetId, setMergeTargetId] = useState<number | ''>('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadOutlets();
  }, [search]);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      const data = await fetchOutletsList(search);
      setOutlets(data);
    } catch (err) {
      console.error('Failed to load outlets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const aliasList = newAliases.split(',').map(s => s.trim()).filter(Boolean);
      await createOutlet({
        official_name: newName.trim(),
        code: newCode.trim() || undefined,
        city: newCity.trim() || undefined,
        state: newState.trim() || undefined,
        aliases: aliasList.length > 0 ? aliasList : undefined
      });
      setShowCreateModal(false);
      setNewName('');
      setNewCode('');
      setNewCity('');
      setNewState('');
      setNewAliases('');
      setActionMsg({ type: 'success', text: 'New outlet created successfully' });
      loadOutlets();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to create outlet' });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    try {
      await updateOutlet(showEditModal.id, {
        official_name: showEditModal.official_name,
        code: showEditModal.code,
        city: showEditModal.city,
        state: showEditModal.state,
        is_active: showEditModal.is_active
      });
      setShowEditModal(null);
      setActionMsg({ type: 'success', text: 'Outlet updated successfully' });
      loadOutlets();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to update outlet' });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete outlet '${name}'? This will also remove associated aliases.`)) return;

    try {
      await deleteOutlet(id);
      setActionMsg({ type: 'success', text: `Outlet '${name}' deleted` });
      loadOutlets();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to delete outlet' });
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) return;
    if (mergeSourceId === mergeTargetId) {
      alert('Source and target outlet must be different.');
      return;
    }

    try {
      await mergeOutlets(Number(mergeSourceId), Number(mergeTargetId));
      setShowMergeModal(false);
      setMergeSourceId('');
      setMergeTargetId('');
      setActionMsg({ type: 'success', text: 'Outlets merged successfully' });
      loadOutlets();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to merge outlets' });
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    try {
      await deleteAlias(aliasId);
      if (showAliasesModal) {
        setShowAliasesModal({
          ...showAliasesModal,
          aliases: showAliasesModal.aliases.filter(a => a.id !== aliasId)
        });
      }
      loadOutlets();
    } catch (err: any) {
      alert('Failed to delete alias');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Outlet Master Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain official outlet records, codes, cities, and confirmed alias mappings
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <GitMerge className="w-4 h-4" />
            <span>Merge Outlets</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Outlet</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
          actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Filter outlets by name, code or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs outline-none bg-transparent"
        />
      </div>

      {/* Outlets Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Official Name</th>
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">City / State</th>
              <th className="py-3 px-4">Aliases</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">Loading master records...</td>
              </tr>
            ) : outlets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">No outlets registered. Click "Add New Outlet" to start.</td>
              </tr>
            ) : (
              outlets.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">#{o.id}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                    <Store className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>{o.official_name}</span>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                    {o.code || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {o.city || 'Gujarat'}{o.state ? `, ${o.state}` : ''}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setShowAliasesModal(o)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    >
                      {o.aliases?.length || 0} Aliases
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {o.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setShowEditModal(o)}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Edit outlet"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id, o.official_name)}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded"
                        title="Delete outlet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add New Franchise Outlet</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Outlet Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. BANDRA - MUMBAI CENTRAL"
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Outlet Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. OUT-099"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Surat / Mumbai"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Known Aliases (Comma separated)</label>
                <input
                  type="text"
                  value={newAliases}
                  onChange={(e) => setNewAliases(e.target.value)}
                  placeholder="e.g. Bandra, Bandra Outlet, Bandra West"
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Save Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Outlet</h3>
            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Outlet Name *</label>
                <input
                  type="text"
                  required
                  value={showEditModal.official_name}
                  onChange={(e) => setShowEditModal({ ...showEditModal, official_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Outlet Code</label>
                  <input
                    type="text"
                    value={showEditModal.code || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    value={showEditModal.city || ''}
                    onChange={(e) => setShowEditModal({ ...showEditModal, city: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={showEditModal.is_active}
                  onChange={(e) => setShowEditModal({ ...showEditModal, is_active: e.target.checked })}
                />
                <label htmlFor="activeToggle" className="font-semibold text-slate-700">Active Outlet</label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aliases Modal */}
      {showAliasesModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Aliases for {showAliasesModal.official_name}</h3>
                <p className="text-xs text-slate-500">Any report string matching these will auto-link to this outlet</p>
              </div>
              <button onClick={() => setShowAliasesModal(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {showAliasesModal.aliases && showAliasesModal.aliases.length > 0 ? (
                showAliasesModal.aliases.map((a) => (
                  <div key={a.id} className="py-2 flex items-center justify-between">
                    <span className="font-mono text-slate-800">{a.raw_alias}</span>
                    <button
                      onClick={() => handleDeleteAlias(a.id)}
                      className="text-rose-600 hover:text-rose-800 p-1"
                      title="Remove alias"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-slate-400">No aliases registered for this outlet.</p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowAliasesModal(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Outlets Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Merge Outlets</h3>
            <p className="text-xs text-slate-500">
              Transfer all sales, purchase records, and aliases from the source outlet into the target outlet.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Source Outlet (Will be deactivated)</label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">Select source outlet...</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.official_name} (#{o.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Outlet (Master Destination)</label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">Select target outlet...</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.official_name} (#{o.id})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
