# POS App

A desktop Point-of-Sale application for mobile phone retail shops, built with **Tauri 2**, **React**, and **TypeScript**. All data is stored locally in an embedded SQLite database — no server, no internet connection required.

---

## Features

- **Purchase invoices** — receive stock from suppliers with cash, credit, bank, or split-payment modes
- **Sales invoices** — sell mobiles and accessories to customers, with IMEI-level unit tracking
- **Dual-SIM IMEI support** — record both IMEI numbers (SIM 1 + SIM 2) per physical device
- **Purchase & sales returns** — full return workflow linked back to original invoices
- **Double-entry accounting** — every transaction automatically posts journal entries to the general ledger; books are always in balance
- **Inventory management** — per-IMEI status tracking for mobiles (`in_stock` / `sold` / `returned`), quantity tracking for accessories
- **IMEI lookup** — search by either IMEI number, see full lifecycle: purchased on, sold on, current status, profit
- **Master data** — suppliers, customers, salespersons, items, chart of accounts
- **Partial payments** — split any invoice across cash, credit, and bank legs
- **Offline-first** — the entire app runs on the local machine with no backend dependency

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust) |
| UI framework | [React 18](https://react.dev/) + TypeScript |
| UI components | [shadcn/ui](https://ui.shadcn.com/) (Radix primitives + Tailwind CSS v4) |
| State management | [Zustand](https://zustand-demo.pmnd.rs/) |
| Database | SQLite (local file, embedded) |
| DB driver | `tauri-plugin-sql` (Rust + JS bridge via sqlx) |
| Schema & types | [Drizzle ORM](https://orm.drizzle.team/) (schema definition + TypeScript inference only — not used as query builder at runtime) |
| Migrations | `drizzle-kit` (generates SQL files; run automatically on startup) |

---

## Architecture

All database operations go through **Rust Tauri commands**. The data flow is:

```
React component → hook → repository → invoke() → Rust command → sqlx → SQLite file
```

- React components never call the database directly — they call hooks.
- Hooks call repository functions in `src/db/repositories/`.
- Repository functions call `invoke('command_name')` — no SQL lives in TypeScript.
- All SQL and transaction logic lives in `src-tauri/src/commands/`.
- Every multi-step write uses a single `sqlx::Transaction` to guarantee atomicity.

This design is intentional: `tauri-plugin-sql` manages a connection pool. Running `BEGIN`/`INSERT` across separate JS `db.execute()` calls can land on different pool connections (`SQLITE_BUSY`). Rust's `Transaction` type pins all queries to one connection, eliminating that race condition.

---

## Project Structure

```
pos-app/
├── src/
│   ├── modules/
│   │   ├── purchase/          # Purchase invoices + returns
│   │   ├── sales/             # Sales invoices + returns
│   │   ├── inventory/         # Inventory views, IMEI lookup
│   │   └── accounting/        # Chart of accounts, journal engine
│   ├── db/
│   │   ├── schema.ts          # Drizzle table definitions (TypeScript types only)
│   │   ├── client.ts          # getDb() — initializes the DB connection on startup
│   │   ├── migrations/        # SQL migration files (auto-applied on app launch)
│   │   └── repositories/      # invoke() wrappers — one file per domain
│   └── components/ui/         # shadcn/ui generated components
├── src-tauri/
│   └── src/
│       ├── lib.rs             # Plugin registration + migration list
│       └── commands/          # All DB logic — one file per domain
│           ├── purchase.rs
│           ├── sales.rs
│           ├── inventory.rs
│           └── accounting.rs
├── interfaces/
│   └── index.ts               # Shared TypeScript types (Supplier, Customer, Item…)
└── docs/
    ├── schema.md              # Full DB schema reference
    ├── accounting-rules.md    # Debit/credit rules for every transaction type
    └── progress.md            # Build status and roadmap
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS (WebView2 on Windows, webkit2gtk on Linux)

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri window. The SQLite database is created automatically at first launch and all migrations are applied in order.

### Build for production

```bash
npm run tauri build
```

Produces a native installer in `src-tauri/target/release/bundle/`.

---

## Database Migrations

Migrations live in `src/db/migrations/` as plain SQL files and are registered in `src-tauri/src/lib.rs`. They run automatically on every app launch — `tauri-plugin-sql` tracks the applied version and skips already-run migrations.

| Version | File | Description |
|---|---|---|
| 1 | `0000_ambiguous_tusk.sql` | Full schema — all 19 tables |
| 2 | `0001_seed_accounts.sql` | Default Chart of Accounts (13 accounts) |
| 3 | `0002_imei_partial_unique.sql` | IMEI uniqueness constraint |
| 4 | `0003_payment_bank_split.sql` | Bank payment + partial payment split columns |
| 5 | `0004_dual_imei.sql` | Dual-SIM support — `imei2` column on `imei_units` |

---

## Key Business Rules

- **IMEI uniqueness** — An IMEI (primary or secondary) cannot be purchased again unless the original purchase was fully returned.
- **Mobile sales require IMEI** — Selling a mobile item requires selecting an in-stock IMEI unit. Quantity is derived from the number of IMEIs selected, not typed manually.
- **Accessory sales use quantity** — No IMEI involved. Stock cannot go below zero.
- **Cost price snapshot** — On every sales line, the purchase cost is snapshotted at the time of sale and never recalculated retroactively.
- **Accounting is mandatory** — No invoice can be saved without posting journal entries. If the accounting write fails, the entire transaction rolls back.
- **No hard deletes** — Invoices are never deleted. A `status` field (`active` / `returned`) marks returned records. Financial records are permanent.
- **Supplier/customer accounts** — Creating a supplier auto-creates a liability sub-account; creating a customer auto-creates a receivable sub-account.

---

## License

This project is private and not licensed for public distribution.
