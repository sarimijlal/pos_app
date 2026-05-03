# Accounting Rules

This document defines the exact journal entries that must be posted for every
transaction type. The accounting engine (`src/modules/accounting/engine.ts`)
must implement these rules exactly.

All account references use the `code` field from the `accounts` table.
Never hardcode account names — always resolve by code.

---

## Core Principle

Every transaction posts one `journal_entries` record and at least two
`journal_entry_lines` records. Total debits must always equal total credits.
If the accounting write fails, the entire transaction (inventory + ledger)
must roll back. There are no exceptions.

---

## 1. Purchase Invoice

### 1a. Credit Purchase (`payment_type = credit`)

The business buys goods and owes the supplier.

```
Debit  → Inventory (1004)                  [full invoice total]
Credit → Accounts Payable - Supplier (*)   [full invoice total]
```

`(*)` = the supplier's individual payable account, linked via
`suppliers.payable_account_id`.

---

### 1b. Cash Purchase (`payment_type = cash`)

The business buys goods and pays immediately.

```
Debit  → Inventory (1004)   [full invoice total]
Credit → Cash (1001)         [full invoice total]
```

---

### 1c. Partial Purchase (`payment_type = partial`)

The business pays part in cash and owes the rest to the supplier.

```
Debit  → Inventory (1004)                  [full invoice total]
Credit → Cash (1001)                        [cash_amount paid]
Credit → Accounts Payable - Supplier (*)   [credit_amount owed]
```

`cash_amount + credit_amount` must equal `total_amount`.

---

## 2. Purchase Return

Reversal of a purchase. The goods go back; the obligation or cash is reversed.

### 2a. Return of a Credit Purchase

```
Credit → Inventory (1004)                  [return total]
Debit  → Accounts Payable - Supplier (*)   [return total]
```

### 2b. Return of a Cash Purchase

```
Credit → Inventory (1004)   [return total]
Debit  → Cash (1001)         [return total]
```

---

## 3. Sales Invoice

A sale has two simultaneous accounting events:

**Event A — Revenue recognition** (what the customer owes or paid):

### 3a. Credit Sale

```
Debit  → Accounts Receivable - Customer (**)   [invoice total]
Credit → Sales Revenue (4001)                   [invoice total]
```

`(**)` = the customer's individual receivable account, linked via
`customers.receivable_account_id`.

### 3b. Cash Sale

```
Debit  → Cash (1001)           [invoice total]
Credit → Sales Revenue (4001)   [invoice total]
```

### 3c. Card / Bank Sale

```
Debit  → Bank (1002)           [invoice total]
Credit → Sales Revenue (4001)   [invoice total]
```

---

**Event B — Cost of Goods Sold (always, regardless of payment mode)**

This entry is posted for every sale, in addition to Event A.
It records the cost of the inventory that left the business.

```
Debit  → Cost of Goods Sold (5001)   [sum of (cost_price × quantity) for all lines]
Credit → Inventory (1004)             [same amount]
```

The `cost_price` used here is the snapshotted value from `sales_invoice_lines.cost_price`,
not the current purchase price of the item.

Both Event A and Event B are written within the same `journal_entries` record
(same `journal_entry_id`), resulting in four `journal_entry_lines` rows for a
standard cash sale.

---

## 4. Sales Return

Reversal of a sale. Also has two simultaneous events.

**Event A — Revenue reversal:**

### 4a. Return of a Credit Sale

```
Credit → Accounts Receivable - Customer (**)   [return total]
Debit  → Sales Revenue (4001)                   [return total]
```

### 4b. Return of a Cash Sale

```
Credit → Cash (1001)           [return total]
Debit  → Sales Revenue (4001)   [return total]
```

---

**Event B — COGS reversal (always)**

The inventory is coming back in, so COGS is reversed.

```
Credit → Cost of Goods Sold (5001)   [sum of cost_price × quantity_returned]
Debit  → Inventory (1004)             [same amount]
```

---

## Summary Table

| Transaction          | Debit                        | Credit                       |
|----------------------|------------------------------|------------------------------|
| Credit Purchase      | Inventory                    | Accounts Payable (Supplier)  |
| Cash Purchase        | Inventory                    | Cash                         |
| Partial Purchase     | Inventory                    | Cash + Accounts Payable      |
| Credit Purchase Ret. | Accounts Payable (Supplier)  | Inventory                    |
| Cash Purchase Ret.   | Cash                         | Inventory                    |
| Credit Sale (A)      | Accounts Receivable (Cust.)  | Sales Revenue                |
| Cash Sale (A)        | Cash                         | Sales Revenue                |
| Card/Bank Sale (A)   | Bank                         | Sales Revenue                |
| Any Sale (B)         | Cost of Goods Sold           | Inventory                    |
| Credit Sale Ret. (A) | Sales Revenue                | Accounts Receivable (Cust.)  |
| Cash Sale Ret. (A)   | Sales Revenue                | Cash                         |
| Any Sale Ret. (B)    | Inventory                    | Cost of Goods Sold           |

---

## Accounting Engine Interface

The function signature the engine should expose:

```typescript
type JournalEntryInput = {
  date: string;                  // ISO date
  reference_no: string;          // e.g. "PI-0001"
  narration: string;
  source_type: 'purchase' | 'sale' | 'purchase_return' | 'sale_return';
  source_id: number;
  lines: {
    account_id: number;
    debit: number;
    credit: number;
  }[];
};

function postJournalEntry(db: Database, entry: JournalEntryInput): void;
```

The caller (purchase save, sales save, etc.) is responsible for resolving
account IDs by code before calling this function.
The engine only writes — it does not decide which accounts to use.

This keeps the engine simple and the accounting rules in the calling module
where they belong.
