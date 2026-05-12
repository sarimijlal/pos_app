use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri_plugin_sql::{DbInstances, DbPool};

// ─── Inventory view types ─────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct MobileInventoryRow {
    id: i64,
    name: String,
    in_stock: i64,
    sold: i64,
    returned: i64,
    total: i64,
}

#[derive(Serialize)]
pub struct AccessoryInventoryRow {
    id: i64,
    name: String,
    quantity: f64,
}

#[derive(Serialize)]
pub struct ItemImeiRow {
    imei: String,
    status: String,
    created_at: String,
}

#[derive(Serialize)]
pub struct ImeiLookupResult {
    imei: String,
    status: String,
    item_name: String,
    purchase_invoice_no: String,
    purchase_date: String,
    supplier_name: String,
    cost_price: f64,
    sale_invoice_no: Option<String>,
    sale_date: Option<String>,
    customer_name: Option<String>,
    sale_price: Option<f64>,
    profit: Option<f64>,
}

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

// ─── Inventory read commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn get_inventory_mobiles(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<MobileInventoryRow>, String> {
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
        "SELECT i.id, i.name, \
           COUNT(CASE WHEN iu.status = 'in_stock' THEN 1 END) as in_stock, \
           COUNT(CASE WHEN iu.status = 'sold'     THEN 1 END) as sold, \
           COUNT(CASE WHEN iu.status = 'returned' THEN 1 END) as returned, \
           COUNT(iu.id) as total \
         FROM items i \
         LEFT JOIN imei_units iu ON iu.item_id = i.id \
         WHERE i.item_type = 'mobile' AND i.is_active = 1 \
         GROUP BY i.id, i.name \
         ORDER BY i.name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(MobileInventoryRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                in_stock: r.try_get("in_stock").map_err(|e| e.to_string())?,
                sold: r.try_get("sold").map_err(|e| e.to_string())?,
                returned: r.try_get("returned").map_err(|e| e.to_string())?,
                total: r.try_get("total").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn get_inventory_accessories(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<AccessoryInventoryRow>, String> {
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
        "SELECT i.id, i.name, COALESCE(s.quantity, 0.0) as quantity \
         FROM items i \
         LEFT JOIN stock s ON s.item_id = i.id \
         WHERE i.item_type = 'accessory' AND i.is_active = 1 \
         ORDER BY i.name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(AccessoryInventoryRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                name: r.try_get("name").map_err(|e| e.to_string())?,
                quantity: r.try_get("quantity").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn get_item_imeis(
    db_instances: tauri::State<'_, DbInstances>,
    item_id: i64,
) -> Result<Vec<ItemImeiRow>, String> {
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
        "SELECT imei, status, created_at FROM imei_units \
         WHERE item_id = ? ORDER BY created_at DESC",
    )
    .bind(item_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(ItemImeiRow {
                imei: r.try_get("imei").map_err(|e| e.to_string())?,
                status: r.try_get("status").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn lookup_imei(
    db_instances: tauri::State<'_, DbInstances>,
    imei: String,
) -> Result<Option<ImeiLookupResult>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let row = sqlx::query(
        "SELECT \
           iu.imei, iu.status, \
           it.name as item_name, \
           pi.invoice_no as purchase_invoice_no, \
           pi.invoice_date as purchase_date, \
           sup.name as supplier_name, \
           pil.rate as cost_price, \
           si.invoice_no as sale_invoice_no, \
           si.date as sale_date, \
           cus.name as customer_name, \
           slines.sale_price as sale_price \
         FROM imei_units iu \
         JOIN items it ON it.id = iu.item_id \
         JOIN purchase_invoice_lines pil ON pil.id = iu.purchase_invoice_line_id \
         JOIN purchase_invoices pi ON pi.id = pil.purchase_invoice_id \
         JOIN suppliers sup ON sup.id = pi.supplier_id \
         LEFT JOIN sales_imei_lines sil ON sil.imei_unit_id = iu.id \
         LEFT JOIN sales_invoice_lines slines ON slines.id = sil.sales_invoice_line_id \
         LEFT JOIN sales_invoices si ON si.id = slines.sales_invoice_id \
         LEFT JOIN customers cus ON cus.id = si.customer_id \
         WHERE iu.imei = ?",
    )
    .bind(&imei)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        None => Ok(None),
        Some(r) => {
            let cost_price: f64 = r.try_get("cost_price").map_err(|e| e.to_string())?;
            let sale_price: Option<f64> = r.try_get("sale_price").map_err(|e| e.to_string())?;
            let profit = sale_price.map(|sp| sp - cost_price);
            Ok(Some(ImeiLookupResult {
                imei: r.try_get("imei").map_err(|e| e.to_string())?,
                status: r.try_get("status").map_err(|e| e.to_string())?,
                item_name: r.try_get("item_name").map_err(|e| e.to_string())?,
                purchase_invoice_no: r
                    .try_get("purchase_invoice_no")
                    .map_err(|e| e.to_string())?,
                purchase_date: r.try_get("purchase_date").map_err(|e| e.to_string())?,
                supplier_name: r.try_get("supplier_name").map_err(|e| e.to_string())?,
                cost_price,
                sale_invoice_no: r.try_get("sale_invoice_no").map_err(|e| e.to_string())?,
                sale_date: r.try_get("sale_date").map_err(|e| e.to_string())?,
                customer_name: r.try_get("customer_name").map_err(|e| e.to_string())?,
                sale_price,
                profit,
            }))
        }
    }
}
