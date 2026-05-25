import { useState, useEffect } from 'react';
import { getDb } from './db/client';
import { AppShell, type Section } from './components/AppShell';
import { useTheme } from './lib/theme';
import { DashboardScreen } from './modules/dashboard/DashboardScreen';
import { SalesForm } from './modules/sales/components/SalesForm';
import { SalesListScreen } from './modules/sales/components/SalesListScreen';
import { SalesInvoiceDetailScreen } from './modules/sales/components/SalesInvoiceDetailScreen';
import { PurchaseForm } from './modules/purchase/components/PurchaseForm';
import { PurchaseListScreen } from './modules/purchase/components/PurchaseListScreen';
import { PurchaseInvoiceDetailScreen } from './modules/purchase/components/PurchaseInvoiceDetailScreen';
import { PurchaseReturnForm } from './modules/purchase/components/PurchaseReturnForm';
import { SalesReturnForm } from './modules/sales/components/SalesReturnForm';
import { InventoryListScreen } from './modules/inventory/components/InventoryListScreen';
import { ImeiLookupScreen } from './modules/inventory/components/ImeiLookupScreen';
import { PartiesScreen } from './modules/master/components/PartiesScreen';
import { LoadingScreen } from './components/LoadingScreen';

function PlaceholderScreen({ title, section }: { title: string; section: string }) {
  return (
    <div style={{
      flex: 1, minHeight: 320,
      border: '1.5px dashed #d6d6d2',
      borderRadius: 6,
      display: 'grid', placeItems: 'center',
      background: '#fff',
      color: '#9a9aa0',
      textAlign: 'center', padding: 28,
    }}>
      <div>
        <div style={{
          fontFamily: "'Inter Variable', 'Inter', sans-serif",
          fontSize: 28, color: '#6b6b70', lineHeight: 1, marginBottom: 10,
        }}>↘ {title}</div>
        <div style={{ fontSize: 12, color: '#9a9aa0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18 }}>
          screen content · coming soon
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b6b70',
          border: '1px solid #e5e5e3', borderRadius: 4, padding: '4px 8px',
          background: '#f7f7f5', display: 'inline-block',
        }}>{section}</div>
      </div>
    </div>
  );
}

type NavEntry = { section: Section; invoiceId: number | null; imei: string | null };

function App() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [section, setSection] = useState<Section>('dashboard');
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<NavEntry[]>([]);

  useEffect(() => {
    getDb().then(() => setDbReady(true)).catch(e => setDbError(String(e)));
  }, []);

  const navigate = (s: Section, id?: number, imei?: string) => {
    setNavHistory(prev => [
      ...prev.slice(-19),
      { section, invoiceId: selectedInvoiceId, imei: selectedImei },
    ]);
    setSection(s);
    if (id !== undefined) setSelectedInvoiceId(id);
    if (imei !== undefined) setSelectedImei(imei);
  };

  const goBack = () => {
    setNavHistory(prev => {
      const next = [...prev];
      const last = next.pop();
      if (last) {
        setSection(last.section);
        setSelectedInvoiceId(last.invoiceId);
        setSelectedImei(last.imei);
      }
      return next;
    });
  };

  if (!dbReady) {
    return (
      <LoadingScreen
        error={dbError}
        onRetry={() => {
          setDbError(null);
          getDb().then(() => setDbReady(true)).catch(e => setDbError(String(e)));
        }}
      />
    );
  }

  return (
    <AppShell section={section} onNavigate={navigate} canGoBack={navHistory.length > 0} onGoBack={goBack} isDark={isDark} onToggleTheme={toggleTheme}>
      {section === 'dashboard'         && <DashboardScreen onNavigate={navigate} />}
      {section === 'sales-new'         && <SalesForm onSaved={() => navigate('sales-list')} onCancel={goBack} />}
      {section === 'sales-list'        && <SalesListScreen onNew={() => navigate('sales-new')} onViewDetail={(id) => navigate('sales-detail', id)} onReturn={(id) => navigate('sales-return', id)} />}
      {section === 'sales-detail'      && <SalesInvoiceDetailScreen invoiceId={selectedInvoiceId} onBack={goBack} />}
      {section === 'sales-return'      && <SalesReturnForm initialInvoiceId={selectedInvoiceId} onSaved={() => navigate('sales-list')} onCancel={goBack} />}
      {section === 'purchase-new'      && <PurchaseForm onSaved={() => navigate('purchase-list')} onCancel={goBack} />}
      {section === 'purchase-list'     && <PurchaseListScreen onNew={() => navigate('purchase-new')} onViewDetail={(id) => navigate('purchase-detail', id)} onReturn={(id) => navigate('purchase-return', id)} />}
      {section === 'purchase-detail'   && <PurchaseInvoiceDetailScreen invoiceId={selectedInvoiceId} onBack={goBack} />}
      {section === 'purchase-return'   && <PurchaseReturnForm initialInvoiceId={selectedInvoiceId} onSaved={() => navigate('purchase-list')} onCancel={goBack} />}
      {section === 'inventory-stock'   && <InventoryListScreen onViewImei={(imei) => navigate('inventory-imei', undefined, imei)} />}
      {section === 'inventory-imei'    && <ImeiLookupScreen initialImei={selectedImei} onNavigate={navigate} />}
      {section === 'accounts-ledger'   && <PlaceholderScreen title="Chart of Accounts"      section="Screen 13 — Chart of Accounts" />}
      {section === 'master-parties'    && <PartiesScreen />}
      {section === 'master-items'      && <PlaceholderScreen title="Items Master"           section="Screen 12 — Items Master" />}
    </AppShell>
  );
}

export default App;
