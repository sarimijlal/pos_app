import { invoke } from '@tauri-apps/api/core';
import type {
  SavePurchaseInvoiceInput,
  PurchaseInvoiceRow,
  PurchaseInvoiceDetail,
} from '../../modules/purchase/types';

export async function savePurchaseInvoice(input: SavePurchaseInvoiceInput): Promise<number> {
  console.log('[purchase] invoking Rust save_purchase_invoice');
  const id = await invoke<number>('save_purchase_invoice', { input });
  console.log('[purchase] Rust command returned invoice id:', id);
  return id;
}

export async function getPurchaseInvoices(): Promise<PurchaseInvoiceRow[]> {
  return invoke<PurchaseInvoiceRow[]>('get_purchase_invoices');
}

export async function getPurchaseInvoiceById(id: number): Promise<PurchaseInvoiceDetail | null> {
  return invoke<PurchaseInvoiceDetail | null>('get_purchase_invoice_by_id', { id });
}
