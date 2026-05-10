import { savePurchaseReturn } from '@/db/repositories/purchase';
import { usePurchaseStore } from '../store';
import type { SavePurchaseReturnInput } from '../types';

export function useReturnPurchaseInvoice() {
  const { setSaving, setError } = usePurchaseStore();

  async function returnInvoice(input: SavePurchaseReturnInput): Promise<number | null> {
    setSaving(true);
    setError(null);
    try {
      return await savePurchaseReturn(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { returnInvoice };
}
