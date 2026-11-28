import React from 'react';
import {
  Search,
  FileSpreadsheet,
  TableProperties,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  unmatchedCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'category_upload', label: 'Excel Upload & Viewer', icon: FileSpreadsheet, highlight: true },
    { id: 'master_merged', label: 'Merged S&P Table', icon: TableProperties },
    { id: 'outlet_search', label: 'Outlet Search', icon: Search },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 min-h-screen select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
          SP
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-none">
            FRANCHISE<span className="text-blue-400">PRO</span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Sales & Purchase BI
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-slate-400 px-3 pt-2 pb-2 tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <div className="text-xs">
            <p className="text-slate-300 font-medium">Local Analytics Ready</p>
            <p className="text-slate-400 text-[11px]">Upload Excel to inspect</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
