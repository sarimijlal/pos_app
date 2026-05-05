import { create } from 'zustand';

type PurchaseUIState = {
  saving: boolean;
  error: string | null;
  selectedInvoiceId: number | null;
  setSelectedInvoiceId: (id: number | null) => void;
  setSaving: (v: boolean) => void;
  setError: (msg: string | null) => void;
};

export const usePurchaseStore = create<PurchaseUIState>((set) => ({
  saving: false,
  error: null,
  selectedInvoiceId: null,
  setSelectedInvoiceId: (id) => set({ selectedInvoiceId: id }),
  setSaving: (v) => set({ saving: v }),
  setError: (msg) => set({ error: msg }),
}));
