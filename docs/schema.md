# Database Schema Reference

This is the single source of truth for all database tables.
Drizzle definitions in `src/db/schema.ts` must match this document exactly.

---

## Accounting Core

### `accounts`
Master list of all financial accounts (Chart of Accounts).

| Column      | Type    | Notes                                              |
|-------------|---------|----------------------------------------------------|
| id          | integer | Primary key, autoincrement                         |
| code        | text    | Unique. e.g. "1001", "2001". Used in business logic|
| name        | text    | e.g. "Cash", "Accounts Payable"                    |
| type        | text    | ENUM: `asset`, `liability`, `equity`, `revenue`, `expense` |
| parent_id   | integer | FK → accounts.id. Nullable. For account hierarchy. |
| is_active   | integer | Boolean (0/1). Default 1.                          |
| created_at  | text    | ISO datetime string                                |

**Rules:**
- `code` must be unique. Business logic resolves account IDs by code — never by name.
- Hierarchy is optional but supported (e.g. Assets > Current Assets > Cash).

---

### `journal_entries`
One record per financial event (one per invoice save, one per return save).

| Column      | Type    | Notes                                                        |
|-------------|---------|--------------------------------------------------------------|
| id          | integer | Primary key, autoincrement                                   |
| date        | text    | ISO date string                                              |
| reference_no| text    | Human-readable ref, e.g. "PI-0001", "SI-0001"               |
| narration   | text    | Description of the transaction                               |
| source_type | text    | ENUM: `purchase`, `sale`, `purchase_return`, `sale_return`   |
| source_id   | integer | FK to the originating document (invoice id)                  |
| created_at  | text    | ISO datetime string                                          |

---

### `journal_entry_lines`
Individual debit/credit lines. Always at least two per journal entry.
Total debits must equal total credits for every journal_entry_id.

| Column          | Type    | Notes                                |
|-----------------|---------|--------------------------------------|
| id              | integer | Primary key, autoincrement           |
| journal_entry_id| integer | FK → journal_entries.id              |
| account_id      | integer | FK → accounts.id                     |
| debit           | real    | Amount. 0 if this line is a credit.  |
| credit          | real    | Amount. 0 if this line is a debit.   |

---

## Parties

### `suppliers`
| Column             | Type    | Notes                                        |
|--------------------|---------|----------------------------------------------|
| id                 | integer | Primary key, autoincrement                   |
| name               | text    | Supplier/vendor name                         |
| phone              | text    | Nullable                                     |
| address            | text    | Nullable                                     |
| payable_account_id | integer | FK → accounts.id. Auto-created on new supplier|
| is_active          | integer | Boolean (0/1). Default 1.                    |
| created_at         | text    | ISO datetime string                          |

**Note:** When a new supplier is created, the system must automatically create
a corresponding account in `accounts` with `type = liability` and link it here.

---

### `customers`
| Column               | Type    | Notes                                          |
|----------------------|---------|------------------------------------------------|
| id                   | integer | Primary key, autoincrement                     |
| name                 | text    |                                                |
| phone                | text    | Nullable                                       |
| receivable_account_id| integer | FK → accounts.id. Auto-created on new customer |
| is_active            | integer | Boolean (0/1). Default 1.                      |
| created_at           | text    | ISO datetime string                            |

**Note:** When a new customer is created, the system must automatically create
a corresponding account in `accounts` with `type = asset` and link it here.

---

## Inventory

### `items`
Master list of products (mobiles and accessories).

| Column               | Type    | Notes                                          |
|----------------------|---------|------------------------------------------------|
| id                   | integer | Primary key, autoincrement                     |
| name                 | text    |                                                |
| item_type            | text    | ENUM: `mobile`, `accessory`                    |
| inventory_account_id | integer | FK → accounts.id                               |
| is_active            | integer | Boolean (0/1). Default 1.                      |
| created_at           | text    | ISO datetime string                            |

---

### `stock`
Quantity tracking for accessories only. One row per item.

