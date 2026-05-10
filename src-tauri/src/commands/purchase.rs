use serde::{Deserialize, Serialize};
use sqlx::{Row, Sqlite, Transaction};
use tauri_plugin_sql::{DbInstances, DbPool};

// ─── Shared IMEI detail type ──────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ImeiDetail {
    imei: String,
    status: String, // "in_stock" | "sold" | "returned"
}

// ─── Read types ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PurchaseInvoiceRow {
    id: i64,
    supplier_id: i64,
    invoice_no: String,
    invoice_date: String,
    payment_type: String,
    cash_amount: Option<f64>,
    credit_amount: Option<f64>,
    remarks: Option<String>,
    total_amount: f64,
    status: String,
    created_at: String,
    supplier_name: String,
}

#[derive(Serialize)]
pub struct PurchaseLineRow {
    id: i64,
    purchase_invoice_id: i64,
    item_id: i64,
    quantity: f64,
    rate: f64,
    discount: Option<f64>,
    total: f64,
    item_name: String,
    imeis: Vec<ImeiDetail>,
}

#[derive(Serialize)]
pub struct PurchaseInvoiceDetail {
    id: i64,
    supplier_id: i64,
    invoice_no: String,
    invoice_date: String,
    payment_type: String,
    cash_amount: Option<f64>,
    credit_amount: Option<f64>,
    remarks: Option<String>,
    total_amount: f64,
    status: String,
    created_at: String,
    supplier_name: String,
    lines: Vec<PurchaseLineRow>,
}

// ─── Write input types ────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct PurchaseLineInput {
    item_id: i64,
    item_type: String,
    quantity: f64,
    rate: f64,
    discount: f64,
    total: f64,
    imeis: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct SavePurchaseInvoiceInput {
    supplier_id: i64,
    invoice_date: String,
    payment_type: String,
    cash_amount: f64,
    credit_amount: f64,
    remarks: String,
    lines: Vec<PurchaseLineInput>,
}

#[derive(Deserialize, Debug)]
pub struct PurchaseReturnLineInput {
    purchase_invoice_line_id: i64,
    quantity_returned: f64, // for accessory; mobile uses imeis.len()
    imeis: Vec<String>,     // for mobile: specific in_stock IMEIs to return
}

#[derive(Deserialize, Debug)]
pub struct SavePurchaseReturnInput {
    original_invoice_id: i64,
    return_date: String,
    remarks: Option<String>,
    lines: Vec<PurchaseReturnLineInput>,
}

// ─── Save purchase invoice ────────────────────────────────────────────────────

