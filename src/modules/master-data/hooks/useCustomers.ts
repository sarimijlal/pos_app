import { useState, useEffect, useCallback } from 'react';
import { getCustomers, insertCustomer } from '@/db/repositories/accounting';
import type { Customer } from '../../../../interfaces';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await getCustomers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(data: { name: string; phone?: string }) {
    await insertCustomer(data);
    await load();
  }

  return { customers, loading, error, add, reload: load };
}
