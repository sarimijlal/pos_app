import type { Item } from '../../../interfaces';
import { getDb } from '../client';

export async function getItems(): Promise<Item[]> {
  const db = await getDb();
  return db.select<Item[]>(
    'SELECT id, name, item_type, inventory_account_id, is_active, created_at FROM items WHERE is_active = 1 ORDER BY name'
  );
}

export async function insertItem(data: {
  name: string;
  item_type: 'mobile' | 'accessory';
}): Promise<number> {
  console.log('[inventory] insertItem:', data.name, 'type:', data.item_type);
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION', []);
  try {
    const accountRows = await db.select<{ id: number }[]>(
      'SELECT id FROM accounts WHERE code = ?',
      ['1004']
    );
    const inventoryAccountId = accountRows[0].id;
    console.log('[inventory] inventory account id:', inventoryAccountId);

    const itemResult = await db.execute(
      `INSERT INTO items (name, item_type, inventory_account_id, is_active, created_at)
       VALUES (?, ?, ?, 1, datetime('now'))`,
      [data.name, data.item_type, inventoryAccountId]
    );
    const itemId = itemResult.lastInsertId!;
    console.log('[inventory] item inserted, id:', itemId);

    if (data.item_type === 'accessory') {
      await db.execute(
        'INSERT INTO stock (item_id, quantity, updated_at) VALUES (?, 0, datetime(\'now\'))',
        [itemId]
      );
      console.log('[inventory] stock row created for accessory, item_id:', itemId);
    }

    await db.execute('COMMIT', []);
    console.log('[inventory] transaction committed, item id:', itemId);
    return itemId;
  } catch (err) {
    console.error('[inventory] insertItem failed:', err);
    await db.execute('ROLLBACK', []);
    throw err;
  }
}
