import { useState, useEffect, useCallback } from 'react';
import { getItems, insertItem } from '@/db/repositories/inventory';
import type { Item } from '../../../../interfaces';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(data: { name: string; item_type: 'mobile' | 'accessory' }) {
    await insertItem(data);
    await load();
  }

  return { items, loading, error, add, reload: load };
}
