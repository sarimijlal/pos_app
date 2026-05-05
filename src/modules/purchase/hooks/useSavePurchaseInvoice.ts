import { savePurchaseInvoice } from '@/db/repositories/purchase';
import { usePurchaseStore } from '../store';
import type { SavePurchaseInvoiceInput } from '../types';

export function useSavePurchaseInvoice() {
  const { setSaving, setError } = usePurchaseStore();

  async function save(input: SavePurchaseInvoiceInput): Promise<number | null> {
    setSaving(true);
    setError(null);
    try {
      const id = await savePurchaseInvoice(input);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { save };
}
