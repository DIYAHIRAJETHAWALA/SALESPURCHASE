import React from 'react';
import { OutletSearchBar } from '../components/OutletSearchBar';
import { Store, Search, HelpCircle, ArrowRight } from 'lucide-react';

interface OutletSearchPageProps {
  onSelectOutlet: (outletId: number) => void;
}

export const OutletSearchPage: React.FC<OutletSearchPageProps> = ({ onSelectOutlet }) => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-3 pt-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
          <Search className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Outlet Search & Analytics
        </h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto">
          Type an outlet name, location, code, or alias to immediately view comprehensive Sales and Purchase analytics.
        </p>
      </div>

      {/* Prominent Search Bar */}
      <div className="max-w-2xl mx-auto shadow-lg rounded-xl">
        <OutletSearchBar
          onSelectOutlet={onSelectOutlet}
          size="large"
          autoFocus
          placeholder="Search by outlet name e.g. Bandra, Adajan, Nanpura..."
        />
      </div>

      {/* Matching Guidance & Sample Queries */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-2xl mx-auto">
        <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-3">
          <SparkleIcon className="w-4 h-4 text-blue-600" />
          <span>Smart Fuzzy Matching System Active</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          The system automatically normalizes location names, removes punctuation, ignores case differences, and resolves aliases permanently.
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-2">Example search patterns resolved:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">"Bandra" / "Bandra Mumbai"</span>
              <span className="text-emerald-600 font-semibold text-[11px]">→ Bandra Outlet</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">"Adajan" / "OUT-012"</span>
              <span className="text-emerald-600 font-semibold text-[11px]">→ Adajan Outlet</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">"Nanpura" / "NANAPURA"</span>
              <span className="text-emerald-600 font-semibold text-[11px]">→ Nanpura Outlet</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">"LP Savani" / "L P Savani"</span>
              <span className="text-emerald-600 font-semibold text-[11px]">→ L P Savani Outlet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);
