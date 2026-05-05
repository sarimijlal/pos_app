-- Seed default Chart of Accounts. INSERT OR IGNORE so re-runs are safe.
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('1000', 'Assets',      'asset',     NULL, 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('2000', 'Liabilities', 'liability', NULL, 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('3000', 'Equity',      'equity',    NULL, 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('4000', 'Revenue',     'revenue',   NULL, 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('5000', 'Expenses',    'expense',   NULL, 1, datetime('now'));

INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('1001', 'Cash',                 'asset',     (SELECT id FROM accounts WHERE code = '1000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('1002', 'Bank',                 'asset',     (SELECT id FROM accounts WHERE code = '1000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('1003', 'Accounts Receivable',  'asset',     (SELECT id FROM accounts WHERE code = '1000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('1004', 'Inventory',            'asset',     (SELECT id FROM accounts WHERE code = '1000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('2001', 'Accounts Payable',     'liability', (SELECT id FROM accounts WHERE code = '2000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('3001', 'Owner''s Equity',      'equity',    (SELECT id FROM accounts WHERE code = '3000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('4001', 'Sales Revenue',        'revenue',   (SELECT id FROM accounts WHERE code = '4000'), 1, datetime('now'));
INSERT OR IGNORE INTO accounts (code, name, type, parent_id, is_active, created_at) VALUES ('5001', 'Cost of Goods Sold',   'expense',   (SELECT id FROM accounts WHERE code = '5000'), 1, datetime('now'));
