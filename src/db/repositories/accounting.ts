import { invoke } from '@tauri-apps/api/core';
import type { Supplier, Customer } from '../../../interfaces';
import type { AccountRow, InsertAccountInput, DashboardSummary } from '../../modules/accounting/types';

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

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return invoke('get_dashboard_summary');
}
