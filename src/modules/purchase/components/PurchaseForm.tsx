import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSuppliers } from '@/db/repositories/accounting';
import { getItems } from '@/db/repositories/inventory';
import { useSavePurchaseInvoice } from '../hooks/useSavePurchaseInvoice';
import { usePurchaseStore } from '../store';
import type { Supplier, Item } from '../../../../interfaces';
import type { PurchaseLineInput } from '../types';

const EMPTY_LINE = (): PurchaseLineInput => ({
  item_id: 0,
  item_type: 'accessory',
  item_name: '',
  quantity: 1,
  rate: 0,
  discount: 0,
  total: 0,
  imeis: [],
});

export function PurchaseForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { saving, error } = usePurchaseStore();
  const { save } = useSavePurchaseInvoice();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<PurchaseLineInput[]>([EMPTY_LINE()]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, []);

  function updateLine(index: number, patch: Partial<PurchaseLineInput>) {
    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      updated.total = updated.quantity * updated.rate - updated.discount;
      if (updated.total < 0) updated.total = 0;
      next[index] = updated;
      return next;
    });
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((i) => i.id === Number(itemId));
    if (!item) return;
    updateLine(index, {
      item_id: item.id,
      item_type: item.item_type,
      item_name: item.name,
      imeis: [],
    });
  }

  function addImei(lineIndex: number, imei: string) {
    if (!imei.trim()) return;
    setLines((prev) => {
      const next = [...prev];
      next[lineIndex] = {
        ...next[lineIndex],
        imeis: [...next[lineIndex].imeis, imei.trim()],
      };
      return next;
    });
  }

  function removeImei(lineIndex: number, imeiIndex: number) {
    setLines((prev) => {
      const next = [...prev];
      next[lineIndex] = {
        ...next[lineIndex],
        imeis: next[lineIndex].imeis.filter((_, i) => i !== imeiIndex),
      };
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalAmount = lines.reduce((s, l) => s + l.total, 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplierId) return;
    if (lines.some((l) => l.item_id === 0)) return;
    if (lines.some((l) => l.item_type === 'mobile' && l.imeis.length !== l.quantity)) {
      alert('Number of IMEIs must match quantity for each mobile line.');
      return;
    }
    if (paymentType === 'partial') {
      const cash = Number(cashAmount);
      const credit = Number(creditAmount);
      if (Math.abs(cash + credit - totalAmount) > 0.01) {
        alert('Cash + credit amounts must equal total.');
        return;
      }
    }

    const id = await save({
      supplier_id: Number(supplierId),
      invoice_date: invoiceDate,
      payment_type: paymentType,
      cash_amount: paymentType === 'partial' ? Number(cashAmount) : totalAmount,
      credit_amount: paymentType === 'partial' ? Number(creditAmount) : totalAmount,
      remarks,
      lines,
    });

    if (id !== null) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold">New Purchase Invoice</h2>

      {/* Header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={(v) => { if (v) setSupplierId(v); }} required>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier…" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Invoice Date</Label>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <Label>Payment Type</Label>
          <Select
            value={paymentType}
            onValueChange={(v) => { if (v) setPaymentType(v as typeof paymentType); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Remarks</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>

      {/* Partial payment amounts */}
      {paymentType === 'partial' && (
        <div className="grid grid-cols-2 gap-4 rounded border p-4">
          <div className="space-y-1">
            <Label>Cash Paid</Label>
            <Input
              type="number"
              min="0"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Credit (Owed)</Label>
            <Input
              type="number"
              min="0"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <Separator />

      {/* Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, EMPTY_LINE()])}>
            + Add Line
          </Button>
        </div>

        {lines.map((line, i) => (
          <div key={i} className="rounded border p-3 space-y-3">
            <div className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2 space-y-1">
                <Label>Item</Label>
                <Select
                  value={line.item_id ? String(line.item_id) : ''}
                  onValueChange={(v) => { if (v) selectItem(i, v); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select item…" /></SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} ({item.item_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label>Rate</Label>
                <Input
                  type="number"
                  min="0"
                  value={line.rate}
                  onChange={(e) => updateLine(i, { rate: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min="0"
                  value={line.discount}
                  onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Line total: <strong>{line.total.toLocaleString()}</strong>
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {/* IMEI inputs for mobile items */}
            {line.item_type === 'mobile' && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  IMEIs ({line.imeis.length}/{line.quantity} entered)
                </p>
                {line.imeis.map((imei, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="font-mono text-sm flex-1">{imei}</span>
                    <button
                      type="button"
                      onClick={() => removeImei(i, j)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {line.imeis.length < line.quantity && (
                  <ImeiInput onAdd={(imei) => addImei(i, imei)} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">
          Total: {totalAmount.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Invoice'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

function ImeiInput({ onAdd }: { onAdd: (imei: string) => void }) {
  const [value, setValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        onAdd(value.trim());
        setValue('');
      }
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        className="font-mono"
        placeholder="Enter IMEI and press Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); } }}
      >
        Add
      </Button>
    </div>
  );
}
