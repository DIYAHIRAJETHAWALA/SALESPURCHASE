import React, { useState, useRef } from 'react';
import {
  UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2,
  FileCheck, ArrowRight, RefreshCw, Sparkles, Store, Plus
} from 'lucide-react';
import { uploadAndPreview, commitImport, fetchOutletsList } from '../api';
import { PreviewResponse, Outlet, CommitMapping } from '../types';

interface UploadPageProps {
  reportType: 'sales' | 'purchase';
  onNavigateToOutlet?: (outletId: number) => void;
  onNavigateToHistory?: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({
  reportType,
  onNavigateToOutlet,
  onNavigateToHistory
}) => {
  const isSales = reportType === 'sales';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);

  // User confirmed mappings state
  const [mappings, setMappings] = useState<{ [rawName: string]: CommitMapping }>({});
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importSuccess, setImportSuccess] = useState<any | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);
    setPreview(null);
    setImportSuccess(null);

    // Run preview immediately
    try {
      setLoadingPreview(true);
      const [prevData, outletsList] = await Promise.all([
        uploadAndPreview(selectedFile, reportType),
        fetchOutletsList()
      ]);
      setPreview(prevData);
      setAllOutlets(outletsList);

      // Pre-populate mapping choices from predictions
      const initialMap: { [rawName: string]: CommitMapping } = {};
      prevData.outlet_predictions.forEach(p => {
        initialMap[p.raw_name] = {
          raw_name: p.raw_name,
          outlet_id: p.matched_outlet_id,
          create_new: !p.matched_outlet_id,
          new_outlet_name: p.matched_outlet_name || p.raw_name.replace(/[()]/g, '').trim(),
        };
      });
      setMappings(initialMap);

      if (prevData.is_duplicate) {
        setImportMode('replace');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse file preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;

    try {
      setLoadingCommit(true);
      setErrorMsg(null);

      const confirmedList = Object.values(mappings);

      const res = await commitImport({
        file_hash: preview.file_hash,
        report_type: reportType,
        filename: preview.filename,
        sheet_name: preview.sheet_name,
        parser_type: preview.parser_used,
        mode: importMode,
        replace_batch_id: preview.existing_batch_id,
        confirmed_mappings: confirmedList,
      });

      setImportSuccess(res);
      setPreview(null);
      setFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit import');
    } finally {
      setLoadingCommit(false);
    }
  };

  const updateMapping = (rawName: string, updates: Partial<CommitMapping>) => {
    setMappings(prev => ({
      ...prev,
      [rawName]: {
        ...prev[rawName],
        ...updates
      }
    }));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
              isSales ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
            }`}>
              {isSales ? 'Sales Ingestion' : 'Purchase Ingestion'}
            </span>
            <span className="text-slate-400 text-xs">• Isolated Dataset</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {isSales ? 'Upload Sales Report' : 'Upload Purchase Report'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supports XLSX, XLS, and CSV reports with automatic matrix and tabular format detection.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {importSuccess && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{importSuccess.message}</span>
          </div>
          <p className="text-xs text-emerald-700">
            Batch ID: <span className="font-mono font-bold">{importSuccess.batch_id}</span> | Total Imported: {importSuccess.total_imported.toLocaleString()} records | Total Value: ₹{importSuccess.total_amount.toLocaleString()}
          </p>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={() => { setImportSuccess(null); }}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
            >
              Upload Another Report
            </button>
            {onNavigateToHistory && (
              <button
                onClick={onNavigateToHistory}
                className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-100"
              >
                View in Import History
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Box */}
      {!preview && !importSuccess && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isSales
              ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40 hover:border-emerald-500'
              : 'border-purple-300 bg-purple-50/20 hover:bg-purple-50/40 hover:border-purple-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
            isSales ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
          }`}>
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-slate-800">
            {loadingPreview ? 'Analyzing file structure...' : `Drag and drop your ${isSales ? 'Sales' : 'Purchase'} file here`}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            or click to browse from your computer (.xlsx, .xls, .csv)
          </p>

          <div className="flex items-center justify-center space-x-4 mt-6 text-[11px] text-slate-400 font-medium">
            <span>• Multi-sheet Excel support</span>
            <span>• Auto header & metadata detection</span>
            <span>• Smart fuzzy outlet matching</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <div className="space-y-6">
          {/* Duplicate Warning */}
          {preview.is_duplicate && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Notice: This exact file has already been imported previously (Batch: {preview.existing_batch_id}).</span>
              </div>
              <p className="text-xs text-amber-800">
                To prevent accidental double-counting, please choose how to handle this import:
              </p>
              <div className="flex items-center space-x-3 pt-1">
                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  <span>Replace previous batch (Recommended)</span>
                </label>
                <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                  />
                  <span>Append as new batch</span>
                </label>
              </div>
            </div>
          )}

          {/* Import Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Rows</p>
              <h4 className="text-xl font-bold text-slate-900 mt-1">{preview.total_records.toLocaleString()}</h4>
              <p className="text-[11px] text-slate-400">Parsed items</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Outlets</p>
              <h4 className="text-xl font-bold text-slate-900 mt-1">{preview.outlets_count}</h4>
              <p className="text-[11px] text-slate-400">Locations found</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Total Value</p>
              <h4 className="text-xl font-bold text-slate-900 mt-1">₹{preview.total_amount.toLocaleString()}</h4>
              <p className="text-[11px] text-slate-400">Total amount</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Date Span</p>
              <h4 className="text-sm font-bold text-slate-900 mt-2">
                {preview.start_date ? `${preview.start_date} to ${preview.end_date}` : 'Report Date N/A'}
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">{preview.parser_used}</p>
            </div>
          </div>

          {/* Smart Outlet Mapping Confirmation Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Smart Outlet Name Mapping</h3>
                <p className="text-xs text-slate-500">
                  Verify or modify how raw outlet names in this file map to official franchise outlets.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {preview.outlet_predictions.length} outlets detected
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/60 sticky top-0 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Raw Name in File</th>
                    <th className="py-2.5 px-4">Matching Confidence</th>
                    <th className="py-2.5 px-4">Map To Target Outlet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.outlet_predictions.map((pred) => {
                    const currentMap = mappings[pred.raw_name] || {};
                    return (
                      <tr key={pred.raw_name} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                          {pred.raw_name}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pred.confidence >= 95
                                ? 'bg-emerald-100 text-emerald-800'
                                : pred.confidence >= 65
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {pred.confidence}%
                            </span>
                            <span className="text-[11px] text-slate-400">{pred.reason}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-4">
                          <select
                            value={currentMap.create_new ? 'CREATE_NEW' : (currentMap.outlet_id || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'CREATE_NEW') {
                                updateMapping(pred.raw_name, {
                                  create_new: true,
                                  outlet_id: undefined,
                                  new_outlet_name: pred.raw_name.replace(/[()]/g, '').trim()
                                });
                              } else {
                                updateMapping(pred.raw_name, {
                                  create_new: false,
                                  outlet_id: parseInt(val, 10)
                                });
                              }
                            }}
                            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs outline-none focus:border-blue-500 font-medium text-slate-800"
                          >
                            <option value="CREATE_NEW">+ Create As New Official Outlet</option>
                            <optgroup label="Existing Outlets">
                              {allOutlets.map(o => (
                                <option key={o.id} value={o.id}>
                                  {o.official_name} {o.code ? `(${o.code})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Data Rows Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              Sample Records Preview (First 15 Rows)
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2 px-3">Outlet</th>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.sample_records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-800">{r.outlet_raw}</td>
                      <td className="py-2 px-3 text-slate-700">{r.item_raw}</td>
                      <td className="py-2 px-3 text-right font-medium text-slate-700">{r.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {r.unit_price ? `₹${r.unit_price.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Cancel & Pick Another File
            </button>

            <button
              onClick={handleCommit}
              disabled={loadingCommit}
              className={`px-6 py-2.5 rounded-lg text-white font-bold text-xs flex items-center space-x-2 shadow-md transition-all ${
                isSales ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'
              } disabled:opacity-50`}
            >
              {loadingCommit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Committing Data to Database...</span>
                </>
              ) : (
                <>
                  <span>Save {isSales ? 'Sales' : 'Purchase'} Report to Database</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
