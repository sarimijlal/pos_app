pub mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../../src/db/migrations/0000_ambiguous_tusk.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_chart_of_accounts",
            sql: include_str!("../../src/db/migrations/0001_seed_accounts.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pos.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::purchase::save_purchase_invoice,
            commands::purchase::get_purchase_invoices,
            commands::purchase::get_purchase_invoice_by_id,
            commands::accounting::get_suppliers,
            commands::accounting::insert_supplier,
            commands::accounting::get_customers,
            commands::accounting::insert_customer,
            commands::inventory::get_items,
            commands::inventory::insert_item,
            commands::sales::get_salespersons,
            commands::sales::insert_salesperson,
            commands::sales::save_sales_invoice,
            commands::sales::get_sales_invoices,
            commands::sales::get_sales_invoice_by_id,
            commands::sales::get_available_imeis,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
