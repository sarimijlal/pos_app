export type PurchaseInvoice = {
  id: number;
  supplier_id: number;
  invoice_no: string;
  invoice_date: string;
  payment_type: 'cash' | 'credit' | 'bank' | 'partial';
  cash_amount: number | null;
  credit_amount: number | null;
  bank_amount: number;
  bank_account_id: number | null;
  remarks: string | null;
  total_amount: number;
  status: 'active' | 'returned';
  created_at: string;
};

export type PurchaseInvoiceLine = {
  id: number;
  purchase_invoice_id: number;
  item_id: number;
  quantity: number;
  rate: number;
  discount: number | null;
  total: number;
};

export type PurchaseLineInput = {
  item_id: number;
  item_type: 'mobile' | 'accessory';
  item_name: string;
  quantity: number;
  rate: number;
  discount: number;
  total: number;
  imeis: string[];
};

export type SavePurchaseInvoiceInput = {
  supplier_id: number;
  invoice_date: string;
  payment_type: 'cash' | 'credit' | 'bank' | 'partial';
  cash_amount: number;
  credit_amount: number;
  bank_amount: number;
  bank_account_id: number | null;
  remarks: string;
  lines: PurchaseLineInput[];
};

export type PurchaseInvoiceRow = PurchaseInvoice & {
  supplier_name: string;
};

export type ImeiDetail = {
  imei: string;
  status: 'in_stock' | 'sold' | 'returned';
};

export type PurchaseInvoiceDetail = PurchaseInvoice & {
  supplier_name: string;
  lines: Array<PurchaseInvoiceLine & { item_name: string; imeis: ImeiDetail[] }>;
};

export type PurchaseReturnLineInput = {
  purchase_invoice_line_id: number;
  quantity_returned: number;
  imeis: string[];
};

export type SavePurchaseReturnInput = {
  original_invoice_id: number;
  return_date: string;
  remarks?: string;
  lines: PurchaseReturnLineInput[];
};
