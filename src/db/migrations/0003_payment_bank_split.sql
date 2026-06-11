-- Purchase invoices: add bank payment support + future multi-bank FK
ALTER TABLE purchase_invoices ADD COLUMN bank_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN bank_account_id INTEGER REFERENCES accounts(id);

-- Sales invoices: add split columns for partial payment + future multi-bank FK
ALTER TABLE sales_invoices ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN credit_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN bank_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN bank_account_id INTEGER REFERENCES accounts(id);

-- Normalize legacy 'card' records to 'bank' (same account, same accounting)
UPDATE sales_invoices SET payment_mode = 'bank' WHERE payment_mode = 'card';
