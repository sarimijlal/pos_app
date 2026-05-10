use serde::{Deserialize, Serialize};
use sqlx::{Row, Sqlite, Transaction};
use tauri_plugin_sql::{DbInstances, DbPool};

// ─── Shared detail types ──────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ImeiDetail {
    imei: String,
    status: String,
}

// ─── Salesperson types ────────────────────────────────────────────────────────

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

// ─── Sales invoice input types ────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct SalesLineInput {
    item_id: i64,
    item_type: String,
    quantity: f64,
    sale_price: f64,
    discount: f64,
    total: f64,
    imeis: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct SaveSalesInvoiceInput {
    customer_id: i64,
    invoice_date: String,
    payment_mode: String, // cash | credit | card | bank
    salesperson_id: Option<i64>,
    lines: Vec<SalesLineInput>,
}

// ─── Sales return input types ─────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct SalesReturnLineInput {
    sales_invoice_line_id: i64,
    quantity_returned: f64,
    imeis: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct SaveSalesReturnInput {
    original_invoice_id: i64,
    return_date: String,
    remarks: Option<String>,
    lines: Vec<SalesReturnLineInput>,
}

// ─── Sales invoice read types ─────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SalesInvoiceRow {
    id: i64,
    customer_id: i64,
    invoice_no: String,
    date: String,
    payment_mode: String,
    salesperson_id: Option<i64>,
    total_amount: f64,
    status: String,
    created_at: String,
    customer_name: String,
    salesperson_name: Option<String>,
}

#[derive(Serialize)]
pub struct SalesLineRow {
    id: i64,
    sales_invoice_id: i64,
    item_id: i64,
    quantity: f64,
    sale_price: f64,
    cost_price: f64,
    discount: Option<f64>,
    total: f64,
    item_name: String,
    imeis: Vec<ImeiDetail>,
}

#[derive(Serialize)]
pub struct SalesInvoiceDetail {
    id: i64,
    customer_id: i64,
    invoice_no: String,
    date: String,
    payment_mode: String,
    salesperson_id: Option<i64>,
    total_amount: f64,
    status: String,
    created_at: String,
    customer_name: String,
    salesperson_name: Option<String>,
    lines: Vec<SalesLineRow>,
}

// ─── Salesperson commands ──────────────────────────────────────────────────────

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

// ─── Save sales invoice ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn save_sales_invoice(
    db_instances: tauri::State<'_, DbInstances>,
    input: SaveSalesInvoiceInput,
) -> Result<i64, String> {
    eprintln!(
        "[sales:rust] save_sales_invoice called, customer_id: {}",
        input.customer_id
    );

    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| {
        eprintln!("[sales:rust] begin failed: {e}");
        e.to_string()
    })?;
    eprintln!("[sales:rust] transaction started");

    match do_save(&mut tx, &input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| {
                eprintln!("[sales:rust] commit failed: {e}");
                e.to_string()
            })?;
            eprintln!("[sales:rust] committed, invoice_id: {id}");
            Ok(id)
        }
        Err(e) => {
            eprintln!("[sales:rust] do_save failed: {e}");
            let _ = tx.rollback().await;
            eprintln!("[sales:rust] rolled back");
            Err(e)
        }
    }
}

