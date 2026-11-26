import React, { useState } from 'react';
import { Eye, FileSpreadsheet, Search, ShoppingBag, TrendingUp } from 'lucide-react';

type ReportType = 'sales' | 'purchase';

interface OutletSummary {
  name: string;
  item_count: number;
  sales_quantity: number;
  sales_amount: number | null;
  purchase_quantity: number;
  purchase_amount: number | null;
  purchase_amount_estimated: boolean;
}

interface DisplayTableRow {
  key: string;
  values: Array<string | number | null>;
  purchaseAmountEstimated: boolean;
}

interface CombinedRow {
  outlet: string;
  item: string;
  sales_quantity: number;
  sales_amount: number | null;
  purchase_quantity: number;
  purchase_amount: number | null;
  purchase_amount_estimated: boolean;
}

type TableMode = 'all' | 'master' | 'outlet';
const PAGE_SIZE = 100;
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.csv'];

export function CombinedUploadPage() {
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [combinedRows, setCombinedRows] = useState<CombinedRow[]>([]);
  const [tableMode, setTableMode] = useState<TableMode | null>(null);
  const [outletSearch, setOutletSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const selectFile = (type: ReportType, file?: File) => {
    setError(null);
    setResultMessage(null);
    setOutlets([]);
    setSelectedOutlet('');
    setCombinedRows([]);
    setTableMode(null);
    setOutletSearch('');
    setTableSearch('');
    setTablePage(0);
    if (file && !ACCEPTED_EXTENSIONS.some(extension => file.name.toLowerCase().endsWith(extension))) {
      setError(`${type === 'sales' ? 'Sales' : 'Purchase'} file must be .xlsx, .xlsm, .xls, or .csv.`);
      if (type === 'sales') setSalesFile(null);
      else setPurchaseFile(null);
      return;
    }
    if (type === 'sales') setSalesFile(file ?? null);
    else setPurchaseFile(file ?? null);
  };

  const createUploadBody = () => {
    if (!salesFile || !purchaseFile) return null;
    const body = new FormData();
    body.append('sales_file', salesFile);
    body.append('purchase_file', purchaseFile);
    return body;
  };

  const findOutlets = async () => {
    if (!salesFile || !purchaseFile) return;

    setIsLoading(true);
    setError(null);
    setResultMessage(null);

    try {
      const body = createUploadBody();
      if (!body) return;
      const response = await fetch('/api/combined/preview', { method: 'POST', body });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail || 'Could not read the uploaded reports.');
      }

      const result: { outlets: OutletSummary[]; total_rows: number; rows: CombinedRow[] } = await response.json();
      setOutlets(result.outlets);
      setCombinedRows(result.rows);
      setTableMode(null);
      setOutletSearch('');
      setTableSearch('');
      setTablePage(0);
      setSelectedOutlet(current => result.outlets.some(outlet => outlet.name === current)
        ? current
        : result.outlets[0]?.name ?? '');
      setResultMessage(
        `Found ${result.outlets.length.toLocaleString()} outlets and ${result.total_rows.toLocaleString()} outlet/item rows.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read the uploaded reports.');
    } finally {
      setIsLoading(false);
    }
  };

  const showTable = (mode: TableMode) => {
    if (mode === 'outlet' && !selectedOutlet) return;
    setResultMessage(null);
    setTablePage(0);
    setTableMode(mode);
  };

  const selectedOutletRows = combinedRows.filter(row => row.outlet === selectedOutlet);
  const displayRows = tableMode === 'outlet'
    ? selectedOutletRows
    : tableMode === 'all'
      ? combinedRows
      : [];
  const activeOutlet = outlets.find(outlet => outlet.name === selectedOutlet);
  const masterRows = outlets;
  const tableHeaders = tableMode === 'master'
    ? ['Outlet', 'Item Count', 'Sales Quantity', 'Sales Amount', 'Purchase Quantity', 'Purchase Amount (estimated where marked)']
    : ['Outlet', 'Recipe Item', 'Sales Quantity', 'Sales Amount', 'Purchase Quantity', 'Purchase Amount (estimated where marked)'];
  const visibleRows: DisplayTableRow[] = tableMode === 'master'
    ? masterRows.map(row => ({
        key: row.name,
        purchaseAmountEstimated: row.purchase_amount_estimated,
        values: [
          row.name,
          row.item_count,
          row.sales_quantity,
          row.sales_amount,
          row.purchase_quantity,
          row.purchase_amount,
        ],
      }))
    : displayRows.map((row, index) => ({
        key: `${row.outlet}-${row.item}-${index}`,
        purchaseAmountEstimated: row.purchase_amount_estimated,
        values: [
          row.outlet,
          row.item,
          row.sales_quantity,
          row.sales_amount,
          row.purchase_quantity,
          row.purchase_amount,
        ],
      }));
  const filteredOutlets = outlets.filter(outlet =>
    outlet.name.toLocaleLowerCase().includes(outletSearch.trim().toLocaleLowerCase()),
  );
  const filteredVisibleRows = visibleRows.filter(row =>
    !tableSearch.trim() || row.values.some(value =>
      String(value ?? '').toLocaleLowerCase().includes(tableSearch.trim().toLocaleLowerCase()),
    ),
  );
  const pageCount = Math.max(1, Math.ceil(filteredVisibleRows.length / PAGE_SIZE));
  const pageRows = filteredVisibleRows.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
  const uploadCard = (
    type: ReportType,
    title: string,
    description: string,
    file: File | null,
    onChange: (file?: File) => void,
  ) => {
    const Icon = type === 'sales' ? TrendingUp : ShoppingBag;
    return (
      <label className="block cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md">
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          className="sr-only"
          onChange={event => onChange(event.target.files?.[0])}
        />
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-3 ${type === 'sales' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
            <p className="mt-5 truncate text-sm font-medium text-blue-700">
              {file ? file.name : 'Choose an Excel or CSV file'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '.xlsx, .xlsm, .xls, or .csv'}
            </p>
          </div>
        </div>
      </label>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <FileSpreadsheet className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales &amp; Purchase Analytics</h1>
          <p className="mt-2 text-slate-500">
            Upload both outlet reports to view combined sales and purchase data with item-level reconciliation.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.open('/api/exports/category-analysis-excel', '_blank')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Download 10-Sheet Category Analysis Workbook (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => window.open('/api/exports/master-merged-excel', '_blank')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Download Master Merged Workbook (.xlsx)
            </button>
          </div>
        </header>

        <section className="grid gap-5 sm:grid-cols-2" aria-label="Upload sales and purchase reports">
          {uploadCard(
            'sales',
            'Sales report file',
            'Select the outlet sales report.',
            salesFile,
            file => selectFile('sales', file),
          )}
          {uploadCard(
            'purchase',
            'Purchase report file',
            'Select the outlet purchase report.',
            purchaseFile,
            file => selectFile('purchase', file),
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h2 className="text-sm font-semibold text-slate-800">Combined table columns</h2>
          <p className="mt-1 text-sm text-slate-600">
            One row per outlet and recipe item, with sales and purchase quantities and amounts when provided by the source files.
          </p>
        </section>

        {outlets.length > 0 && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="View all outlet reports">
              <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-900">Whole outlets — item details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Show item-level sales and purchase rows for every outlet.
                </p>
                <button
                  type="button"
                  onClick={() => showTable('all')}
                  disabled={isLoading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Show whole outlets
                </button>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-900">Master outlets — summary</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Show one row per outlet with sales and purchase totals and item count.
                </p>
                <button
                  type="button"
                  onClick={() => showTable('master')}
                  disabled={isLoading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Show master summary
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm" aria-label="View a single outlet report">
              <label htmlFor="outlet-select" className="block text-sm font-semibold text-slate-800">
                Normal outlet — item details
              </label>
              <p className="mt-1 text-sm text-slate-500">
                Choose one outlet, such as Shiv Shakti, to show only its sales and purchase rows.
              </p>
              <label htmlFor="outlet-search" className="sr-only">Search outlets</label>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="outlet-search"
                  type="search"
                  value={outletSearch}
                  onChange={event => setOutletSearch(event.target.value)}
                  placeholder="Search outlet name..."
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {filteredOutlets.length} of {outlets.length} outlets match
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <select
                  id="outlet-select"
                  value={selectedOutlet}
                  onChange={event => setSelectedOutlet(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {activeOutlet && !filteredOutlets.some(outlet => outlet.name === selectedOutlet) && (
                    <option value={selectedOutlet}>
                      {activeOutlet.name} ({activeOutlet.item_count} items)
                    </option>
                  )}
                  {filteredOutlets.map(outlet => (
                    <option key={outlet.name} value={outlet.name}>
                      {outlet.name} ({outlet.item_count} items)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => showTable('outlet')}
                  disabled={!selectedOutlet || isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Show this outlet
                </button>
              </div>
              {selectedOutlet && (
                <p className="mt-3 text-xs text-slate-500">
                  Sales: {activeOutlet?.sales_quantity.toLocaleString()} qty
                  {activeOutlet?.sales_amount !== null
                    ? ` · Amount ${activeOutlet?.sales_amount?.toLocaleString()}`
                    : ''}
                  {' · '}
                  Purchase: {activeOutlet?.purchase_quantity.toLocaleString()} qty
                  {activeOutlet?.purchase_amount !== null
                    ? ` · Amount ${activeOutlet?.purchase_amount?.toLocaleString()}${activeOutlet?.purchase_amount_estimated ? ' (estimated)' : ''}`
                    : ` · Amount unavailable for some items${activeOutlet?.purchase_amount_estimated ? ' (some estimated)' : ''}`}
                </p>
              )}
            </section>

            <p className="mt-3 text-xs text-slate-500">
              When the purchase file has no amount, the app estimates it as purchase quantity × that same outlet/item’s sales unit price. Estimated amounts are marked; amounts with no matching sales price remain unavailable.
            </p>

            {tableMode && (
              <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Sales and purchase results">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="font-semibold text-slate-900">
                    {tableMode === 'master'
                      ? 'Master outlet summary'
                      : tableMode === 'outlet'
                        ? `${selectedOutlet} sales & purchase`
                        : 'All outlets sales & purchase'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredVisibleRows.length.toLocaleString()} {tableMode === 'master' ? 'outlets' : 'outlet/item rows'}
                    {tableSearch.trim() ? ' match your search' : ' in this view'}.
                  </p>
                  <label htmlFor="table-search" className="sr-only">Search table rows</label>
                  <div className="relative mt-3 max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="table-search"
                      type="search"
                      value={tableSearch}
                      onChange={event => {
                        setTableSearch(event.target.value);
                        setTablePage(0);
                      }}
                      placeholder="Filter by outlet or recipe item..."
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                <div className="max-h-[65vh] overflow-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        {tableHeaders.map(header => (
                          <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageRows.map(row => (
                        <tr key={row.key} className="hover:bg-blue-50/50">
                          {row.values.map((value, cellIndex) => (
                            <td key={cellIndex} className={`whitespace-nowrap px-4 py-2.5 ${cellIndex < 2 ? 'text-slate-800' : 'text-right tabular-nums text-slate-600'}`}>
                              {value === null
                                ? 'Not estimated (no matching sales price)'
                                : typeof value === 'number'
                                  ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${cellIndex === 5 && row.purchaseAmountEstimated ? ' (est.)' : ''}`
                                  : value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
                  <p className="text-xs text-slate-500">
                    Page {tablePage + 1} of {pageCount} · Showing {pageRows.length} rows
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTablePage(page => Math.max(0, page - 1))}
                      disabled={tablePage === 0}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setTablePage(page => Math.min(pageCount - 1, page + 1))}
                      disabled={tablePage >= pageCount - 1}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </p>
        )}
        {resultMessage && (
          <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {resultMessage}
          </p>
        )}

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={findOutlets}
            disabled={!salesFile || !purchaseFile || isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Eye className="h-5 w-5" aria-hidden="true" />
            {isLoading ? 'Reading outlet reports...' : outlets.length ? 'Refresh outlet list' : 'Find outlets'}
          </button>
        </div>
      </div>
    </main>
  );
}
