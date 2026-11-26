import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIBoxProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'purple' | 'amber' | 'slate';
  badge?: {
    text: string;
    isPositive?: boolean;
    isNegative?: boolean;
  };
}

export const KPIBox: React.FC<KPIBoxProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  badge
}) => {
  const variantStyles = {
    blue: {
      bg: 'bg-white',
      border: 'border-slate-200',
      iconBg: 'bg-blue-50 text-blue-600',
      text: 'text-slate-900',
    },
    emerald: {
      bg: 'bg-white',
      border: 'border-slate-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      text: 'text-slate-900',
    },
    purple: {
      bg: 'bg-white',
      border: 'border-slate-200',
      iconBg: 'bg-purple-50 text-purple-600',
      text: 'text-slate-900',
    },
    amber: {
      bg: 'bg-white',
      border: 'border-slate-200',
      iconBg: 'bg-amber-50 text-amber-600',
      text: 'text-slate-900',
    },
    slate: {
      bg: 'bg-white',
      border: 'border-slate-200',
      iconBg: 'bg-slate-100 text-slate-700',
      text: 'text-slate-900',
    }
  };

  const style = variantStyles[variant];

  return (
    <div className={`p-5 rounded-xl border ${style.border} ${style.bg} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${style.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline space-x-2">
        <h3 className={`text-2xl font-bold tracking-tight ${style.text}`}>
          {value}
        </h3>
        {badge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            badge.isPositive
              ? 'bg-emerald-100 text-emerald-800'
              : badge.isNegative
              ? 'bg-rose-100 text-rose-800'
              : 'bg-slate-100 text-slate-700'
          }`}>
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-slate-500 mt-1 font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
};
