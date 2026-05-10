use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Serialize)]
pub struct SupplierRow {
    id: i64,
    name: String,
    phone: Option<String>,
    address: Option<String>,
    payable_account_id: i64,
    is_active: i64,
    created_at: String,
}

#[derive(Deserialize)]
pub struct InsertSupplierInput {
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
            _ => return Err("Expected SQLite pool".to_string()),
        }
    };

    let rows = sqlx::query(
        "SELECT id, name, phone, address, payable_account_id, is_active, created_at \
         FROM suppliers WHERE is_active = 1 ORDER BY name",
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
            _ => return Err("Expected SQLite pool".to_string()),
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
            _ => return Err("Expected SQLite pool".to_string()),
        }
    };

    let rows = sqlx::query(
        "SELECT id, name, phone, receivable_account_id, is_active, created_at \
         FROM customers WHERE is_active = 1 ORDER BY name",
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
            _ => return Err("Expected SQLite pool".to_string()),
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
