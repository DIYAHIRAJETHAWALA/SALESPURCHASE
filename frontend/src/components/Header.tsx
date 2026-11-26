import React from 'react';
import { OutletSearchBar } from './OutletSearchBar';
import { Store, Bell, HelpCircle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onSelectOutlet: (outletId: number) => void;
  showSearchBar?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onSelectOutlet,
  showSearchBar = true,
}) => {
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {showSearchBar && (
        <div className="w-96 max-w-lg mx-6">
          <OutletSearchBar onSelectOutlet={onSelectOutlet} />
        </div>
      )}

      <div className="flex items-center space-x-3 text-slate-500">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-slate-800">Franchise HQ</p>
          <p className="text-[11px] text-slate-400">Offline Local System</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-blue-600 text-xs">
          HQ
        </div>
      </div>
    </header>
  );
};