async fn do_save(
    tx: &mut Transaction<'_, Sqlite>,
    input: &SavePurchaseInvoiceInput,
) -> Result<i64, String> {
    let total_amount: f64 = input.lines.iter().map(|l| l.total).sum();

    let row = sqlx::query("SELECT COUNT(*) as count FROM purchase_invoices")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let count: i64 = row.try_get("count").map_err(|e| e.to_string())?;
    let invoice_no = format!("PI-{:04}", count + 1);
    eprintln!("[purchase:rust] invoice_no: {invoice_no}, total: {total_amount}");

    let cash_val: Option<f64> = if input.payment_type == "credit" {
        None
    } else {
        Some(input.cash_amount)
    };
    let credit_val: Option<f64> = if input.payment_type == "cash" {
        None
    } else {
        Some(input.credit_amount)
    };
    let remarks_val: Option<&str> = if input.remarks.is_empty() {
        None
    } else {
        Some(&input.remarks)
    };

    let res = sqlx::query(
        "INSERT INTO purchase_invoices \
         (supplier_id, invoice_no, invoice_date, payment_type, cash_amount, credit_amount, remarks, total_amount, status, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))",
    )
    .bind(input.supplier_id)
    .bind(&invoice_no)
    .bind(&input.invoice_date)
    .bind(&input.payment_type)
    .bind(cash_val)
    .bind(credit_val)
    .bind(remarks_val)
    .bind(total_amount)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let invoice_id = res.last_insert_rowid();
    eprintln!("[purchase:rust] invoice inserted, id: {invoice_id}");

    for line in &input.lines {
        let discount_val: Option<f64> = if line.discount == 0.0 {
            None
        } else {
            Some(line.discount)
        };
        let res = sqlx::query(
            "INSERT INTO purchase_invoice_lines \
             (purchase_invoice_id, item_id, quantity, rate, discount, total) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(invoice_id)
        .bind(line.item_id)
        .bind(line.quantity)
        .bind(line.rate)
        .bind(discount_val)
        .bind(line.total)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
        let line_id = res.last_insert_rowid();
        eprintln!(
            "[purchase:rust] line inserted, id: {line_id}, item_id: {}, type: {}",
            line.item_id, line.item_type
        );

        if line.item_type == "mobile" {
            eprintln!("[purchase:rust] inserting {} IMEI(s)", line.imeis.len());
            for imei in &line.imeis {
                let res = sqlx::query(
                    "INSERT INTO imei_units \
                     (item_id, imei, status, purchase_invoice_line_id, created_at) \
                     VALUES (?, ?, 'in_stock', ?, datetime('now'))",
                )
                .bind(line.item_id)
                .bind(imei.as_str())
                .bind(line_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
                let imei_id = res.last_insert_rowid();

                sqlx::query(
                    "INSERT INTO purchase_imei_lines (purchase_invoice_line_id, imei_unit_id) \
                     VALUES (?, ?)",
                )
                .bind(line_id)
                .bind(imei_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
                eprintln!("[purchase:rust] IMEI inserted: {imei}");
            }
        } else {
            sqlx::query(
                "INSERT INTO stock (item_id, quantity, updated_at) VALUES (?, ?, datetime('now')) \
                 ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = datetime('now')",
            )
            .bind(line.item_id)
            .bind(line.quantity)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
            eprintln!("[purchase:rust] stock upserted, item_id: {}", line.item_id);
        }
    }

    let row = sqlx::query("SELECT id FROM accounts WHERE code = '1004'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    let inventory_acct_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;

    let res = sqlx::query(
        "INSERT INTO journal_entries \
         (date, reference_no, narration, source_type, source_id, created_at) \
         VALUES (?, ?, ?, 'purchase', ?, datetime('now'))",
    )
    .bind(&input.invoice_date)
    .bind(&invoice_no)
    .bind(format!("Purchase invoice {invoice_no}"))
    .bind(invoice_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let je_id = res.last_insert_rowid();
    eprintln!("[purchase:rust] journal_entry inserted, id: {je_id}");

    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, ?, 0)",
    )
    .bind(je_id)
    .bind(inventory_acct_id)
    .bind(total_amount)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    if input.payment_type == "cash" || input.payment_type == "partial" {
        let row = sqlx::query("SELECT id FROM accounts WHERE code = '1001'")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let cash_acct_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;
        let cash_credit = if input.payment_type == "cash" {
            total_amount
        } else {
            input.cash_amount
        };
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, 0, ?)",
        )
        .bind(je_id)
        .bind(cash_acct_id)
        .bind(cash_credit)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    if input.payment_type == "credit" || input.payment_type == "partial" {
        let row = sqlx::query("SELECT payable_account_id FROM suppliers WHERE id = ?")
            .bind(input.supplier_id)
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let payable_acct_id: i64 = row.try_get("payable_account_id").map_err(|e| e.to_string())?;
        let payable_credit = if input.payment_type == "credit" {
            total_amount
        } else {
            input.credit_amount
        };
        sqlx::query(
            "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
             VALUES (?, ?, 0, ?)",
        )
        .bind(je_id)
        .bind(payable_acct_id)
        .bind(payable_credit)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    eprintln!("[purchase:rust] all inserts done, invoice_id: {invoice_id}");
    Ok(invoice_id)
}

#[tauri::command]
pub async fn save_purchase_invoice(
    db_instances: tauri::State<'_, DbInstances>,
    input: SavePurchaseInvoiceInput,
) -> Result<i64, String> {
    eprintln!("[purchase:rust] save_purchase_invoice called, supplier_id: {}", input.supplier_id);

    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded — call Database.load() first".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let mut tx = pool.begin().await.map_err(|e| {
        eprintln!("[purchase:rust] begin failed: {e}");
        e.to_string()
    })?;
    eprintln!("[purchase:rust] transaction started");

    match do_save(&mut tx, &input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| {
                eprintln!("[purchase:rust] commit failed: {e}");
                e.to_string()
            })?;
            eprintln!("[purchase:rust] committed, invoice_id: {id}");
            Ok(id)
        }
        Err(e) => {
            eprintln!("[purchase:rust] do_save failed: {e}");
            let _ = tx.rollback().await;
            eprintln!("[purchase:rust] rolled back");
            Err(e)
        }
    }
}

