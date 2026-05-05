import { useState, useEffect, useCallback } from 'react';
import { getPurchaseInvoices } from '@/db/repositories/purchase';
import type { PurchaseInvoiceRow } from '../types';

export function usePurchaseList() {
  const [invoices, setInvoices] = useState<PurchaseInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getPurchaseInvoices();
      setInvoices(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { invoices, loading, error, reload: load };
}
