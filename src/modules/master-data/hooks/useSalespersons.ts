import { useState, useEffect, useCallback } from 'react';
import { getSalespersons, insertSalesperson } from '@/db/repositories/sales';
import type { Salesperson } from '../../../../interfaces';

export function useSalespersons() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSalespersons(await getSalespersons());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load salespersons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(data: { name: string }) {
    await insertSalesperson(data);
    await load();
  }

  return { salespersons, loading, error, add, reload: load };
}
