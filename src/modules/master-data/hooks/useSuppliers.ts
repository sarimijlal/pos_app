import { useState, useEffect, useCallback } from 'react';
import { getSuppliers, insertSupplier } from '@/db/repositories/accounting';
import type { Supplier } from '../../../../interfaces';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await getSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(data: { name: string; phone?: string; address?: string }) {
    await insertSupplier(data);
    await load();
  }

  return { suppliers, loading, error, add, reload: load };
}
