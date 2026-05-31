import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// ─── Accounting Core ─────────────────────────────────────────────────────────

export const accounts = sqliteTable('accounts', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  code:       text('code').notNull().unique(),
  name:       text('name').notNull(),
  // asset | liability | equity | revenue | expense
  type:       text('type').notNull(),
  // self-referential FK — .references() omitted to avoid circular TS type inference
  parent_id:  integer('parent_id'),
  is_active:  integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const journalEntries = sqliteTable('journal_entries', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  date:         text('date').notNull(),
  reference_no: text('reference_no').notNull(),
  narration:    text('narration').notNull(),
  // purchase | sale | purchase_return | sale_return
  source_type:  text('source_type').notNull(),
  source_id:    integer('source_id').notNull(),
  created_at:   text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const journalEntryLines = sqliteTable('journal_entry_lines', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  journal_entry_id: integer('journal_entry_id').notNull().references(() => journalEntries.id),
  account_id:       integer('account_id').notNull().references(() => accounts.id),
  debit:            real('debit').notNull(),
  credit:           real('credit').notNull(),
});

// ─── Parties ─────────────────────────────────────────────────────────────────

export const suppliers = sqliteTable('suppliers', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  name:               text('name').notNull(),
  phone:              text('phone'),
  address:            text('address'),
  payable_account_id: integer('payable_account_id').notNull().references(() => accounts.id),
  is_active:          integer('is_active').notNull().default(1),
  created_at:         text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const customers = sqliteTable('customers', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  name:                  text('name').notNull(),
  phone:                 text('phone'),
  receivable_account_id: integer('receivable_account_id').notNull().references(() => accounts.id),
  is_active:             integer('is_active').notNull().default(1),
  created_at:            text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Inventory ────────────────────────────────────────────────────────────────

export const items = sqliteTable('items', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  name:                 text('name').notNull(),
  // mobile | accessory
  item_type:            text('item_type').notNull(),
  inventory_account_id: integer('inventory_account_id').notNull().references(() => accounts.id),
  is_active:            integer('is_active').notNull().default(1),
  created_at:           text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const stock = sqliteTable('stock', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  item_id:    integer('item_id').notNull().unique().references(() => items.id),
  quantity:   real('quantity').notNull(),
  updated_at: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Sales Parties ───────────────────────────────────────────────────────────

export const salespersons = sqliteTable('salespersons', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull(),
  is_active:  integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── Purchase Module ─────────────────────────────────────────────────────────

export const purchaseInvoices = sqliteTable('purchase_invoices', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  supplier_id:     integer('supplier_id').notNull().references(() => suppliers.id),
  invoice_no:      text('invoice_no').notNull().unique(),
  invoice_date:    text('invoice_date').notNull(),
  // cash | credit | bank | partial
  payment_type:    text('payment_type').notNull(),
  cash_amount:     real('cash_amount'),
  credit_amount:   real('credit_amount'),
  bank_amount:     real('bank_amount').notNull().default(0),
  // nullable: NULL = default Bank account (1002); set for future multi-bank selection
  bank_account_id: integer('bank_account_id').references(() => accounts.id),
  remarks:         text('remarks'),
  total_amount:    real('total_amount').notNull(),
  // active | returned
  status:          text('status').notNull().default('active'),
  created_at:      text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const purchaseInvoiceLines = sqliteTable('purchase_invoice_lines', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  purchase_invoice_id: integer('purchase_invoice_id').notNull().references(() => purchaseInvoices.id),
  item_id:             integer('item_id').notNull().references(() => items.id),
  quantity:            real('quantity').notNull(),
  rate:                real('rate').notNull(),
  discount:            real('discount'),
  total:               real('total').notNull(),
});

// ─── Sales Module ─────────────────────────────────────────────────────────────

export const salesInvoices = sqliteTable('sales_invoices', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  customer_id:     integer('customer_id').notNull().references(() => customers.id),
  invoice_no:      text('invoice_no').notNull().unique(),
  date:            text('date').notNull(),
  // cash | credit | bank | partial
  payment_mode:    text('payment_mode').notNull(),
  salesperson_id:  integer('salesperson_id').references(() => salespersons.id),
  total_amount:    real('total_amount').notNull(),
  // split amounts — used when payment_mode = 'partial'; also populated for non-partial for ledger clarity
  cash_amount:     real('cash_amount').notNull().default(0),
  credit_amount:   real('credit_amount').notNull().default(0),
  bank_amount:     real('bank_amount').notNull().default(0),
  // nullable: NULL = default Bank account (1002); set for future multi-bank selection
  bank_account_id: integer('bank_account_id').references(() => accounts.id),
  // active | returned
  status:          text('status').notNull().default('active'),
  created_at:      text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const salesInvoiceLines = sqliteTable('sales_invoice_lines', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  sales_invoice_id: integer('sales_invoice_id').notNull().references(() => salesInvoices.id),
  item_id:          integer('item_id').notNull().references(() => items.id),
  quantity:         real('quantity').notNull(),
  sale_price:       real('sale_price').notNull(),
  // snapshot of purchase cost at time of sale — never update retroactively
  cost_price:       real('cost_price').notNull(),
  discount:         real('discount'),
  total:            real('total').notNull(),
});

// ─── IMEI Units (declared after both invoice line tables) ────────────────────

export const imeiUnits = sqliteTable('imei_units', {
  id:                       integer('id').primaryKey({ autoIncrement: true }),
  item_id:                  integer('item_id').notNull().references(() => items.id),
  imei:                     text('imei').notNull().unique(),
  // in_stock | sold | returned
  status:                   text('status').notNull(),
  purchase_invoice_line_id: integer('purchase_invoice_line_id').notNull().references(() => purchaseInvoiceLines.id),
  sale_invoice_line_id:     integer('sale_invoice_line_id').references(() => salesInvoiceLines.id),
  created_at:               text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ─── IMEI Link Tables ─────────────────────────────────────────────────────────

export const purchaseImeiLines = sqliteTable('purchase_imei_lines', {
  id:                       integer('id').primaryKey({ autoIncrement: true }),
  purchase_invoice_line_id: integer('purchase_invoice_line_id').notNull().references(() => purchaseInvoiceLines.id),
  imei_unit_id:             integer('imei_unit_id').notNull().references(() => imeiUnits.id),
});

export const salesImeiLines = sqliteTable('sales_imei_lines', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  sales_invoice_line_id: integer('sales_invoice_line_id').notNull().references(() => salesInvoiceLines.id),
  imei_unit_id:          integer('imei_unit_id').notNull().references(() => imeiUnits.id),
});

// ─── Purchase Returns ─────────────────────────────────────────────────────────

export const purchaseReturns = sqliteTable('purchase_returns', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  original_invoice_id: integer('original_invoice_id').notNull().references(() => purchaseInvoices.id),
  return_date:         text('return_date').notNull(),
  remarks:             text('remarks'),
  total_amount:        real('total_amount').notNull(),
  created_at:          text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const purchaseReturnLines = sqliteTable('purchase_return_lines', {
  id:                       integer('id').primaryKey({ autoIncrement: true }),
  purchase_return_id:       integer('purchase_return_id').notNull().references(() => purchaseReturns.id),
  purchase_invoice_line_id: integer('purchase_invoice_line_id').notNull().references(() => purchaseInvoiceLines.id),
  quantity_returned:        real('quantity_returned').notNull(),
  imei_unit_id:             integer('imei_unit_id').references(() => imeiUnits.id),
});

// ─── Sales Returns ────────────────────────────────────────────────────────────

export const salesReturns = sqliteTable('sales_returns', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  original_invoice_id: integer('original_invoice_id').notNull().references(() => salesInvoices.id),
  return_date:         text('return_date').notNull(),
  remarks:             text('remarks'),
  total_amount:        real('total_amount').notNull(),
  created_at:          text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const salesReturnLines = sqliteTable('sales_return_lines', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  sales_return_id:       integer('sales_return_id').notNull().references(() => salesReturns.id),
  sales_invoice_line_id: integer('sales_invoice_line_id').notNull().references(() => salesInvoiceLines.id),
  quantity_returned:     real('quantity_returned').notNull(),
  imei_unit_id:          integer('imei_unit_id').references(() => imeiUnits.id),
});
``