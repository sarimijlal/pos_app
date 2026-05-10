import type { Salesperson } from '../../../interfaces';
import { getDb } from '../client';

export async function getSalespersons(): Promise<Salesperson[]> {
  const db = await getDb();
  return db.select<Salesperson[]>(
    'SELECT id, name, is_active, created_at FROM salespersons WHERE is_active = 1 ORDER BY name'
  );
}

export async function insertSalesperson(data: { name: string }): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO salespersons (name, is_active, created_at) VALUES (?, 1, datetime('now'))`,
    [data.name]
  );
  return result.lastInsertId!;
}
