import type Database from '@tauri-apps/plugin-sql';

export interface JournalEntryLine {
  account_id: number;
  debit: number;
  credit: number;
}

export interface JournalEntryInput {
  date: string;
  reference_no: string;
  narration: string;
  source_type: 'purchase' | 'sale' | 'purchase_return' | 'sale_return';
  source_id: number;
  lines: JournalEntryLine[];
}

export async function postJournalEntry(db: Database, entry: JournalEntryInput): Promise<void> {
  const totalDebits  = entry.lines.reduce((s, l) => s + l.debit,  0);
  const totalCredits = entry.lines.reduce((s, l) => s + l.credit, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    throw new Error(
      `Unbalanced journal entry "${entry.reference_no}": debits ${totalDebits} ≠ credits ${totalCredits}`
    );
  }

  const result = await db.execute(
    `INSERT INTO journal_entries (date, reference_no, narration, source_type, source_id, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [entry.date, entry.reference_no, entry.narration, entry.source_type, entry.source_id]
  );

  const journalEntryId = result.lastInsertId!;

  for (const line of entry.lines) {
    await db.execute(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
       VALUES (?, ?, ?, ?)`,
      [journalEntryId, line.account_id, line.debit, line.credit]
    );
  }
}
