use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Serialize)]
pub struct SalespersonRow {
    id: i64,
    name: String,
    is_active: i64,
    created_at: String,
}

#[derive(Deserialize)]
pub struct InsertSalespersonInput {
    name: String,
}

#[tauri::command]
pub async fn get_salespersons(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<SalespersonRow>, String> {
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
        "SELECT id, name, is_active, created_at \
         FROM salespersons WHERE is_active = 1 ORDER BY name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(SalespersonRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                is_active: r.try_get("is_active").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn insert_salesperson(
    db_instances: tauri::State<'_, DbInstances>,
    input: InsertSalespersonInput,
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
        "INSERT INTO salespersons (name, is_active, created_at) VALUES (?, 1, datetime('now'))",
    )
    .bind(&input.name)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let id = res.last_insert_rowid();
    eprintln!("[sales:rust] salesperson inserted id:{id}");
    Ok(id)
}