| Column     | Type    | Notes                                              |
|------------|---------|----------------------------------------------------|
| id         | integer | Primary key, autoincrement                         |
| item_id    | integer | FK → items.id. Unique (one stock row per item).    |
| quantity   | real    | Current on-hand quantity. Never allow below 0.     |
| updated_at | text    | ISO datetime string                                |

**Note:** Only `item_type = accessory` items have a `stock` row.
Mobile inventory is tracked via `imei_units` instead.

---

### `imei_units`
One row per physical mobile device. IMEI-level tracking.

| Column                   | Type    | Notes                                        |
|--------------------------|---------|----------------------------------------------|
| id                       | integer | Primary key, autoincrement                   |
| item_id                  | integer | FK → items.id                                |
| imei                     | text    | Unique across the table                      |
| status                   | text    | ENUM: `in_stock`, `sold`, `returned`         |
| purchase_invoice_line_id | integer | FK → purchase_invoice_lines.id               |
| sale_invoice_line_id     | integer | FK → sales_invoice_lines.id. Nullable.       |
| created_at               | text    | ISO datetime string                          |

**Rules:**
- `imei` must be globally unique. Reject duplicates at DB level (UNIQUE constraint)
  and at application level (check before insert).
- Status transitions: `in_stock` → `sold` (on sale), `sold` → `returned` (on sales return),
  `in_stock` → `returned` (on purchase return).

---

## Purchase Module

### `purchase_invoices`
| Column        | Type    | Notes                                              |
|---------------|---------|----------------------------------------------------|
| id            | integer | Primary key, autoincrement                         |
| supplier_id   | integer | FK → suppliers.id                                  |
| invoice_no    | text    | Unique. Auto-generated (e.g. "PI-0001").           |
| invoice_date  | text    | ISO date string                                    |
| payment_type  | text    | ENUM: `cash`, `credit`, `partial`                  |
| cash_amount   | real    | Nullable. Used when payment_type = partial.        |
| credit_amount | real    | Nullable. Used when payment_type = partial.        |
| remarks       | text    | Nullable                                           |
| total_amount  | real    |                                                    |
| status        | text    | ENUM: `active`, `returned`. Default `active`.      |
| created_at    | text    | ISO datetime string                                |

---

### `purchase_invoice_lines`
| Column              | Type    | Notes                                         |
|---------------------|---------|-----------------------------------------------|
| id                  | integer | Primary key, autoincrement                    |
| purchase_invoice_id | integer | FK → purchase_invoices.id                     |
| item_id             | integer | FK → items.id                                 |
| quantity            | real    |                                               |
| rate                | real    | Cost price per unit at time of purchase       |
| discount            | real    | Nullable. Amount or percentage (TBD per UI).  |
| total               | real    | (quantity × rate) − discount                  |

---

### `purchase_imei_lines`
Links individual IMEI units to the purchase line they arrived on.
One row per IMEI. Only for `item_type = mobile`.

| Column                   | Type    | Notes                              |
|--------------------------|---------|------------------------------------|
| id                       | integer | Primary key, autoincrement         |
| purchase_invoice_line_id | integer | FK → purchase_invoice_lines.id     |
| imei_unit_id             | integer | FK → imei_units.id                 |

---

### `purchase_returns`
| Column             | Type    | Notes                                           |
|--------------------|---------|-------------------------------------------------|
| id                 | integer | Primary key, autoincrement                      |
| original_invoice_id| integer | FK → purchase_invoices.id                       |
| return_date        | text    | ISO date string                                 |
| remarks            | text    | Nullable                                        |
| total_amount       | real    |                                                 |
| created_at         | text    | ISO datetime string                             |

---

### `purchase_return_lines`
| Column                   | Type    | Notes                                     |
|--------------------------|---------|-------------------------------------------|
| id                       | integer | Primary key, autoincrement                |
| purchase_return_id       | integer | FK → purchase_returns.id                  |
| purchase_invoice_line_id | integer | FK → purchase_invoice_lines.id            |
| quantity_returned        | real    | For accessories                           |
| imei_unit_id             | integer | FK → imei_units.id. Nullable (accessories)|

---

## Sales Module

