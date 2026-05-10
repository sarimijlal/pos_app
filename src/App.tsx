import { useState, useEffect } from 'react';
import { getDb } from './db/client';
import { PurchaseTable } from './modules/purchase/components/PurchaseTable';
import { PurchaseForm } from './modules/purchase/components/PurchaseForm';
import { PartiesScreen } from './modules/master-data/components/PartiesScreen';
import { ItemsScreen } from './modules/master-data/components/ItemsScreen';

type Section = 'purchase-list' | 'purchase-new' | 'master-parties' | 'master-items';

const NAV: { label: string; section: Section }[] = [
  { label: 'Purchases', section: 'purchase-list' },
  { label: 'Suppliers & Customers', section: 'master-parties' },
  { label: 'Items', section: 'master-items' },
];

function App() {
  const [section, setSection] = useState<Section>('purchase-list');

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
        {section === 'purchase-list' && (
          <PurchaseTable onNew={() => setSection('purchase-new')} />
        )}
        {section === 'purchase-new' && (
          <PurchaseForm
            onSaved={() => setSection('purchase-list')}
            onCancel={() => setSection('purchase-list')}
          />
        )}
        {section === 'master-parties' && <PartiesScreen />}
        {section === 'master-items' && <ItemsScreen />}
      </main>
    </div>
  );
}

export default App;
