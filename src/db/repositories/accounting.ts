import type Database from '@tauri-apps/plugin-sql';
import type { Supplier, Customer } from '../../../interfaces';
import { getDb } from '../client';

export async function getAccountIdByCode(db: Database, code: string): Promise<number> {
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM accounts WHERE code = ?',
    [code]
  );
  if (rows.length === 0) throw new Error(`Account code "${code}" not found`);
  return rows[0].id;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  return db.select<Supplier[]>(
    'SELECT id, name, phone, address, payable_account_id, is_active, created_at FROM suppliers WHERE is_active = 1 ORDER BY name'
  );
}

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  return db.select<Customer[]>(
    'SELECT id, name, phone, receivable_account_id, is_active, created_at FROM customers WHERE is_active = 1 ORDER BY name'
  );
}
