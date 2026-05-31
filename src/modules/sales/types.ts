export type SalesInvoice = {
  id: number;
  customer_id: number;
  invoice_no: string;
  date: string;
  payment_mode: 'cash' | 'credit' | 'bank' | 'partial';
  salesperson_id: number | null;
  total_amount: number;
  cash_amount: number;
  credit_amount: number;
  bank_amount: number;
  bank_account_id: number | null;
  status: 'active' | 'returned';
  created_at: string;
};

export type SalesInvoiceLine = {
  id: number;
  sales_invoice_id: number;
  item_id: number;
  quantity: number;
  sale_price: number;
  cost_price: number;
  discount: number | null;
  total: number;
};

export type SalesLineInput = {
  item_id: number;
  item_type: 'mobile' | 'accessory';
  item_name: string;
  quantity: number;
  sale_price: number;
  discount: number;
  total: number;
  imeis: string[];
};

export type SaveSalesInvoiceInput = {
  customer_id: number;
  invoice_date: string;
  payment_mode: 'cash' | 'credit' | 'bank' | 'partial';
  salesperson_id: number | null;
  cash_amount: number;
  credit_amount: number;
  bank_amount: number;
  bank_account_id: number | null;
  lines: SalesLineInput[];
};

export type SalesInvoiceRow = SalesInvoice & {
  customer_name: string;
  salesperson_name: string | null;
};

export type ImeiDetail = {
  imei: string;
  status: 'in_stock' | 'sold' | 'returned';
};

export type SalesInvoiceDetail = SalesInvoice & {
  customer_name: string;
  salesperson_name: string | null;
  lines: Array<SalesInvoiceLine & { item_name: string; imeis: ImeiDetail[] }>;
};

export type SalesReturnLineInput = {
  sales_invoice_line_id: number;
  quantity_returned: number;
  imeis: string[];
};

export type SaveSalesReturnInput = {
  original_invoice_id: number;
  return_date: string;
  remarks?: string;
  lines: SalesReturnLineInput[];
};
