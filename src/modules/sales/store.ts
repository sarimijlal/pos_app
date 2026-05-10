import { create } from 'zustand';

interface SalesStore {
  saving: boolean;
  error: string | null;
  selectedInvoiceId: number | null;
  setSaving: (v: boolean) => void;
  setError: (v: string | null) => void;
  setSelectedInvoiceId: (id: number | null) => void;
}

export const useSalesStore = create<SalesStore>((set) => ({
  saving: false,
  error: null,
  selectedInvoiceId: null,
  setSaving: (v) => set({ saving: v }),
  setError: (v) => set({ error: v }),
  setSelectedInvoiceId: (id) => set({ selectedInvoiceId: id }),
}));
