export type PurchaseInvoice = {
  id: number;
  supplier_id: number;
  invoice_no: string;
  invoice_date: string;
  payment_type: 'cash' | 'credit' | 'partial';
  cash_amount: number | null;
  credit_amount: number | null;
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
  payment_type: 'cash' | 'credit' | 'partial';
  cash_amount: number;
  credit_amount: number;
  remarks: string;
  lines: PurchaseLineInput[];
};

export type PurchaseInvoiceRow = PurchaseInvoice & {
  supplier_name: string;
};

export type PurchaseInvoiceDetail = PurchaseInvoice & {
  supplier_name: string;
  lines: Array<PurchaseInvoiceLine & { item_name: string; imeis: string[] }>;
};
