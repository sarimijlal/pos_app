export type SalesInvoice = {
  id: number;
  customer_id: number;
  invoice_no: string;
  date: string;
  payment_mode: 'cash' | 'credit' | 'card' | 'bank';
  salesperson_id: number | null;
  total_amount: number;
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
  payment_mode: 'cash' | 'credit' | 'card' | 'bank';
  salesperson_id: number | null;
  lines: SalesLineInput[];
};

export type SalesInvoiceRow = SalesInvoice & {
  customer_name: string;
  salesperson_name: string | null;
};

export type SalesInvoiceDetail = SalesInvoice & {
  customer_name: string;
  salesperson_name: string | null;
  lines: Array<SalesInvoiceLine & { item_name: string; imeis: string[] }>;
};
