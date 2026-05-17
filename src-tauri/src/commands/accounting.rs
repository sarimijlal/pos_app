use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri_plugin_sql::{DbInstances, DbPool};

// ─── Chart of Accounts / Dashboard types ─────────────────────────────────────

#[derive(Serialize)]
pub struct AccountRow {
    id: i64,
    code: String,
    name: String,
    #[serde(rename = "type")]
    account_type: String,
    parent_id: Option<i64>,
    is_active: i64,
    balance: f64,
}

#[derive(Deserialize)]
pub struct InsertAccountInput {
    code: String,
    name: String,
    account_type: String,
    parent_id: Option<i64>,
}

#[derive(Serialize)]
pub struct LowStockItem {
    item_id: i64,
    name: String,
    quantity: f64,
}

#[derive(Serialize)]
pub struct RecentEntry {
    id: i64,
    date: String,
    reference_no: String,
    narration: String,
    source_type: String,
    source_id: i64,
    total_debit: f64,
}

#[derive(Serialize)]
pub struct DashboardSummary {
    period_sales: f64,
    period_purchases: f64,
    cash_in_hand: f64,
    total_receivables: f64,
    receivable_customers: i64,
    low_stock: Vec<LowStockItem>,
    recent_entries: Vec<RecentEntry>,
}

#[derive(Serialize)]
pub struct SupplierRow {
    id: i64,
    name: String,
    phone: Option<String>,
    address: Option<String>,
    payable_account_id: i64,
    is_active: i64,
    created_at: String,
    balance: f64,
}

