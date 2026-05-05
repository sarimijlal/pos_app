CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_code_unique` ON `accounts` (`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`receivable_account_id` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`receivable_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `imei_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`imei` text NOT NULL,
	`status` text NOT NULL,
	`purchase_invoice_line_id` integer NOT NULL,
	`sale_invoice_line_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_invoice_line_id`) REFERENCES `purchase_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_invoice_line_id`) REFERENCES `sales_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imei_units_imei_unique` ON `imei_units` (`imei`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`item_type` text NOT NULL,
	`inventory_account_id` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`inventory_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`reference_no` text NOT NULL,
	`narration` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_entry_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`journal_entry_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`debit` real NOT NULL,
	`credit` real NOT NULL,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_imei_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_invoice_line_id` integer NOT NULL,
	`imei_unit_id` integer NOT NULL,
	FOREIGN KEY (`purchase_invoice_line_id`) REFERENCES `purchase_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`imei_unit_id`) REFERENCES `imei_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_invoice_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`rate` real NOT NULL,
	`discount` real,
	`total` real NOT NULL,
	FOREIGN KEY (`purchase_invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`invoice_no` text NOT NULL,
	`invoice_date` text NOT NULL,
	`payment_type` text NOT NULL,
	`cash_amount` real,
	`credit_amount` real,
	`remarks` text,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_invoices_invoice_no_unique` ON `purchase_invoices` (`invoice_no`);--> statement-breakpoint
CREATE TABLE `purchase_return_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_return_id` integer NOT NULL,
	`purchase_invoice_line_id` integer NOT NULL,
	`quantity_returned` real NOT NULL,
	`imei_unit_id` integer,
	FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_invoice_line_id`) REFERENCES `purchase_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`imei_unit_id`) REFERENCES `imei_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_invoice_id` integer NOT NULL,
	`return_date` text NOT NULL,
	`remarks` text,
	`total_amount` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`original_invoice_id`) REFERENCES `purchase_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_imei_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_invoice_line_id` integer NOT NULL,
	`imei_unit_id` integer NOT NULL,
	FOREIGN KEY (`sales_invoice_line_id`) REFERENCES `sales_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`imei_unit_id`) REFERENCES `imei_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_invoice_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_invoice_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`sale_price` real NOT NULL,
	`cost_price` real NOT NULL,
	`discount` real,
	`total` real NOT NULL,
	FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`invoice_no` text NOT NULL,
	`date` text NOT NULL,
	`payment_mode` text NOT NULL,
	`salesperson_id` integer,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`salesperson_id`) REFERENCES `salespersons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoices_invoice_no_unique` ON `sales_invoices` (`invoice_no`);--> statement-breakpoint
CREATE TABLE `sales_return_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_return_id` integer NOT NULL,
	`sales_invoice_line_id` integer NOT NULL,
	`quantity_returned` real NOT NULL,
	`imei_unit_id` integer,
	FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_invoice_line_id`) REFERENCES `sales_invoice_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`imei_unit_id`) REFERENCES `imei_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_invoice_id` integer NOT NULL,
	`return_date` text NOT NULL,
	`remarks` text,
	`total_amount` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`original_invoice_id`) REFERENCES `sales_invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `salespersons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_item_id_unique` ON `stock` (`item_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`payable_account_id` integer NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payable_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
