import { saveSalesInvoice } from '@/db/repositories/sales';
import { useSalesStore } from '../store';
import type { SaveSalesInvoiceInput } from '../types';

export function useSaveSalesInvoice() {
  const { setSaving, setError } = useSalesStore();

  async function save(input: SaveSalesInvoiceInput): Promise<number | null> {
    console.log('[sales] save invoked', {
      customer_id: input.customer_id,
      payment_mode: input.payment_mode,
      lines: input.lines.map((l) => ({
        item_id: l.item_id,
        item_type: l.item_type,
        qty: l.quantity,
        sale_price: l.sale_price,
        total: l.total,
        imeis: l.imeis,
      })),
    });

    setSaving(true);
    setError(null);
    try {
      const id = await saveSalesInvoice(input);
      console.log('[sales] saved successfully, invoice id:', id);
      return id;
    } catch (err) {
      console.error('[sales] save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { save };
}