async fn do_save(
    tx: &mut Transaction<'_, Sqlite>,
    input: &SaveSalesInvoiceInput,
) -> Result<i64, String> {
    let total_amount: f64 = input.lines.iter().map(|l| l.total).sum();

    let row = sqlx::query("SELECT COUNT(*) as count FROM sales_invoices")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let count: i64 = row.try_get("count").map_err(|e| e.to_string())?;
    let invoice_no = format!("SI-{:04}", count + 1);
    eprintln!("[sales:rust] invoice_no: {invoice_no}, total: {total_amount}");

    let res = sqlx::query(
        "INSERT INTO sales_invoices \
         (customer_id, invoice_no, date, payment_mode, salesperson_id, total_amount, status, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'))",
    )
    .bind(input.customer_id)
    .bind(&invoice_no)
    .bind(&input.invoice_date)
    .bind(&input.payment_mode)
    .bind(input.salesperson_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let invoice_id = res.last_insert_rowid();
    eprintln!("[sales:rust] invoice inserted, id: {invoice_id}");

    let mut cogs_total: f64 = 0.0;

    for line in &input.lines {
        // Resolve cost_price from purchase history
        let cost_price: f64 = if line.item_type == "mobile" && !line.imeis.is_empty() {
            let row = sqlx::query(
                "SELECT pil.rate FROM purchase_invoice_lines pil \
                 JOIN imei_units iu ON iu.purchase_invoice_line_id = pil.id \
                 WHERE iu.imei = ? LIMIT 1",
            )
            .bind(&line.imeis[0])
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
            row.map(|r| r.try_get::<f64, _>("rate").unwrap_or(0.0))
                .unwrap_or(0.0)
        } else {
            let row = sqlx::query(
                "SELECT rate FROM purchase_invoice_lines WHERE item_id = ? ORDER BY id DESC LIMIT 1",
            )
            .bind(line.item_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
            row.map(|r| r.try_get::<f64, _>("rate").unwrap_or(0.0))
                .unwrap_or(0.0)
        };

        let discount_val: Option<f64> = if line.discount == 0.0 {
            None
        } else {
            Some(line.discount)
        };

        let res = sqlx::query(
            "INSERT INTO sales_invoice_lines \
             (sales_invoice_id, item_id, quantity, sale_price, cost_price, discount, total) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(invoice_id)
        .bind(line.item_id)
        .bind(line.quantity)
        .bind(line.sale_price)
        .bind(cost_price)
        .bind(discount_val)
        .bind(line.total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
        let line_id = res.last_insert_rowid();
        eprintln!(
            "[sales:rust] line inserted id:{line_id} item_id:{} type:{}",
            line.item_id, line.item_type
        );

        cogs_total += cost_price * line.quantity;

        if line.item_type == "mobile" {
            for imei in &line.imeis {
                let res = sqlx::query(
                    "UPDATE imei_units SET status='sold', sale_invoice_line_id=? \
                     WHERE imei=? AND status='in_stock'",
                )
                .bind(line_id)
                .bind(imei.as_str())
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;

                if res.rows_affected() == 0 {
                    return Err(format!("IMEI {imei} is not in stock"));
                }

                let row = sqlx::query("SELECT id FROM imei_units WHERE imei = ?")
                    .bind(imei.as_str())
                    .fetch_one(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;
                let imei_unit_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;

                sqlx::query(
                    "INSERT INTO sales_imei_lines (sales_invoice_line_id, imei_unit_id) \
                     VALUES (?, ?)",
                )
                .bind(line_id)
                .bind(imei_unit_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;

                eprintln!("[sales:rust] IMEI marked sold: {imei}");
            }
        } else {
            let res = sqlx::query(
                "UPDATE stock SET quantity = quantity - ?, updated_at = datetime('now') \
                 WHERE item_id = ? AND quantity >= ?",
            )
            .bind(line.quantity)
            .bind(line.item_id)
            .bind(line.quantity)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;

            if res.rows_affected() == 0 {
                return Err(format!(
                    "Insufficient stock for item_id {}",
                    line.item_id
                ));
            }
            eprintln!("[sales:rust] stock decremented item_id:{}", line.item_id);
        }
    }

    // ── Journal entry (single je for Event A + Event B) ──────────────────────

    let je_res = sqlx::query(
        "INSERT INTO journal_entries \
         (date, reference_no, narration, source_type, source_id, created_at) \
         VALUES (?, ?, ?, 'sale', ?, datetime('now'))",
    )
    .bind(&input.invoice_date)
    .bind(&invoice_no)
    .bind(format!("Sales invoice {invoice_no}"))
    .bind(invoice_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let je_id = je_res.last_insert_rowid();
    eprintln!("[sales:rust] journal_entry inserted id:{je_id}");

    // Event A — Revenue recognition: debit payment account, credit Sales Revenue
    let debit_acct_id: i64 = match input.payment_mode.as_str() {
        "cash" => {
            let row = sqlx::query("SELECT id FROM accounts WHERE code = '1001'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            row.try_get("id").map_err(|e| e.to_string())?
        }
        "card" | "bank" => {
            let row = sqlx::query("SELECT id FROM accounts WHERE code = '1002'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            row.try_get("id").map_err(|e| e.to_string())?
        }
        "credit" => {
            let row = sqlx::query("SELECT receivable_account_id FROM customers WHERE id = ?")
                .bind(input.customer_id)
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            row.try_get("receivable_account_id")
                .map_err(|e| e.to_string())?
        }
        _ => return Err(format!("Unknown payment_mode: {}", input.payment_mode)),
    };

    let revenue_acct_row = sqlx::query("SELECT id FROM accounts WHERE code = '4001'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let revenue_acct_id: i64 = revenue_acct_row
        .try_get("id")
        .map_err(|e| e.to_string())?;

    // Debit payment account
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, ?, 0)",
    )
    .bind(je_id)
    .bind(debit_acct_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    // Credit Sales Revenue
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, 0, ?)",
    )
    .bind(je_id)
    .bind(revenue_acct_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    // Event B — COGS: debit COGS, credit Inventory (only if cogs_total > 0)
    if cogs_total > 0.0 {
        let cogs_row = sqlx::query("SELECT id FROM accounts WHERE code = '5001'")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let cogs_acct_id: i64 = cogs_row.try_get("id").map_err(|e| e.to_string())?;

        let inv_row = sqlx::query("SELECT id FROM accounts WHERE code = '1004'")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let inv_acct_id: i64 = inv_row.try_get("id").map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, ?, 0)",
        )
        .bind(je_id)
        .bind(cogs_acct_id)
        .bind(cogs_total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, 0, ?)",
        )
        .bind(je_id)
        .bind(inv_acct_id)
        .bind(cogs_total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

        eprintln!("[sales:rust] COGS entry posted: {cogs_total}");
    }

    eprintln!("[sales:rust] all inserts done, invoice_id: {invoice_id}");
    Ok(invoice_id)
}

// ─── Save sales return ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn save_sales_return(
    db_instances: tauri::State<'_, DbInstances>,
    input: SaveSalesReturnInput,
) -> Result<i64, String> {
    eprintln!(
        "[sales:rust] save_sales_return called, original_invoice_id: {}",
        input.original_invoice_id
    );

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

    match do_sales_return(&mut tx, &input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            eprintln!("[sales:rust] sales return committed, return_id: {id}");
            Ok(id)
        }
        Err(e) => {
            eprintln!("[sales:rust] do_sales_return failed: {e}");
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

async fn do_sales_return(
    tx: &mut Transaction<'_, Sqlite>,
    input: &SaveSalesReturnInput,
) -> Result<i64, String> {
    // 1. Load + guard original invoice
    let inv = sqlx::query(
        "SELECT id, customer_id, payment_mode, status FROM sales_invoices WHERE id = ?",
    )
    .bind(input.original_invoice_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Invoice {} not found", input.original_invoice_id))?;

    let inv_status: String = inv.try_get("status").map_err(|e| e.to_string())?;
    if inv_status != "active" {
        return Err("Invoice already returned".to_string());
    }
    let customer_id: i64 = inv.try_get("customer_id").map_err(|e| e.to_string())?;
    let payment_mode: String = inv.try_get("payment_mode").map_err(|e| e.to_string())?;

    let mut return_total: f64 = 0.0;
    let mut cogs_total: f64 = 0.0;

    struct ProcessedLine {
        sales_invoice_line_id: i64,
        item_type: String,
        quantity_returned: f64,
        imei_unit_ids: Vec<i64>,
    }

    let mut processed_lines: Vec<ProcessedLine> = Vec::new();

    // 2. For each input line — validate and process
    for input_line in &input.lines {
        let line_row = sqlx::query(
            "SELECT sil.id, sil.item_id, sil.sale_price, sil.cost_price \
             FROM sales_invoice_lines sil \
             WHERE sil.id = ? AND sil.sales_invoice_id = ?",
        )
        .bind(input_line.sales_invoice_line_id)
        .bind(input.original_invoice_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!(
                "Line {} does not belong to invoice {}",
                input_line.sales_invoice_line_id, input.original_invoice_id
            )
        })?;

        let item_id: i64 = line_row.try_get("item_id").map_err(|e| e.to_string())?;
        let sale_price: f64 = line_row.try_get("sale_price").map_err(|e| e.to_string())?;
        let cost_price: f64 = line_row.try_get("cost_price").map_err(|e| e.to_string())?;

        let item_type_row = sqlx::query("SELECT item_type FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let item_type: String = item_type_row
            .try_get("item_type")
            .map_err(|e| e.to_string())?;

        if item_type == "mobile" {
            if input_line.imeis.is_empty() {
                return Err(format!(
                    "Mobile line {} requires at least one IMEI",
                    input_line.sales_invoice_line_id
                ));
            }

            let mut imei_unit_ids: Vec<i64> = Vec::new();

            for imei in &input_line.imeis {
                let imei_row = sqlx::query(
                    "SELECT iu.id, iu.status \
                     FROM imei_units iu \
                     JOIN sales_imei_lines sil ON sil.imei_unit_id = iu.id \
                     WHERE iu.imei = ? AND sil.sales_invoice_line_id = ?",
                )
                .bind(imei.as_str())
                .bind(input_line.sales_invoice_line_id)
                .fetch_optional(&mut **tx)
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| {
                    format!("IMEI {} does not belong to this invoice line", imei)
                })?;

                let imei_status: String =
                    imei_row.try_get("status").map_err(|e| e.to_string())?;
                if imei_status != "sold" {
                    return Err(format!("IMEI {} is not in sold status", imei));
                }

                let imei_id: i64 = imei_row.try_get("id").map_err(|e| e.to_string())?;
                imei_unit_ids.push(imei_id);

                sqlx::query("UPDATE imei_units SET status = 'in_stock' WHERE id = ?")
                    .bind(imei_id)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;

                eprintln!("[sales:rust] IMEI returned to in_stock: {imei}");
            }

            let qty = input_line.imeis.len() as f64;
            return_total += sale_price * qty;
            cogs_total += cost_price * qty;

            processed_lines.push(ProcessedLine {
                sales_invoice_line_id: input_line.sales_invoice_line_id,
                item_type: "mobile".to_string(),
                quantity_returned: qty,
                imei_unit_ids,
            });
        } else {
            if input_line.quantity_returned <= 0.0 {
                return Err(format!(
                    "Accessory line {} requires quantity_returned > 0",
                    input_line.sales_invoice_line_id
                ));
            }

            sqlx::query(
                "UPDATE stock SET quantity = quantity + ?, updated_at = datetime('now') \
                 WHERE item_id = ?",
            )
            .bind(input_line.quantity_returned)
            .bind(item_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;

            return_total += sale_price * input_line.quantity_returned;
            cogs_total += cost_price * input_line.quantity_returned;

            processed_lines.push(ProcessedLine {
                sales_invoice_line_id: input_line.sales_invoice_line_id,
                item_type: "accessory".to_string(),
                quantity_returned: input_line.quantity_returned,
                imei_unit_ids: Vec::new(),
            });
        }
    }

    // 4. INSERT sales_returns
    let sr_res = sqlx::query(
        "INSERT INTO sales_returns \
         (original_invoice_id, return_date, remarks, total_amount, created_at) \
         VALUES (?, ?, ?, ?, datetime('now'))",
    )
    .bind(input.original_invoice_id)
    .bind(&input.return_date)
    .bind(input.remarks.as_deref())
    .bind(return_total)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let return_id = sr_res.last_insert_rowid();
    eprintln!("[sales:rust] sales_return inserted id:{return_id}");

    // 5. INSERT sales_return_lines
    for pl in &processed_lines {
        if pl.item_type == "mobile" {
            for &imei_unit_id in &pl.imei_unit_ids {
                sqlx::query(
                    "INSERT INTO sales_return_lines \
                     (sales_return_id, sales_invoice_line_id, quantity_returned, imei_unit_id) \
                     VALUES (?, ?, 1, ?)",
                )
                .bind(return_id)
                .bind(pl.sales_invoice_line_id)
                .bind(imei_unit_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            }
        } else {
            sqlx::query(
                "INSERT INTO sales_return_lines \
                 (sales_return_id, sales_invoice_line_id, quantity_returned, imei_unit_id) \
                 VALUES (?, ?, ?, NULL)",
            )
            .bind(return_id)
            .bind(pl.sales_invoice_line_id)
            .bind(pl.quantity_returned)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // 6. Check if fully returned
    // Mobile: count of 'sold' IMEIs for this invoice's lines = 0
    let mobile_sold_row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM imei_units iu \
         JOIN sales_imei_lines sil ON sil.imei_unit_id = iu.id \
         JOIN sales_invoice_lines inv_line ON sil.sales_invoice_line_id = inv_line.id \
         WHERE inv_line.sales_invoice_id = ? AND iu.status = 'sold'",
    )
    .bind(input.original_invoice_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let mobile_sold_count: i64 = mobile_sold_row
        .try_get("cnt")
        .map_err(|e| e.to_string())?;

    // Accessory: any line where SUM(returned) < original quantity
    let acc_rows = sqlx::query(
        "SELECT sil.id, sil.quantity, COALESCE(SUM(srl.quantity_returned), 0) as returned_qty \
         FROM sales_invoice_lines sil \
         JOIN items it ON it.id = sil.item_id AND it.item_type = 'accessory' \
         LEFT JOIN sales_return_lines srl ON srl.sales_invoice_line_id = sil.id \
         WHERE sil.sales_invoice_id = ? \
         GROUP BY sil.id, sil.quantity \
         HAVING returned_qty < sil.quantity",
    )
    .bind(input.original_invoice_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    if mobile_sold_count == 0 && acc_rows.is_empty() {
        sqlx::query("UPDATE sales_invoices SET status = 'returned' WHERE id = ?")
            .bind(input.original_invoice_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        eprintln!("[sales:rust] invoice marked returned");
    }

    // 7. Journal entry
    let reference_no = format!("SR-{:04}", return_id);
    let narration = format!("Sales return {}", reference_no);

    let je_res = sqlx::query(
        "INSERT INTO journal_entries \
         (date, reference_no, narration, source_type, source_id, created_at) \
         VALUES (?, ?, ?, 'sale_return', ?, datetime('now'))",
    )
    .bind(&input.return_date)
    .bind(&reference_no)
    .bind(&narration)
    .bind(return_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let je_id = je_res.last_insert_rowid();

    // Event A reversal: Debit Sales Revenue (4001), Credit payment account
    let revenue_row = sqlx::query("SELECT id FROM accounts WHERE code = '4001'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let revenue_acct_id: i64 = revenue_row.try_get("id").map_err(|e| e.to_string())?;

    let credit_acct_id: i64 = match payment_mode.as_str() {
        "cash" => {
            let row = sqlx::query("SELECT id FROM accounts WHERE code = '1001'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            row.try_get("id").map_err(|e| e.to_string())?
        }
        "card" | "bank" => {
            let row = sqlx::query("SELECT id FROM accounts WHERE code = '1002'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            row.try_get("id").map_err(|e| e.to_string())?
        }
        "credit" => {
            let row =
                sqlx::query("SELECT receivable_account_id FROM customers WHERE id = ?")
                    .bind(customer_id)
                    .fetch_one(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;
            row.try_get("receivable_account_id")
                .map_err(|e| e.to_string())?
        }
        _ => return Err(format!("Unknown payment_mode: {}", payment_mode)),
    };

    // Debit Sales Revenue
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, ?, 0)",
    )
    .bind(je_id)
    .bind(revenue_acct_id)
    .bind(return_total)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    // Credit payment account
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, 0, ?)",
    )
    .bind(je_id)
    .bind(credit_acct_id)
    .bind(return_total)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    // Event B reversal: Debit Inventory (1004), Credit COGS (5001)
    if cogs_total > 0.0 {
        let inv_row = sqlx::query("SELECT id FROM accounts WHERE code = '1004'")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let inv_acct_id: i64 = inv_row.try_get("id").map_err(|e| e.to_string())?;

        let cogs_row = sqlx::query("SELECT id FROM accounts WHERE code = '5001'")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let cogs_acct_id: i64 = cogs_row.try_get("id").map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, ?, 0)",
        )
        .bind(je_id)
        .bind(inv_acct_id)
        .bind(cogs_total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, 0, ?)",
        )
        .bind(je_id)
        .bind(cogs_acct_id)
        .bind(cogs_total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

        eprintln!("[sales:rust] COGS reversal posted: {cogs_total}");
    }

    eprintln!("[sales:rust] do_sales_return done, return_id: {return_id}");
    Ok(return_id)
}

// ─── Read commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sales_invoices(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<SalesInvoiceRow>, String> {
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
        "SELECT si.id, si.customer_id, si.invoice_no, si.date, si.payment_mode, \
         si.salesperson_id, si.total_amount, si.status, si.created_at, \
         c.name as customer_name, sp.name as salesperson_name \
         FROM sales_invoices si \
         JOIN customers c ON c.id = si.customer_id \
         LEFT JOIN salespersons sp ON sp.id = si.salesperson_id \
         ORDER BY si.created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(SalesInvoiceRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                customer_id: r.try_get("customer_id").map_err(|e| e.to_string())?,
                invoice_no: r.try_get("invoice_no").map_err(|e| e.to_string())?,
                date: r.try_get("date").map_err(|e| e.to_string())?,
                payment_mode: r.try_get("payment_mode").map_err(|e| e.to_string())?,
                salesperson_id: r.try_get("salesperson_id").map_err(|e| e.to_string())?,
                total_amount: r.try_get("total_amount").map_err(|e| e.to_string())?,
                status: r.try_get("status").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
                customer_name: r.try_get("customer_name").map_err(|e| e.to_string())?,
                salesperson_name: r.try_get("salesperson_name").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn get_sales_invoice_by_id(
    db_instances: tauri::State<'_, DbInstances>,
    id: i64,
) -> Result<Option<SalesInvoiceDetail>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let inv = sqlx::query(
        "SELECT si.id, si.customer_id, si.invoice_no, si.date, si.payment_mode, \
         si.salesperson_id, si.total_amount, si.status, si.created_at, \
         c.name as customer_name, sp.name as salesperson_name \
         FROM sales_invoices si \
         JOIN customers c ON c.id = si.customer_id \
         LEFT JOIN salespersons sp ON sp.id = si.salesperson_id \
         WHERE si.id = ?",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let inv = match inv {
        None => return Ok(None),
        Some(r) => r,
    };

    let line_rows = sqlx::query(
        "SELECT sil.id, sil.sales_invoice_id, sil.item_id, sil.quantity, sil.sale_price, \
         sil.cost_price, sil.discount, sil.total, i.name as item_name \
         FROM sales_invoice_lines sil \
         JOIN items i ON i.id = sil.item_id \
         WHERE sil.sales_invoice_id = ?",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut lines = Vec::new();
    for lr in &line_rows {
        let line_id: i64 = lr.try_get("id").map_err(|e| e.to_string())?;

        let imei_rows = sqlx::query(
            "SELECT iu.imei, iu.status \
             FROM sales_imei_lines sil \
             JOIN imei_units iu ON iu.id = sil.imei_unit_id \
             WHERE sil.sales_invoice_line_id = ? \
             ORDER BY iu.created_at",
        )
        .bind(line_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

        let imeis: Vec<ImeiDetail> = imei_rows
            .iter()
            .map(|r| {
                Ok(ImeiDetail {
                    imei: r.try_get::<String, _>("imei").map_err(|e| e.to_string())?,
                    status: r.try_get::<String, _>("status").map_err(|e| e.to_string())?,
                })
            })
            .collect::<Result<_, String>>()?;

        lines.push(SalesLineRow {
            id: line_id,
            sales_invoice_id: lr.try_get("sales_invoice_id").map_err(|e| e.to_string())?,
            item_id: lr.try_get("item_id").map_err(|e| e.to_string())?,
            quantity: lr.try_get("quantity").map_err(|e| e.to_string())?,
            sale_price: lr.try_get("sale_price").map_err(|e| e.to_string())?,
            cost_price: lr.try_get("cost_price").map_err(|e| e.to_string())?,
            discount: lr.try_get("discount").map_err(|e| e.to_string())?,
            total: lr.try_get("total").map_err(|e| e.to_string())?,
            item_name: lr.try_get("item_name").map_err(|e| e.to_string())?,
            imeis,
        });
    }

    Ok(Some(SalesInvoiceDetail {
        id: inv.try_get("id").map_err(|e| e.to_string())?,
        customer_id: inv.try_get("customer_id").map_err(|e| e.to_string())?,
        invoice_no: inv.try_get("invoice_no").map_err(|e| e.to_string())?,
        date: inv.try_get("date").map_err(|e| e.to_string())?,
        payment_mode: inv.try_get("payment_mode").map_err(|e| e.to_string())?,
        salesperson_id: inv.try_get("salesperson_id").map_err(|e| e.to_string())?,
        total_amount: inv.try_get("total_amount").map_err(|e| e.to_string())?,
        status: inv.try_get("status").map_err(|e| e.to_string())?,
        created_at: inv.try_get("created_at").map_err(|e| e.to_string())?,
        customer_name: inv.try_get("customer_name").map_err(|e| e.to_string())?,
        salesperson_name: inv.try_get("salesperson_name").map_err(|e| e.to_string())?,
        lines,
    }))
}

#[tauri::command]
pub async fn get_available_imeis(
    db_instances: tauri::State<'_, DbInstances>,
    item_id: i64,
) -> Result<Vec<String>, String> {
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
        "SELECT imei FROM imei_units WHERE item_id = ? AND status = 'in_stock' ORDER BY created_at",
    )
    .bind(item_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| r.try_get::<String, _>("imei").map_err(|e| e.to_string()))
        .collect()
}
