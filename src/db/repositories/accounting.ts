import type Database from '@tauri-apps/plugin-sql';
import type { Supplier, Customer } from '../../../interfaces';
import { getDb } from '../client';

export async function getAccountIdByCode(db: Database, code: string): Promise<number> {
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM accounts WHERE code = ?', [code]
  );
  if (rows.length === 0) {
    console.error(`[accounting] account code "${code}" not found`);
    throw new Error(`Account code "${code}" not found`);
  }
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
  console.log('[accounting] insertSupplier:', data.name);
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION', []);
  try {
    const countRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM suppliers', []);
    const code = `SUP-${String(countRows[0].count + 1).padStart(3, '0')}`;
    console.log('[accounting] generated supplier account code:', code);

    const parentRows = await db.select<{ id: number }[]>('SELECT id FROM accounts WHERE code = ?', ['2001']);
    const parentId = parentRows[0].id;

    const accountResult = await db.execute(
      `INSERT INTO accounts (code, name, type, parent_id, is_active, created_at)
       VALUES (?, ?, 'liability', ?, 1, datetime('now'))`,
      [code, `Payable — ${data.name}`, parentId]
    );
    const accountId = accountResult.lastInsertId!;
    console.log('[accounting] payable account created, id:', accountId);

    const supplierResult = await db.execute(
      `INSERT INTO suppliers (name, phone, address, payable_account_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'))`,
      [data.name, data.phone || null, data.address || null, accountId]
    );
    await db.execute('COMMIT', []);
    const supplierId = supplierResult.lastInsertId!;
    console.log('[accounting] supplier inserted, id:', supplierId);
    return supplierId;
  } catch (err) {
    console.error('[accounting] insertSupplier failed:', err);
    await db.execute('ROLLBACK', []);
    throw err;
  }
}

export async function insertCustomer(data: {
  name: string;
  phone?: string;
}): Promise<number> {
  console.log('[accounting] insertCustomer:', data.name);
  const db = await getDb();
  await db.execute('BEGIN TRANSACTION', []);
  try {
    const countRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM customers', []);
    const code = `CUS-${String(countRows[0].count + 1).padStart(3, '0')}`;
    console.log('[accounting] generated customer account code:', code);

    const parentRows = await db.select<{ id: number }[]>('SELECT id FROM accounts WHERE code = ?', ['1003']);
    const parentId = parentRows[0].id;

    const accountResult = await db.execute(
      `INSERT INTO accounts (code, name, type, parent_id, is_active, created_at)
       VALUES (?, ?, 'asset', ?, 1, datetime('now'))`,
      [code, `Receivable — ${data.name}`, parentId]
    );
    const accountId = accountResult.lastInsertId!;
    console.log('[accounting] receivable account created, id:', accountId);

    const customerResult = await db.execute(
      `INSERT INTO customers (name, phone, receivable_account_id, is_active, created_at)
       VALUES (?, ?, ?, 1, datetime('now'))`,
      [data.name, data.phone || null, accountId]
    );
    await db.execute('COMMIT', []);
    const customerId = customerResult.lastInsertId!;
    console.log('[accounting] customer inserted, id:', customerId);
    return customerId;
  } catch (err) {
    console.error('[accounting] insertCustomer failed:', err);
    await db.execute('ROLLBACK', []);
    throw err;
  }
}
