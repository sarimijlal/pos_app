import { savePurchaseInvoice } from '@/db/repositories/purchase';
import { usePurchaseStore } from '../store';
import type { SavePurchaseInvoiceInput } from '../types';

export function useSavePurchaseInvoice() {
  const { setSaving, setError } = usePurchaseStore();

  async function save(input: SavePurchaseInvoiceInput): Promise<number | null> {
    console.log('[purchase] save invoked', {
      supplier_id: input.supplier_id,
      payment_type: input.payment_type,
      cash_amount: input.cash_amount,
      credit_amount: input.credit_amount,
      lines: input.lines.map((l) => ({
        item_id: l.item_id,
        item_type: l.item_type,
        qty: l.quantity,
        rate: l.rate,
        total: l.total,
        imeis: l.imeis,
      })),
    });

    setSaving(true);
    setError(null);
    try {
      const id = await savePurchaseInvoice(input);
      console.log('[purchase] saved successfully, invoice id:', id);
      return id;
    } catch (err) {
      console.error('[purchase] save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { save };
}