#[derive(Deserialize)]
pub struct InsertSupplierInput {
    name: String,
    phone: Option<String>,
    address: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSupplierInput {
    id: i64,
    name: String,
    phone: Option<String>,
    address: Option<String>,
}

#[derive(Serialize)]
pub struct CustomerRow {
    id: i64,
    name: String,
    phone: Option<String>,
    receivable_account_id: i64,
    is_active: i64,
    created_at: String,
    balance: f64,
}

#[derive(Deserialize)]
pub struct UpdateCustomerInput {
    id: i64,
    name: String,
    phone: Option<String>,
}

#[derive(Deserialize)]
pub struct InsertCustomerInput {
    name: String,
    phone: Option<String>,
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_suppliers(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<SupplierRow>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let rows = sqlx::query(
        "SELECT s.id, s.name, s.phone, s.address, s.payable_account_id, s.is_active, s.created_at, \
                COALESCE(SUM(jel.credit) - SUM(jel.debit), 0.0) as balance \
         FROM suppliers s \
         LEFT JOIN journal_entry_lines jel ON jel.account_id = s.payable_account_id \
         WHERE s.is_active = 1 \
         GROUP BY s.id \
         ORDER BY s.name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(SupplierRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                phone: r.try_get("phone").map_err(|e| e.to_string())?,
                address: r.try_get("address").map_err(|e| e.to_string())?,
                payable_account_id: r
                    .try_get("payable_account_id")
                    .map_err(|e| e.to_string())?,
                is_active: r.try_get("is_active").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
                balance: r.try_get("balance").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn insert_supplier(
    db_instances: tauri::State<'_, DbInstances>,
    input: InsertSupplierInput,
) -> Result<i64, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    match do_insert_supplier(&mut tx, input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            eprintln!("[accounting:rust] supplier inserted id:{id}");
            Ok(id)
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_insert_supplier(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: InsertSupplierInput,
) -> Result<i64, String> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM suppliers")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let count: i64 = row.try_get("count").map_err(|e| e.to_string())?;
    let code = format!("SUP-{:03}", count + 1);

    let row = sqlx::query("SELECT id FROM accounts WHERE code = '2001'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let parent_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;

    let res = sqlx::query(
        "INSERT INTO accounts (code, name, type, parent_id, is_active, created_at) \
         VALUES (?, ?, 'liability', ?, 1, datetime('now'))",
    )
    .bind(&code)
    .bind(format!("Payable — {}", input.name))
    .bind(parent_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let account_id = res.last_insert_rowid();

    let res = sqlx::query(
        "INSERT INTO suppliers (name, phone, address, payable_account_id, is_active, created_at) \
         VALUES (?, ?, ?, ?, 1, datetime('now'))",
    )
    .bind(&input.name)
    .bind(input.phone.as_deref())
    .bind(input.address.as_deref())
    .bind(account_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

// ─── Customers ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_customers(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<CustomerRow>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let rows = sqlx::query(
        "SELECT c.id, c.name, c.phone, c.receivable_account_id, c.is_active, c.created_at, \
                COALESCE(SUM(jel.debit) - SUM(jel.credit), 0.0) as balance \
         FROM customers c \
         LEFT JOIN journal_entry_lines jel ON jel.account_id = c.receivable_account_id \
         WHERE c.is_active = 1 \
         GROUP BY c.id \
         ORDER BY c.name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(CustomerRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                phone: r.try_get("phone").map_err(|e| e.to_string())?,
                receivable_account_id: r
                    .try_get("receivable_account_id")
                    .map_err(|e| e.to_string())?,
                is_active: r.try_get("is_active").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
                balance: r.try_get("balance").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn insert_customer(
    db_instances: tauri::State<'_, DbInstances>,
    input: InsertCustomerInput,
) -> Result<i64, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    match do_insert_customer(&mut tx, input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            eprintln!("[accounting:rust] customer inserted id:{id}");
            Ok(id)
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_insert_customer(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: InsertCustomerInput,
) -> Result<i64, String> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM customers")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let count: i64 = row.try_get("count").map_err(|e| e.to_string())?;
    let code = format!("CUS-{:03}", count + 1);

    let row = sqlx::query("SELECT id FROM accounts WHERE code = '1003'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let parent_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;

    let res = sqlx::query(
        "INSERT INTO accounts (code, name, type, parent_id, is_active, created_at) \
         VALUES (?, ?, 'asset', ?, 1, datetime('now'))",
    )
    .bind(&code)
    .bind(format!("Receivable — {}", input.name))
    .bind(parent_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let account_id = res.last_insert_rowid();

    let res = sqlx::query(
        "INSERT INTO customers (name, phone, receivable_account_id, is_active, created_at) \
         VALUES (?, ?, ?, 1, datetime('now'))",
    )
    .bind(&input.name)
    .bind(input.phone.as_deref())
    .bind(account_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(res.last_insert_rowid())
}

// ─── Update commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_supplier(
    db_instances: tauri::State<'_, DbInstances>,
    input: UpdateSupplierInput,
) -> Result<(), String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    match do_update_supplier(&mut tx, input).await {
        Ok(()) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_update_supplier(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: UpdateSupplierInput,
) -> Result<(), String> {
    let row = sqlx::query("SELECT payable_account_id FROM suppliers WHERE id = ?")
        .bind(input.id)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let account_id: i64 = row.try_get("payable_account_id").map_err(|e| e.to_string())?;

    sqlx::query("UPDATE suppliers SET name = ?, phone = ?, address = ? WHERE id = ?")
        .bind(&input.name)
        .bind(input.phone.as_deref())
        .bind(input.address.as_deref())
        .bind(input.id)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE accounts SET name = ? WHERE id = ?")
        .bind(format!("Payable \u{2014} {}", input.name))
        .bind(account_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_customer(
    db_instances: tauri::State<'_, DbInstances>,
    input: UpdateCustomerInput,
) -> Result<(), String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    match do_update_customer(&mut tx, input).await {
        Ok(()) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_update_customer(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: UpdateCustomerInput,
) -> Result<(), String> {
    let row = sqlx::query("SELECT receivable_account_id FROM customers WHERE id = ?")
        .bind(input.id)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let account_id: i64 = row.try_get("receivable_account_id").map_err(|e| e.to_string())?;

    sqlx::query("UPDATE customers SET name = ?, phone = ? WHERE id = ?")
        .bind(&input.name)
        .bind(input.phone.as_deref())
        .bind(input.id)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE accounts SET name = ? WHERE id = ?")
        .bind(format!("Receivable \u{2014} {}", input.name))
        .bind(account_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Chart of Accounts ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_accounts(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<AccountRow>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let rows = sqlx::query(
        "SELECT a.id, a.code, a.name, a.type, a.parent_id, a.is_active, \
                COALESCE(SUM(jel.debit) - SUM(jel.credit), 0.0) AS balance \
         FROM accounts a \
         LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id \
         GROUP BY a.id \
         ORDER BY a.code",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(AccountRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                code: r.try_get("code").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                account_type: r.try_get("type").map_err(|e| e.to_string())?,
                parent_id: r.try_get("parent_id").map_err(|e| e.to_string())?,
                is_active: r.try_get("is_active").map_err(|e| e.to_string())?,
                balance: r.try_get("balance").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn insert_account(
    db_instances: tauri::State<'_, DbInstances>,
    input: InsertAccountInput,
) -> Result<i64, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let res = sqlx::query(
        "INSERT INTO accounts (code, name, type, parent_id, is_active, created_at) \
         VALUES (?, ?, ?, ?, 1, datetime('now'))",
    )
    .bind(&input.code)
    .bind(&input.name)
    .bind(&input.account_type)
    .bind(input.parent_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            format!("Account code '{}' already exists", input.code)
        } else {
            e.to_string()
        }
    })?;

    Ok(res.last_insert_rowid())
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_dashboard_summary(
    db_instances: tauri::State<'_, DbInstances>,
    period: String,
) -> Result<DashboardSummary, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    // Build date conditions from a whitelisted period — no user input interpolated into SQL.
    let (sales_date_cond, purchases_date_cond, entries_date_cond) = match period.as_str() {
        "week" => (
            "date >= date('now', '-6 days') AND date <= date('now')",
            "invoice_date >= date('now', '-6 days') AND invoice_date <= date('now')",
            "je.date >= date('now', '-6 days')",
        ),
        "month" => (
            "date >= date('now', 'start of month') AND date <= date('now')",
            "invoice_date >= date('now', 'start of month') AND invoice_date <= date('now')",
            "je.date >= date('now', 'start of month')",
        ),
        _ => (
            "date = date('now')",
            "invoice_date = date('now')",
            "je.date = date('now')",
        ),
    };

    let sales_sql = format!(
        "SELECT COALESCE(SUM(total_amount), 0.0) as total \
         FROM sales_invoices \
         WHERE {} AND status = 'active'",
        sales_date_cond
    );
    let sales_row = sqlx::query(&sales_sql)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let period_sales: f64 = sales_row.try_get("total").map_err(|e| e.to_string())?;

    let purchases_sql = format!(
        "SELECT COALESCE(SUM(total_amount), 0.0) as total \
         FROM purchase_invoices \
         WHERE {} AND status = 'active'",
        purchases_date_cond
    );
    let purchases_row = sqlx::query(&purchases_sql)
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let period_purchases: f64 = purchases_row.try_get("total").map_err(|e| e.to_string())?;

    let low_stock_rows = sqlx::query(
        "SELECT i.id as item_id, i.name, s.quantity \
         FROM items i JOIN stock s ON s.item_id = i.id \
         WHERE i.item_type = 'accessory' AND s.quantity < 5 \
         ORDER BY s.quantity ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let low_stock: Vec<LowStockItem> = low_stock_rows
        .iter()
        .map(|r| {
            Ok(LowStockItem {
                item_id: r.try_get("item_id").map_err(|e: sqlx::Error| e.to_string())?,
                name: r.try_get("name").map_err(|e: sqlx::Error| e.to_string())?,
                quantity: r.try_get("quantity").map_err(|e: sqlx::Error| e.to_string())?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let entries_sql = format!(
        "SELECT je.id, je.date, je.reference_no, je.narration, je.source_type, je.source_id, \
                SUM(jel.debit) as total_debit \
         FROM journal_entries je \
         JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id \
         WHERE {} \
         GROUP BY je.id \
         ORDER BY je.created_at DESC \
         LIMIT 10",
        entries_date_cond
    );
    let entry_rows = sqlx::query(&entries_sql)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let recent_entries: Vec<RecentEntry> = entry_rows
        .iter()
        .map(|r| {
            Ok(RecentEntry {
                id: r.try_get("id").map_err(|e: sqlx::Error| e.to_string())?,
                date: r.try_get("date").map_err(|e: sqlx::Error| e.to_string())?,
                reference_no: r
                    .try_get("reference_no")
                    .map_err(|e: sqlx::Error| e.to_string())?,
                narration: r
                    .try_get("narration")
                    .map_err(|e: sqlx::Error| e.to_string())?,
                source_type: r
                    .try_get("source_type")
                    .map_err(|e: sqlx::Error| e.to_string())?,
                source_id: r
                    .try_get("source_id")
                    .map_err(|e: sqlx::Error| e.to_string())?,
                total_debit: r
                    .try_get("total_debit")
                    .map_err(|e: sqlx::Error| e.to_string())?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    // Cash in hand — running balance of account 1001
    let cash_row = sqlx::query(
        "SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0.0) AS balance \
         FROM journal_entry_lines jel \
         JOIN accounts a ON a.id = jel.account_id \
         WHERE a.code = '1001'",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let cash_in_hand: f64 = cash_row.try_get("balance").map_err(|e| e.to_string())?;

    // Total receivables — sum across all customer receivable accounts
    let recv_row = sqlx::query(
        "SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0.0) AS balance \
         FROM journal_entry_lines jel \
         WHERE jel.account_id IN (SELECT receivable_account_id FROM customers)",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let total_receivables: f64 = recv_row.try_get("balance").map_err(|e| e.to_string())?;

    // Count of customers with a positive outstanding balance
    let recv_cust_row = sqlx::query(
        "SELECT COUNT(*) AS count \
         FROM ( \
           SELECT c.id \
           FROM customers c \
           JOIN journal_entry_lines jel ON jel.account_id = c.receivable_account_id \
           GROUP BY c.id \
           HAVING SUM(jel.debit) - SUM(jel.credit) > 0 \
         ) sub",
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| e.to_string())?;
    let receivable_customers: i64 = recv_cust_row.try_get("count").map_err(|e| e.to_string())?;

    Ok(DashboardSummary {
        period_sales,
        period_purchases,
        cash_in_hand,
        total_receivables,
        receivable_customers,
        low_stock,
        recent_entries,
    })
}