### `salespersons`
| Column     | Type    | Notes                        |
|------------|---------|------------------------------|
| id         | integer | Primary key, autoincrement   |
| name       | text    |                              |
| is_active  | integer | Boolean (0/1). Default 1.    |
| created_at | text    | ISO datetime string          |

---

### `sales_invoices`
| Column        | Type    | Notes                                              |
|---------------|---------|----------------------------------------------------|
| id            | integer | Primary key, autoincrement                         |
| customer_id   | integer | FK → customers.id                                  |
| invoice_no    | text    | Unique. Auto-generated (e.g. "SI-0001").           |
| date          | text    | ISO date string                                    |
| payment_mode  | text    | ENUM: `cash`, `credit`, `card`, `bank`             |
| salesperson_id| integer | FK → salespersons.id. Nullable.                    |
| total_amount  | real    |                                                    |
| status        | text    | ENUM: `active`, `returned`. Default `active`.      |
| created_at    | text    | ISO datetime string                                |

---

### `sales_invoice_lines`
| Column             | Type    | Notes                                            |
|--------------------|---------|--------------------------------------------------|
| id                 | integer | Primary key, autoincrement                       |
| sales_invoice_id   | integer | FK → sales_invoices.id                           |
| item_id            | integer | FK → items.id                                    |
| quantity           | real    |                                                  |
| sale_price         | real    | Price per unit charged to customer               |
| cost_price         | real    | Snapshot of purchase cost at time of sale. NEVER retroactively updated. |
| discount           | real    | Nullable                                         |
| total              | real    | (quantity × sale_price) − discount               |

---

### `sales_imei_lines`
Links IMEI units to the sales line. One row per IMEI. Only for mobiles.

| Column                | Type    | Notes                              |
|-----------------------|---------|------------------------------------|
| id                    | integer | Primary key, autoincrement         |
| sales_invoice_line_id | integer | FK → sales_invoice_lines.id        |
| imei_unit_id          | integer | FK → imei_units.id                 |

---

### `sales_returns`
| Column              | Type    | Notes                                          |
|---------------------|---------|------------------------------------------------|
| id                  | integer | Primary key, autoincrement                     |
| original_invoice_id | integer | FK → sales_invoices.id                         |
| return_date         | text    | ISO date string                                |
| remarks             | text    | Nullable                                       |
| total_amount        | real    |                                                |
| created_at          | text    | ISO datetime string                            |

---

### `sales_return_lines`
| Column                | Type    | Notes                                       |
|-----------------------|---------|---------------------------------------------|
| id                    | integer | Primary key, autoincrement                  |
| sales_return_id       | integer | FK → sales_returns.id                       |
| sales_invoice_line_id | integer | FK → sales_invoice_lines.id                 |
| quantity_returned     | real    | For accessories                             |
| imei_unit_id          | integer | FK → imei_units.id. Nullable (accessories). |

---

## Default Chart of Accounts (Seed Data)

These accounts must be inserted when the database is first initialized.
Business logic references accounts by `code`, so codes must match exactly.

| Code | Name                  | Type      | Parent Code |
|------|-----------------------|-----------|-------------|
| 1000 | Assets                | asset     | —           |
| 1001 | Cash                  | asset     | 1000        |
| 1002 | Bank                  | asset     | 1000        |
| 1003 | Accounts Receivable   | asset     | 1000        |
| 1004 | Inventory             | asset     | 1000        |
| 2000 | Liabilities           | liability | —           |
| 2001 | Accounts Payable      | liability | 2000        |
| 3000 | Equity                | equity    | —           |
| 3001 | Owner's Equity        | equity    | 3000        |
| 4000 | Revenue               | revenue   | —           |
| 4001 | Sales Revenue         | revenue   | 4000        |
| 5000 | Expenses              | expense   | —           |
| 5001 | Cost of Goods Sold    | expense   | 5000        |

**Note:** Individual supplier accounts (Accounts Payable sub-accounts) and
customer accounts (Accounts Receivable sub-accounts) are created dynamically
when a supplier or customer is added.
