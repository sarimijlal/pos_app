import { saveSalesReturn } from '@/db/repositories/sales';
import { useSalesStore } from '../store';
import type { SaveSalesReturnInput } from '../types';

export function useReturnSalesInvoice() {
  const { setSaving, setError } = useSalesStore();

  async function returnInvoice(input: SaveSalesReturnInput): Promise<number | null> {
    setSaving(true);
    setError(null);
    try {
      return await saveSalesReturn(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process return');
      return null;
    } finally {
      setSaving(false);
    }
  }

  return { returnInvoice };
}
