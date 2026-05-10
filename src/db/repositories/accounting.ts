import { invoke } from '@tauri-apps/api/core';
import type { Supplier, Customer } from '../../../interfaces';

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
