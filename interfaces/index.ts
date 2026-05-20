export type Supplier = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  payable_account_id: number;
  is_active: number;
  created_at: string;
  balance: number;
  invoice_count: number;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  receivable_account_id: number;
  is_active: number;
  created_at: string;
  balance: number;
  invoice_count: number;
  last_activity: string | null;
};

export type Item = {
  id: number;
  name: string;
  item_type: 'mobile' | 'accessory';
  inventory_account_id: number;
  is_active: number;
  created_at: string;
};

export type Account = {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id: number | null;
  is_active: number;
  created_at: string;
};

export type Salesperson = {
  id: number;
  name: string;
  is_active: number;
  created_at: string;
  sales_count: number;
  last_sale: string | null;
};
