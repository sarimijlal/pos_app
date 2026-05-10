import { useState, useEffect } from 'react';
import { getDb } from './db/client';
import { PurchaseTable } from './modules/purchase/components/PurchaseTable';
import { PurchaseForm } from './modules/purchase/components/PurchaseForm';
import { PurchaseDetailPanel } from './modules/purchase/components/PurchaseDetailPanel';
import { SalesTable } from './modules/sales/components/SalesTable';
import { SalesForm } from './modules/sales/components/SalesForm';
import { SalesDetailPanel } from './modules/sales/components/SalesDetailPanel';
import { PartiesScreen } from './modules/master-data/components/PartiesScreen';
import { ItemsScreen } from './modules/master-data/components/ItemsScreen';

type Section =
  | 'purchase-list' | 'purchase-new' | 'purchase-detail'
  | 'sales-list'    | 'sales-new'    | 'sales-detail'
  | 'master-parties' | 'master-items';

const NAV: { label: string; section: Section }[] = [
  { label: 'Purchases', section: 'purchase-list' },
  { label: 'Sales', section: 'sales-list' },
  { label: 'Suppliers & Customers', section: 'master-parties' },
  { label: 'Items', section: 'master-items' },
];

function App() {
  const [section, setSection] = useState<Section>('purchase-list');
  // Incrementing these keys forces the form to remount fresh on "New Invoice".
  // Between key increments the form stays mounted but hidden, preserving mid-fill state.
  const [purchaseDraftKey, setPurchaseDraftKey] = useState(0);
  const [salesDraftKey, setSalesDraftKey] = useState(0);

  useEffect(() => {
    getDb().catch(console.error);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Temporary top nav — replaced by App Shell in step 10 */}
      <nav className="flex items-center gap-1 border-b px-4 py-2">
        <span className="mr-4 font-bold text-sm">POS</span>
        {NAV.map((item) => (
          <button
            key={item.section}
            onClick={() => setSection(item.section)}
            className={[
              'rounded px-3 py-1.5 text-sm transition-colors',
              section.startsWith(item.section.split('-')[0])
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        {(section === 'purchase-list' || section === 'purchase-detail') && (
          <>
            {section === 'purchase-list' && (
              <PurchaseTable
                onNew={() => { setPurchaseDraftKey((k) => k + 1); setSection('purchase-new'); }}
                onSelect={() => setSection('purchase-detail')}
              />
            )}
            {section === 'purchase-detail' && (
              <PurchaseDetailPanel
                onClose={() => setSection('purchase-list')}
                onReturned={() => setSection('purchase-list')}
              />
            )}
          </>
        )}

        {/* Keep purchase form mounted while on any purchase section so mid-fill state survives tab switches */}
        <div className={section === 'purchase-new' ? '' : 'hidden'}>
          <PurchaseForm
            key={purchaseDraftKey}
            onSaved={() => setSection('purchase-list')}
            onCancel={() => setSection('purchase-list')}
          />
        </div>

        {(section === 'sales-list' || section === 'sales-detail') && (
          <>
            {section === 'sales-list' && (
              <SalesTable
                onNew={() => { setSalesDraftKey((k) => k + 1); setSection('sales-new'); }}
                onSelect={() => setSection('sales-detail')}
              />
            )}
            {section === 'sales-detail' && (
              <SalesDetailPanel
                onClose={() => setSection('sales-list')}
                onReturned={() => setSection('sales-list')}
              />
            )}
          </>
        )}

        {/* Keep sales form mounted while on any sales section so mid-fill state survives tab switches */}
        <div className={section === 'sales-new' ? '' : 'hidden'}>
          <SalesForm
            key={salesDraftKey}
            onSaved={() => setSection('sales-list')}
            onCancel={() => setSection('sales-list')}
          />
        </div>

        {section === 'master-parties' && <PartiesScreen />}
        {section === 'master-items' && <ItemsScreen />}
      </main>
    </div>
  );
}

export default App;
