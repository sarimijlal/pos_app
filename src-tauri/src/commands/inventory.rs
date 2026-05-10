use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri_plugin_sql::{DbInstances, DbPool};

#[derive(Serialize)]
pub struct ItemRow {
    id: i64,
    name: String,
    item_type: String,
    inventory_account_id: i64,
    is_active: i64,
    created_at: String,
}

#[derive(Deserialize)]
pub struct InsertItemInput {
    name: String,
    item_type: String,
}

#[tauri::command]
pub async fn get_items(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<ItemRow>, String> {
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
        "SELECT id, name, item_type, inventory_account_id, is_active, created_at \
         FROM items WHERE is_active = 1 ORDER BY name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(ItemRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                item_type: r.try_get("item_type").map_err(|e| e.to_string())?,
                inventory_account_id: r
                    .try_get("inventory_account_id")
                    .map_err(|e| e.to_string())?,
                is_active: r.try_get("is_active").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn insert_item(
    db_instances: tauri::State<'_, DbInstances>,
    input: InsertItemInput,
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

    match do_insert_item(&mut tx, input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            eprintln!("[inventory:rust] item inserted id:{id}");
            Ok(id)
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_insert_item(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    input: InsertItemInput,
) -> Result<i64, String> {
    let row = sqlx::query("SELECT id FROM accounts WHERE code = '1004'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let inventory_account_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;

    let res = sqlx::query(
        "INSERT INTO items (name, item_type, inventory_account_id, is_active, created_at) \
         VALUES (?, ?, ?, 1, datetime('now'))",
    )
    .bind(&input.name)
    .bind(&input.item_type)
    .bind(inventory_account_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let item_id = res.last_insert_rowid();

    if input.item_type == "accessory" {
        sqlx::query(
            "INSERT INTO stock (item_id, quantity, updated_at) VALUES (?, 0, datetime('now'))",
        )
        .bind(item_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(item_id)
}
