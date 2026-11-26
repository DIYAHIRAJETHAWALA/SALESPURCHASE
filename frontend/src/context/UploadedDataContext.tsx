import React, { createContext, useContext, useState } from 'react';

export interface ItemRow {
  name: string;
  size: string;
  menu_ref: string;
  individual_sales: number;
  combo_sales: number;
  sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  rmd_pct: number;
  size_breakdown: Record<string, number>;
}

export interface OutletSummary {
  individual_sales: number;
  combo_sales: number;
  total_sales_qty: number;
  purchase_packs: number;
  purchase_units: number;
  rmd_pct: number;
  size_breakdown: Record<string, number>;
}

export interface OutletData {
  outlet: string;
  summary: OutletSummary;
  items: ItemRow[];
}

export interface RawSheet {
  sheet_name: string;
  headers: string[];
  rows: string[][];
}

export interface UploadResult {
  mode?: string;
  report_type?: string;
  category: string;
  filename: string;
  period_label: string;
  start_date: string;
  end_date: string;
  week_label: string;
  month_label: string;
  size_headers: string[];
  outlets: OutletData[];
  raw_sheets?: RawSheet[];
}

interface UploadedDataContextValue {
  datasets: UploadResult[];
  setDatasets: React.Dispatch<React.SetStateAction<UploadResult[]>>;
}

const UploadedDataContext = createContext<UploadedDataContextValue | undefined>(undefined);

export const UploadedDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [datasets, setDatasets] = useState<UploadResult[]>([]);
  return (
    <UploadedDataContext.Provider value={{ datasets, setDatasets }}>
      {children}
    </UploadedDataContext.Provider>
  );
};

export function useUploadedData(): UploadedDataContextValue {
  const ctx = useContext(UploadedDataContext);
  if (!ctx) {
    throw new Error('useUploadedData must be used within UploadedDataProvider');
  }
  return ctx;
}
