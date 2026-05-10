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

export async function insertSupplier(data: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<number> {
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION', []);
  try {
    const countRows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM suppliers',
      []
    );
    const code = `SUP-${String(countRows[0].count + 1).padStart(3, '0')}`;

    const parentRows = await db.select<{ id: number }[]>(
      'SELECT id FROM accounts WHERE code = ?',
      ['2001']
    );
    const parentId = parentRows[0].id;

    const accountResult = await db.execute(
      `INSERT INTO accounts (code, name, type, parent_id, is_active, created_at)
       VALUES (?, ?, 'liability', ?, 1, datetime('now'))`,
      [code, `Payable — ${data.name}`, parentId]
    );
    const accountId = accountResult.lastInsertId!;

    const supplierResult = await db.execute(
      `INSERT INTO suppliers (name, phone, address, payable_account_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'))`,
      [data.name, data.phone || null, data.address || null, accountId]
    );

    await db.execute('COMMIT', []);
    return supplierResult.lastInsertId!;
  } catch (err) {
    await db.execute('ROLLBACK', []);
    throw err;
  }
}

export async function insertCustomer(data: {
  name: string;
  phone?: string;
}): Promise<number> {
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION', []);
  try {
    const countRows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM customers',
      []
    );
    const code = `CUS-${String(countRows[0].count + 1).padStart(3, '0')}`;

    const parentRows = await db.select<{ id: number }[]>(
      'SELECT id FROM accounts WHERE code = ?',
      ['1003']
    );
    const parentId = parentRows[0].id;

    const accountResult = await db.execute(
      `INSERT INTO accounts (code, name, type, parent_id, is_active, created_at)
       VALUES (?, ?, 'asset', ?, 1, datetime('now'))`,
      [code, `Receivable — ${data.name}`, parentId]
    );
    const accountId = accountResult.lastInsertId!;

    const customerResult = await db.execute(
      `INSERT INTO customers (name, phone, receivable_account_id, is_active, created_at)
       VALUES (?, ?, ?, 1, datetime('now'))`,
      [data.name, data.phone || null, accountId]
    );

    await db.execute('COMMIT', []);
    return customerResult.lastInsertId!;
  } catch (err) {
    await db.execute('ROLLBACK', []);
    throw err;
  }
}
