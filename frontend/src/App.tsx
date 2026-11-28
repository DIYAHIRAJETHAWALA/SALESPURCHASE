import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { UploadedDataProvider } from './context/UploadedDataContext';
import { CategoryUploadPage } from './pages/CategoryUploadPage';
import { CombinedUploadPage } from './pages/CombinedUploadPage';
import { MasterMergedPage } from './pages/MasterMergedPage';
import { DashboardPage } from './pages/DashboardPage';
import { OutletSearchPage } from './pages/OutletSearchPage';
import { AllOutletsPage } from './pages/AllOutletsPage';
import { OutletDetailPage } from './pages/OutletDetailPage';
import { UploadPage } from './pages/UploadPage';
import { OutletMasterPage } from './pages/OutletMasterPage';
import { NameMappingPage } from './pages/NameMappingPage';
import { ReportsExportPage } from './pages/ReportsExportPage';
import { ImportHistoryPage } from './pages/ImportHistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>('category_upload');
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null);

  const handleNavigate = (page: string, params?: any) => {
    if (params?.outletId) {
      setSelectedOutletId(params.outletId);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectOutlet = (outletId: number) => {
    setSelectedOutletId(outletId);
    setCurrentPage('outlet_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'category_upload':
        return <CategoryUploadPage />;
      case 'master_merged':
        return <MasterMergedPage onSelectOutlet={handleSelectOutlet} />;
      case 'combined_upload':
        return <CombinedUploadPage />;
      case 'dashboard':
        return <DashboardPage onSelectOutlet={handleSelectOutlet} onNavigate={handleNavigate} />;
      case 'outlet_search':
        return <OutletSearchPage onSelectOutlet={handleSelectOutlet} />;
      case 'all_outlets':
        return <AllOutletsPage onSelectOutlet={handleSelectOutlet} />;
      case 'outlet_detail':
        return selectedOutletId ? (
          <OutletDetailPage outletId={selectedOutletId} onBack={() => setCurrentPage('all_outlets')} />
        ) : (
          <AllOutletsPage onSelectOutlet={handleSelectOutlet} />
        );
      case 'sales_upload':
        return (
          <UploadPage
            reportType="sales"
            onNavigateToOutlet={handleSelectOutlet}
            onNavigateToHistory={() => setCurrentPage('history')}
          />
        );
      case 'purchase_upload':
        return (
          <UploadPage
            reportType="purchase"
            onNavigateToOutlet={handleSelectOutlet}
            onNavigateToHistory={() => setCurrentPage('history')}
          />
        );
      case 'outlet_master':
        return <OutletMasterPage />;
      case 'name_mapping':
        return <NameMappingPage />;
      case 'reports':
        return <ReportsExportPage />;
      case 'history':
        return <ImportHistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <CategoryUploadPage />;
    }
  };

  return (
    <UploadedDataProvider>
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </UploadedDataProvider>
  );
}

export default App;
