export type MobileInventoryRow = {
  id: number;
  name: string;
  in_stock: number;
  sold: number;
  returned: number;
  total: number;
};

export type AccessoryInventoryRow = {
  id: number;
  name: string;
  quantity: number;
};

export type ItemImeiRow = {
  imei: string;
  status: string;
  created_at: string;
};

export type ImeiLookupResult = {
  imei: string;
  status: string;
  item_name: string;
  purchase_invoice_id: number;
  purchase_invoice_no: string;
  purchase_date: string;
  supplier_name: string;
  cost_price: number;
  sale_invoice_id: number | null;
  sale_invoice_no: string | null;
  sale_date: string | null;
  customer_name: string | null;
  sale_price: number | null;
  profit: number | null;
};
