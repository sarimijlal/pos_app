export type AccountRow = {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id: number | null;
  is_active: number;
  balance: number;
};

export type InsertAccountInput = {
  code: string;
  name: string;
  account_type: string;
  parent_id?: number;
};

export type LowStockItem = {
  item_id: number;
  name: string;
  quantity: number;
};

export type RecentEntry = {
  id: number;
  date: string;
  reference_no: string;
  narration: string;
  source_type: string;
  total_debit: number;
};

export type DashboardSummary = {
  period_sales: number;
  period_purchases: number;
  cash_in_hand: number;
  total_receivables: number;
  receivable_customers: number;
  low_stock: LowStockItem[];
  recent_entries: RecentEntry[];
};
