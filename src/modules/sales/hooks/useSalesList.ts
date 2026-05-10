import { useState, useEffect, useCallback } from 'react';
import { getSalesInvoices } from '@/db/repositories/sales';
import type { SalesInvoiceRow } from '../types';

export function useSalesList() {
  const [invoices, setInvoices] = useState<SalesInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await getSalesInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { invoices, loading, error, reload: load };
}
