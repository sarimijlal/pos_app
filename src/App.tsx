import { useState, useEffect } from 'react';
import { getDb } from './db/client';
import { AppShell, type Section } from './components/AppShell';
import { DashboardScreen } from './modules/dashboard/DashboardScreen';
import { SalesForm } from './modules/sales/components/SalesForm';
import { SalesListScreen } from './modules/sales/components/SalesListScreen';
import { PurchaseForm } from './modules/purchase/components/PurchaseForm';
import { PurchaseListScreen } from './modules/purchase/components/PurchaseListScreen';

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

function App() {
  const [section, setSection] = useState<Section>('dashboard');

  useEffect(() => {
    getDb().catch(console.error);
  }, []);

  const navigate = (s: Section) => setSection(s);

  return (
    <AppShell section={section} onNavigate={navigate}>
      {section === 'dashboard'         && <DashboardScreen onNavigate={navigate} />}
      {section === 'sales-new'         && <SalesForm onSaved={() => navigate('sales-list')} onCancel={() => navigate('dashboard')} />}
      {section === 'sales-list'        && <SalesListScreen onNew={() => navigate('sales-new')} onViewDetail={() => navigate('sales-detail')} onReturn={() => navigate('sales-return')} />}
      {section === 'sales-detail'      && <PlaceholderScreen title="Sales Invoice Detail"   section="Screen 05 — Sales List (detail)" />}
      {section === 'sales-return'      && <PlaceholderScreen title="Sales Return"           section="Screen 07 — Sales Return Form" />}
      {section === 'purchase-new'      && <PurchaseForm onSaved={() => navigate('purchase-list')} onCancel={() => navigate('dashboard')} />}
      {section === 'purchase-list'     && <PurchaseListScreen onNew={() => navigate('purchase-new')} onViewDetail={() => navigate('purchase-detail')} onReturn={() => navigate('purchase-return')} />}
      {section === 'purchase-detail'   && <PlaceholderScreen title="Purchase Invoice Detail" section="Screen 06 — Purchase List (detail)" />}
      {section === 'purchase-return'   && <PlaceholderScreen title="Purchase Return"        section="Screen 08 — Purchase Return Form" />}
      {section === 'inventory-stock'   && <PlaceholderScreen title="Inventory · Stock"      section="Screen 09 — Inventory List" />}
      {section === 'inventory-imei'    && <PlaceholderScreen title="IMEI Lookup"            section="Screen 10 — IMEI Lookup" />}
      {section === 'accounts-ledger'   && <PlaceholderScreen title="Chart of Accounts"      section="Screen 13 — Chart of Accounts" />}
      {section === 'master-parties'    && <PlaceholderScreen title="Suppliers & Customers"  section="Screen 11 — Parties" />}
      {section === 'master-items'      && <PlaceholderScreen title="Items Master"           section="Screen 12 — Items Master" />}
    </AppShell>
  );
}

export default App;
