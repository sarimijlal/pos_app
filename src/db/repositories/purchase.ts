import { getDb } from '../client';
import { getAccountIdByCode } from './accounting';
import { postJournalEntry } from '../../modules/accounting/engine';
import type {
  SavePurchaseInvoiceInput,
  PurchaseInvoiceRow,
  PurchaseInvoiceDetail,
} from '../../modules/purchase/types';

export async function savePurchaseInvoice(input: SavePurchaseInvoiceInput): Promise<number> {
  const db = await getDb();
  console.log('[purchase:repo] starting transaction');
  await db.execute('BEGIN TRANSACTION', []);

  try {
    const totalAmount = input.lines.reduce((sum, l) => sum + l.total, 0);
    console.log('[purchase:repo] total amount:', totalAmount);

    const countRows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM purchase_invoices', []
    );
    const invoiceNo = `PI-${String(countRows[0].count + 1).padStart(4, '0')}`;
    console.log('[purchase:repo] invoice no:', invoiceNo);

    const invoiceResult = await db.execute(
      `INSERT INTO purchase_invoices
         (supplier_id, invoice_no, invoice_date, payment_type, cash_amount, credit_amount, remarks, total_amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
      [
        input.supplier_id,
        invoiceNo,
        input.invoice_date,
        input.payment_type,
        input.payment_type === 'credit' ? null : (input.cash_amount  || totalAmount),
        input.payment_type === 'cash'   ? null : (input.credit_amount || totalAmount),
        input.remarks || null,
        totalAmount,
      ]
    );
    const invoiceId = invoiceResult.lastInsertId!;
    console.log('[purchase:repo] invoice header inserted, id:', invoiceId);

    for (const line of input.lines) {
      console.log(`[purchase:repo] inserting line — item_id:${line.item_id} type:${line.item_type} qty:${line.quantity} rate:${line.rate}`);

      const lineResult = await db.execute(
        `INSERT INTO purchase_invoice_lines
           (purchase_invoice_id, item_id, quantity, rate, discount, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, line.item_id, line.quantity, line.rate, line.discount || null, line.total]
      );
      const lineId = lineResult.lastInsertId!;
      console.log('[purchase:repo] line inserted, id:', lineId);

      if (line.item_type === 'mobile') {
        console.log(`[purchase:repo] inserting ${line.imeis.length} IMEI(s) for line ${lineId}`);
        for (const imei of line.imeis) {
          const imeiResult = await db.execute(
            `INSERT INTO imei_units (item_id, imei, status, purchase_invoice_line_id, created_at)
             VALUES (?, ?, 'in_stock', ?, datetime('now'))`,
            [line.item_id, imei, lineId]
          );
          await db.execute(
            'INSERT INTO purchase_imei_lines (purchase_invoice_line_id, imei_unit_id) VALUES (?, ?)',
            [lineId, imeiResult.lastInsertId!]
          );
          console.log('[purchase:repo] IMEI inserted:', imei);
        }
      } else {
        await db.execute(
          `INSERT INTO stock (item_id, quantity, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + ?, updated_at = datetime('now')`,
          [line.item_id, line.quantity, line.quantity]
        );
        console.log(`[purchase:repo] stock upserted — item_id:${line.item_id} qty:${line.quantity}`);
      }
    }

    console.log('[purchase:repo] resolving account IDs for journal entry');
    const inventoryAccountId = await getAccountIdByCode(db, '1004');

    let supplierPayableAccountId: number | null = null;
    if (input.payment_type !== 'cash') {
      const supplierRows = await db.select<{ payable_account_id: number }[]>(
        'SELECT payable_account_id FROM suppliers WHERE id = ?',
        [input.supplier_id]
      );
      supplierPayableAccountId = supplierRows[0].payable_account_id;
      console.log('[purchase:repo] supplier payable account id:', supplierPayableAccountId);
    }

    const journalLines = [];
    journalLines.push({ account_id: inventoryAccountId, debit: totalAmount, credit: 0 });

    if (input.payment_type === 'cash') {
      const cashAccountId = await getAccountIdByCode(db, '1001');
      journalLines.push({ account_id: cashAccountId, debit: 0, credit: totalAmount });
    } else if (input.payment_type === 'credit') {
      journalLines.push({ account_id: supplierPayableAccountId!, debit: 0, credit: totalAmount });
    } else {
      const cashAccountId = await getAccountIdByCode(db, '1001');
      journalLines.push({ account_id: cashAccountId, debit: 0, credit: input.cash_amount });
      journalLines.push({ account_id: supplierPayableAccountId!, debit: 0, credit: input.credit_amount });
    }

    console.log('[purchase:repo] journal lines:', journalLines);

    await postJournalEntry(db, {
      date: input.invoice_date,
      reference_no: invoiceNo,
      narration: `Purchase invoice ${invoiceNo}`,
      source_type: 'purchase',
      source_id: invoiceId,
      lines: journalLines,
    });

    await db.execute('COMMIT', []);
    console.log('[purchase:repo] transaction committed');
    return invoiceId;
  } catch (err) {
    console.error('[purchase:repo] transaction failed, rolling back:', err);
    await db.execute('ROLLBACK', []);
    throw err;
  }
}

export async function getPurchaseInvoices(): Promise<PurchaseInvoiceRow[]> {
  const db = await getDb();
  return db.select<PurchaseInvoiceRow[]>(
    `SELECT pi.*, s.name as supplier_name
     FROM purchase_invoices pi
     JOIN suppliers s ON s.id = pi.supplier_id
     ORDER BY pi.created_at DESC`
  );
}

export async function getPurchaseInvoiceById(id: number): Promise<PurchaseInvoiceDetail | null> {
  const db = await getDb();

  const invoiceRows = await db.select<(PurchaseInvoiceRow)[]>(
    `SELECT pi.*, s.name as supplier_name
     FROM purchase_invoices pi
     JOIN suppliers s ON s.id = pi.supplier_id
     WHERE pi.id = ?`,
    [id]
  );
  if (invoiceRows.length === 0) return null;

  const lines = await db.select<Array<{
    id: number; purchase_invoice_id: number; item_id: number;
    quantity: number; rate: number; discount: number | null; total: number;
    item_name: string;
  }>>(
    `SELECT pil.*, i.name as item_name
     FROM purchase_invoice_lines pil
     JOIN items i ON i.id = pil.item_id
     WHERE pil.purchase_invoice_id = ?`,
    [id]
  );

  const linesWithImeis = await Promise.all(
    lines.map(async (line) => {
      const imeiRows = await db.select<{ imei: string }[]>(
        `SELECT iu.imei
         FROM purchase_imei_lines pil
         JOIN imei_units iu ON iu.id = pil.imei_unit_id
         WHERE pil.purchase_invoice_line_id = ?`,
        [line.id]
      );
      return { ...line, imeis: imeiRows.map((r) => r.imei) };
    })
  );

  return { ...invoiceRows[0], lines: linesWithImeis };
}
