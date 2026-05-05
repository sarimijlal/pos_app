import type { Item } from '../../../interfaces';
import { getDb } from '../client';

export async function getItems(): Promise<Item[]> {
  const db = await getDb();
  return db.select<Item[]>(
    'SELECT id, name, item_type, inventory_account_id, is_active, created_at FROM items WHERE is_active = 1 ORDER BY name'
  );
}
