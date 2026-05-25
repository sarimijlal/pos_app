import { invoke } from '@tauri-apps/api/core';
import type { Supplier, Customer } from '../../../interfaces';
import type { AccountRow, InsertAccountInput, DashboardSummary, LedgerRow } from '../../modules/accounting/types';

export async function getSuppliers(): Promise<Supplier[]> {
  return invoke<Supplier[]>('get_suppliers');
}

export async function insertSupplier(data: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<number> {
  return invoke<number>('insert_supplier', { input: data });
}

export async function getCustomers(): Promise<Customer[]> {
  return invoke<Customer[]>('get_customers');
}

export async function insertCustomer(data: {
  name: string;
  phone?: string;
}): Promise<number> {
  return invoke<number>('insert_customer', { input: data });
}

export async function updateSupplier(input: {
  id: number;
  name: string;
  phone?: string;
  address?: string;
}): Promise<void> {
  return invoke('update_supplier', { input });
}

export async function updateCustomer(input: {
  id: number;
  name: string;
  phone?: string;
}): Promise<void> {
  return invoke('update_customer', { input });
}

export async function getAccounts(): Promise<AccountRow[]> {
  return invoke('get_accounts');
}

export async function insertAccount(input: InsertAccountInput): Promise<number> {
  return invoke('insert_account', { input });
}

export async function getDashboardSummary(period: string): Promise<DashboardSummary> {
  return invoke('get_dashboard_summary', { period });
}

export async function getPartyLedger(
  entityId: number,
  entityType: 'supplier' | 'customer',
): Promise<LedgerRow[]> {
  return invoke('get_party_ledger', { entityId, entityType });
}

export async function postGeneralEntry(input: {
  date: string;
  narration: string;
  lines: { account_id: number; debit: number; credit: number }[];
}): Promise<number> {
  return invoke('post_general_entry', { input });
}

export async function recordPayment(input: {
  entity_id: number;
  entity_type: 'supplier' | 'customer';
  amount: number;
  payment_mode: 'cash' | 'bank';
  date: string;
  note?: string;
}): Promise<number> {
  return invoke('record_payment', { input });
}
