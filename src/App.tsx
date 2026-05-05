import { useState } from 'react';
import { PurchaseTable } from './modules/purchase/components/PurchaseTable';
import { PurchaseForm } from './modules/purchase/components/PurchaseForm';

type View = 'list' | 'new';

function App() {
  const [view, setView] = useState<View>('list');

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">POS — Purchase</h1>
      </header>

      <main className="mx-auto max-w-5xl">
        {view === 'list' && (
          <PurchaseTable onNew={() => setView('new')} />
        )}
        {view === 'new' && (
          <PurchaseForm
            onSaved={() => setView('list')}
            onCancel={() => setView('list')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