// ─── Save purchase return ─────────────────────────────────────────────────────

async fn do_purchase_return(
    tx: &mut Transaction<'_, Sqlite>,
    input: &SavePurchaseReturnInput,
) -> Result<i64, String> {
    // 1. Load + guard original invoice
    let inv = sqlx::query(
        "SELECT id, supplier_id, payment_type, cash_amount, credit_amount, total_amount, status \
         FROM purchase_invoices WHERE id = ?",
    )
    .bind(input.original_invoice_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Invoice not found".to_string())?;

    let inv_status: String = inv.try_get("status").map_err(|e| e.to_string())?;
    if inv_status != "active" {
        return Err("Invoice is already returned".to_string());
    }
    let supplier_id: i64 = inv.try_get("supplier_id").map_err(|e| e.to_string())?;
    let payment_type: String = inv.try_get("payment_type").map_err(|e| e.to_string())?;
    let inv_cash_amount: Option<f64> = inv.try_get("cash_amount").map_err(|e| e.to_string())?;
    let inv_credit_amount: Option<f64> = inv.try_get("credit_amount").map_err(|e| e.to_string())?;
    let inv_total_amount: f64 = inv.try_get("total_amount").map_err(|e| e.to_string())?;

    // 2. Validate and process each line, accumulate return_total
    let mut return_total: f64 = 0.0;

    // Store processed line data for return_lines insertion after we have return_id
    struct ProcessedLine {
        purchase_invoice_line_id: i64,
        is_mobile: bool,
        quantity_returned: f64,
        imei_unit_ids: Vec<i64>, // populated for mobile
    }
    let mut processed: Vec<ProcessedLine> = Vec::new();

    for input_line in &input.lines {
        // Load the original purchase line
        let line = sqlx::query(
            "SELECT pil.id, pil.item_id, pil.quantity, pil.rate \
             FROM purchase_invoice_lines pil \
             WHERE pil.id = ? AND pil.purchase_invoice_id = ?",
        )
        .bind(input_line.purchase_invoice_line_id)
        .bind(input.original_invoice_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!(
                "Line {} does not belong to invoice {}",
                input_line.purchase_invoice_line_id, input.original_invoice_id
            )
        })?;

        let item_id: i64 = line.try_get("item_id").map_err(|e| e.to_string())?;
        let line_rate: f64 = line.try_get("rate").map_err(|e| e.to_string())?;

        let item_row = sqlx::query("SELECT item_type FROM items WHERE id = ?")
            .bind(item_id)
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        let item_type: String = item_row.try_get("item_type").map_err(|e| e.to_string())?;

        if item_type == "mobile" {
            if input_line.imeis.is_empty() {
                return Err(format!(
                    "No IMEIs specified for mobile line {}",
                    input_line.purchase_invoice_line_id
                ));
            }
            let mut imei_unit_ids: Vec<i64> = Vec::new();
            for imei in &input_line.imeis {
                let imei_row = sqlx::query(
                    "SELECT iu.id, iu.status \
                     FROM imei_units iu \
                     JOIN purchase_imei_lines pil ON pil.imei_unit_id = iu.id \
                     WHERE iu.imei = ? AND pil.purchase_invoice_line_id = ?",
                )
                .bind(imei.as_str())
                .bind(input_line.purchase_invoice_line_id)
                .fetch_optional(&mut **tx)
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| {
                    format!(
                        "IMEI {} does not belong to this invoice line",
                        imei
                    )
                })?;

                let imei_status: String =
                    imei_row.try_get("status").map_err(|e| e.to_string())?;
                if imei_status != "in_stock" {
                    return Err(format!(
                        "IMEI {} has been sold — return the sales invoice first",
                        imei
                    ));
                }
                let imei_unit_id: i64 = imei_row.try_get("id").map_err(|e| e.to_string())?;

                sqlx::query("UPDATE imei_units SET status = 'returned' WHERE id = ?")
                    .bind(imei_unit_id)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;

                imei_unit_ids.push(imei_unit_id);
                eprintln!("[purchase:rust] IMEI returned: {imei}");
            }
            return_total += line_rate * input_line.imeis.len() as f64;
            processed.push(ProcessedLine {
                purchase_invoice_line_id: input_line.purchase_invoice_line_id,
                is_mobile: true,
                quantity_returned: input_line.imeis.len() as f64,
                imei_unit_ids,
            });
        } else {
            if input_line.quantity_returned <= 0.0 {
                return Err(format!(
                    "quantity_returned must be > 0 for line {}",
                    input_line.purchase_invoice_line_id
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
            eprintln!(
                "[purchase:rust] stock restored {} units for item_id {item_id}",
                input_line.quantity_returned
            );
            return_total += line_rate * input_line.quantity_returned;
            processed.push(ProcessedLine {
                purchase_invoice_line_id: input_line.purchase_invoice_line_id,
                is_mobile: false,
                quantity_returned: input_line.quantity_returned,
                imei_unit_ids: Vec::new(),
            });
        }
    }

    // 3. Insert purchase_returns
    let remarks_val = input.remarks.as_deref().filter(|s| !s.is_empty());
    let ret_res = sqlx::query(
        "INSERT INTO purchase_returns (original_invoice_id, return_date, remarks, total_amount, created_at) \
         VALUES (?, ?, ?, ?, datetime('now'))",
    )
    .bind(input.original_invoice_id)
    .bind(&input.return_date)
    .bind(remarks_val)
    .bind(return_total)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let return_id = ret_res.last_insert_rowid();
    eprintln!("[purchase:rust] purchase_return inserted id:{return_id}, total:{return_total}");

    // 4. Insert purchase_return_lines
    for pl in &processed {
        if pl.is_mobile {
            for &imei_unit_id in &pl.imei_unit_ids {
                sqlx::query(
                    "INSERT INTO purchase_return_lines \
                     (purchase_return_id, purchase_invoice_line_id, quantity_returned, imei_unit_id) \
                     VALUES (?, ?, 1, ?)",
                )
                .bind(return_id)
                .bind(pl.purchase_invoice_line_id)
                .bind(imei_unit_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
            }
        } else {
            sqlx::query(
                "INSERT INTO purchase_return_lines \
                 (purchase_return_id, purchase_invoice_line_id, quantity_returned, imei_unit_id) \
                 VALUES (?, ?, ?, NULL)",
            )
            .bind(return_id)
            .bind(pl.purchase_invoice_line_id)
            .bind(pl.quantity_returned)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // 5. Check if fully returned; if so, mark invoice returned
    // Mobile: no in_stock IMEIs remain for this invoice
    let mobile_remaining: i64 = sqlx::query(
        "SELECT COUNT(*) as cnt \
         FROM imei_units iu \
         JOIN purchase_imei_lines pil ON pil.imei_unit_id = iu.id \
         JOIN purchase_invoice_lines pil2 ON pil.purchase_invoice_line_id = pil2.id \
         WHERE pil2.purchase_invoice_id = ? AND iu.status = 'in_stock'",
    )
    .bind(input.original_invoice_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| e.to_string())?
    .try_get("cnt")
    .map_err(|e| e.to_string())?;

    // Accessory: total returned = total purchased for each accessory line
    let acc_fully_returned: bool = {
        let rows = sqlx::query(
            "SELECT pil.quantity, COALESCE(SUM(prl.quantity_returned), 0.0) as returned \
             FROM purchase_invoice_lines pil \
             JOIN items i ON i.id = pil.item_id \
             LEFT JOIN purchase_return_lines prl ON prl.purchase_invoice_line_id = pil.id \
             WHERE pil.purchase_invoice_id = ? AND i.item_type = 'accessory' \
             GROUP BY pil.id",
        )
        .bind(input.original_invoice_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;

        rows.iter().all(|r| {
            let qty: f64 = r.try_get("quantity").unwrap_or(0.0);
            let returned: f64 = r.try_get("returned").unwrap_or(0.0);
            (returned - qty).abs() < 0.001
        })
    };

    if mobile_remaining == 0 && acc_fully_returned {
        sqlx::query("UPDATE purchase_invoices SET status = 'returned' WHERE id = ?")
            .bind(input.original_invoice_id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        eprintln!("[purchase:rust] invoice {}: marked returned", input.original_invoice_id);
    }

    // 6. Journal entry — Credit Inventory, Debit Cash/Payable
    let return_ref = format!("PR-{:04}", return_id);
    let je_res = sqlx::query(
        "INSERT INTO journal_entries \
         (date, reference_no, narration, source_type, source_id, created_at) \
         VALUES (?, ?, ?, 'purchase_return', ?, datetime('now'))",
    )
    .bind(&input.return_date)
    .bind(&return_ref)
    .bind(format!("Purchase return {return_ref}"))
    .bind(return_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let je_id = je_res.last_insert_rowid();

    let inv_acct: i64 = sqlx::query("SELECT id FROM accounts WHERE code = '1004'")
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| e.to_string())?
        .try_get("id")
        .map_err(|e| e.to_string())?;

    // Credit Inventory
    sqlx::query(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
         VALUES (?, ?, 0, ?)",
    )
    .bind(je_id)
    .bind(inv_acct)
    .bind(return_total)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    match payment_type.as_str() {
        "cash" => {
            let cash_acct: i64 = sqlx::query("SELECT id FROM accounts WHERE code = '1001'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?
                .try_get("id")
                .map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
                 VALUES (?, ?, ?, 0)",
            )
            .bind(je_id)
            .bind(cash_acct)
            .bind(return_total)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        "credit" => {
            let payable_acct: i64 =
                sqlx::query("SELECT payable_account_id FROM suppliers WHERE id = ?")
                    .bind(supplier_id)
                    .fetch_one(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?
                    .try_get("payable_account_id")
                    .map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
                 VALUES (?, ?, ?, 0)",
            )
            .bind(je_id)
            .bind(payable_acct)
            .bind(return_total)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        "partial" => {
            let cash_amount = inv_cash_amount.unwrap_or(0.0);
            let credit_amount = inv_credit_amount.unwrap_or(0.0);
            let cash_ratio = if inv_total_amount > 0.0 {
                cash_amount / inv_total_amount
            } else {
                0.5
            };
            let cash_debit = return_total * cash_ratio;
            let payable_debit = return_total - cash_debit;

            let cash_acct: i64 = sqlx::query("SELECT id FROM accounts WHERE code = '1001'")
                .fetch_one(&mut **tx)
                .await
                .map_err(|e| e.to_string())?
                .try_get("id")
                .map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
                 VALUES (?, ?, ?, 0)",
            )
            .bind(je_id)
            .bind(cash_acct)
            .bind(cash_debit)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;

            let payable_acct: i64 =
                sqlx::query("SELECT payable_account_id FROM suppliers WHERE id = ?")
                    .bind(supplier_id)
                    .fetch_one(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?
                    .try_get("payable_account_id")
                    .map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) \
                 VALUES (?, ?, ?, 0)",
            )
            .bind(je_id)
            .bind(payable_acct)
            .bind(payable_debit)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Unknown payment_type: {payment_type}")),
    }

    eprintln!("[purchase:rust] purchase return done, return_id: {return_id}");
    Ok(return_id)
}

#[tauri::command]
pub async fn save_purchase_return(
    db_instances: tauri::State<'_, DbInstances>,
    input: SavePurchaseReturnInput,
) -> Result<i64, String> {
    eprintln!(
        "[purchase:rust] save_purchase_return called, original_invoice_id: {}",
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

    match do_purchase_return(&mut tx, &input).await {
        Ok(id) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            eprintln!("[purchase:rust] return committed, return_id: {id}");
            Ok(id)
        }
        Err(e) => {
            eprintln!("[purchase:rust] return failed: {e}");
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

// ─── Read commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_purchase_invoices(
    db_instances: tauri::State<'_, DbInstances>,
) -> Result<Vec<PurchaseInvoiceRow>, String> {
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
        "SELECT pi.id, pi.supplier_id, pi.invoice_no, pi.invoice_date, pi.payment_type, \
         pi.cash_amount, pi.credit_amount, pi.remarks, pi.total_amount, pi.status, pi.created_at, \
         s.name as supplier_name \
         FROM purchase_invoices pi \
         JOIN suppliers s ON s.id = pi.supplier_id \
         ORDER BY pi.created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| e.to_string())?;

    rows.iter()
        .map(|r| {
            Ok(PurchaseInvoiceRow {
                id: r.try_get("id").map_err(|e| e.to_string())?,
                supplier_id: r.try_get("supplier_id").map_err(|e| e.to_string())?,
                invoice_no: r.try_get("invoice_no").map_err(|e| e.to_string())?,
                invoice_date: r.try_get("invoice_date").map_err(|e| e.to_string())?,
                payment_type: r.try_get("payment_type").map_err(|e| e.to_string())?,
                cash_amount: r.try_get("cash_amount").map_err(|e| e.to_string())?,
                credit_amount: r.try_get("credit_amount").map_err(|e| e.to_string())?,
                remarks: r.try_get("remarks").map_err(|e| e.to_string())?,
                total_amount: r.try_get("total_amount").map_err(|e| e.to_string())?,
                status: r.try_get("status").map_err(|e| e.to_string())?,
                created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
                supplier_name: r.try_get("supplier_name").map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn get_purchase_invoice_by_id(
    db_instances: tauri::State<'_, DbInstances>,
    id: i64,
) -> Result<Option<PurchaseInvoiceDetail>, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances
            .get("sqlite:pos.db")
            .ok_or_else(|| "Database not loaded".to_string())?
        {
            DbPool::Sqlite(p) => p.clone(),
        }
    };

    let invoice_row = sqlx::query(
        "SELECT pi.id, pi.supplier_id, pi.invoice_no, pi.invoice_date, pi.payment_type, \
         pi.cash_amount, pi.credit_amount, pi.remarks, pi.total_amount, pi.status, pi.created_at, \
         s.name as supplier_name \
         FROM purchase_invoices pi \
         JOIN suppliers s ON s.id = pi.supplier_id \
         WHERE pi.id = ?",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| e.to_string())?;

    let inv = match invoice_row {
        None => return Ok(None),
        Some(r) => r,
    };

    let line_rows = sqlx::query(
        "SELECT pil.id, pil.purchase_invoice_id, pil.item_id, pil.quantity, pil.rate, \
         pil.discount, pil.total, i.name as item_name \
         FROM purchase_invoice_lines pil \
         JOIN items i ON i.id = pil.item_id \
         WHERE pil.purchase_invoice_id = ?",
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
             FROM purchase_imei_lines pil \
             JOIN imei_units iu ON iu.id = pil.imei_unit_id \
             WHERE pil.purchase_invoice_line_id = ? \
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

        lines.push(PurchaseLineRow {
            id: line_id,
            purchase_invoice_id: lr.try_get("purchase_invoice_id").map_err(|e| e.to_string())?,
            item_id: lr.try_get("item_id").map_err(|e| e.to_string())?,
            quantity: lr.try_get("quantity").map_err(|e| e.to_string())?,
            rate: lr.try_get("rate").map_err(|e| e.to_string())?,
            discount: lr.try_get("discount").map_err(|e| e.to_string())?,
            total: lr.try_get("total").map_err(|e| e.to_string())?,
            item_name: lr.try_get("item_name").map_err(|e| e.to_string())?,
            imeis,
        });
    }

    Ok(Some(PurchaseInvoiceDetail {
        id: inv.try_get("id").map_err(|e| e.to_string())?,
        supplier_id: inv.try_get("supplier_id").map_err(|e| e.to_string())?,
        invoice_no: inv.try_get("invoice_no").map_err(|e| e.to_string())?,
        invoice_date: inv.try_get("invoice_date").map_err(|e| e.to_string())?,
        payment_type: inv.try_get("payment_type").map_err(|e| e.to_string())?,
        cash_amount: inv.try_get("cash_amount").map_err(|e| e.to_string())?,
        credit_amount: inv.try_get("credit_amount").map_err(|e| e.to_string())?,
        remarks: inv.try_get("remarks").map_err(|e| e.to_string())?,
        total_amount: inv.try_get("total_amount").map_err(|e| e.to_string())?,
        status: inv.try_get("status").map_err(|e| e.to_string())?,
        created_at: inv.try_get("created_at").map_err(|e| e.to_string())?,
        supplier_name: inv.try_get("supplier_name").map_err(|e| e.to_string())?,
        lines,
    }))
}
