import { invoke } from '@tauri-apps/api/core';
import type { Salesperson } from '../../../interfaces';
import type {
  SaveSalesInvoiceInput,
  SalesInvoiceRow,
  SalesInvoiceDetail,
  SaveSalesReturnInput,
} from '../../modules/sales/types';

export async function getSalespersons(): Promise<Salesperson[]> {
  return invoke<Salesperson[]>('get_salespersons');
}

export async function insertSalesperson(data: { name: string }): Promise<number> {
  return invoke<number>('insert_salesperson', { input: data });
}

export async function saveSalesInvoice(input: SaveSalesInvoiceInput): Promise<number> {
  console.log('[sales] invoking Rust save_sales_invoice');
  const id = await invoke<number>('save_sales_invoice', { input });
  console.log('[sales] Rust command returned invoice id:', id);
  return id;
}

export async function getSalesInvoices(): Promise<SalesInvoiceRow[]> {
  return invoke<SalesInvoiceRow[]>('get_sales_invoices');
}

export async function getSalesInvoiceById(id: number): Promise<SalesInvoiceDetail | null> {
  return invoke<SalesInvoiceDetail | null>('get_sales_invoice_by_id', { id });
}

export async function getAvailableImeis(itemId: number): Promise<string[]> {
  return invoke<string[]>('get_available_imeis', { itemId });
}

export async function saveSalesReturn(input: SaveSalesReturnInput): Promise<number> {
  return invoke<number>('save_sales_return', { input });
}
