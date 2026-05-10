import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCustomers } from '@/db/repositories/accounting';
import { getItems } from '@/db/repositories/inventory';
import { getSalespersons, getAvailableImeis } from '@/db/repositories/sales';
import { useSaveSalesInvoice } from '../hooks/useSaveSalesInvoice';
import { useSalesStore } from '../store';
import type { Customer, Item, Salesperson } from '../../../../interfaces';
import type { SalesLineInput } from '../types';

interface LineState extends SalesLineInput {
  availableImeis: string[];
  loadingImeis: boolean;
}

const EMPTY_LINE = (): LineState => ({
  item_id: 0,
  item_type: 'accessory',
  item_name: '',
  quantity: 0,
  sale_price: 0,
  discount: 0,
  total: 0,
  imeis: [],
  availableImeis: [],
  loadingImeis: false,
});

export function SalesForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { saving, error } = useSalesStore();
  const { save } = useSaveSalesInvoice();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'card' | 'bank'>('cash');
  const [salespersonId, setSalespersonId] = useState('');
  const [lines, setLines] = useState<LineState[]>([EMPTY_LINE()]);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
    getItems().then(setItems).catch(console.error);
    getSalespersons().then(setSalespersons).catch(console.error);
  }, []);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      if (updated.item_type === 'mobile') {
        updated.quantity = updated.imeis.length;
      }
      updated.total = Math.max(0, updated.quantity * updated.sale_price - updated.discount);
      next[index] = updated;
      return next;
    });
  }

  async function selectItem(index: number, itemId: string) {
    const item = items.find((i) => i.id === Number(itemId));
    if (!item) return;

    updateLine(index, {
      item_id: item.id,
      item_type: item.item_type,
      item_name: item.name,
      imeis: [],
      quantity: item.item_type === 'accessory' ? 1 : 0,
      sale_price: 0,
      discount: 0,
      total: 0,
      availableImeis: [],
      loadingImeis: item.item_type === 'mobile',
    });

    if (item.item_type === 'mobile') {
      try {
        const avail = await getAvailableImeis(item.id);
        setLines((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], availableImeis: avail, loadingImeis: false };
          return next;
        });
      } catch {
        setLines((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], loadingImeis: false };
          return next;
        });
      }
    }
  }

  function toggleImei(lineIndex: number, imei: string) {
    setLines((prev) => {
      const next = [...prev];
      const line = next[lineIndex];
      const imeis = line.imeis.includes(imei)
        ? line.imeis.filter((x) => x !== imei)
        : [...line.imeis, imei];
      const quantity = imeis.length;
      next[lineIndex] = {
        ...line,
        imeis,
        quantity,
        total: Math.max(0, quantity * line.sale_price - line.discount),
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
    if (!customerId) return;
    if (lines.some((l) => l.item_id === 0)) return;
    if (lines.some((l) => l.item_type === 'mobile' && l.imeis.length === 0)) {
      alert('Select at least one IMEI for each mobile item.');
      return;
    }
    if (lines.some((l) => l.item_type === 'accessory' && (l.quantity <= 0 || l.sale_price <= 0))) {
      alert('Accessory lines require quantity > 0 and sale price > 0.');
      return;
    }

    const saveLines: SalesLineInput[] = lines.map(
      ({ availableImeis: _a, loadingImeis: _l, ...rest }) => rest,
    );

    const id = await save({
      customer_id: Number(customerId),
      invoice_date: invoiceDate,
      payment_mode: paymentMode,
      salesperson_id: salespersonId ? Number(salespersonId) : null,
      lines: saveLines,
    });

    if (id !== null) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold">New Sales Invoice</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={(v) => { if (v) setCustomerId(v); }} required>
            <SelectTrigger>
              <SelectValue placeholder="Select customer…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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
          <Label>Payment Mode</Label>
          <Select
            value={paymentMode}
            onValueChange={(v) => { if (v) setPaymentMode(v as typeof paymentMode); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            Salesperson{' '}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Select value={salespersonId} onValueChange={(v) => setSalespersonId(!v || v === '__none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {salespersons.map((sp) => (
                <SelectItem key={sp.id} value={String(sp.id)}>{sp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Items</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((p) => [...p, EMPTY_LINE()])}
          >
            + Add Line
          </Button>
        </div>

        {lines.map((line, i) => (
          <div key={i} className="rounded border p-3 space-y-3">
            <div className="grid grid-cols-4 gap-2 items-end">
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

              {line.item_type === 'accessory' && (
                <>
                  <div className="space-y-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Sale Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={line.sale_price || ''}
                      onChange={(e) => updateLine(i, { sale_price: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}

              {line.item_type === 'mobile' && line.item_id !== 0 && (
                <div className="space-y-1">
                  <Label>Sale Price</Label>
                  <Input
                    type="number"
                    min="0"
                    value={line.sale_price || ''}
                    onChange={(e) => updateLine(i, { sale_price: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 items-center">
              <div className="space-y-1">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min="0"
                  value={line.discount || ''}
                  onChange={(e) => updateLine(i, { discount: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {line.item_type === 'mobile'
                    ? `${line.imeis.length} unit(s) selected`
                    : `Qty: ${line.quantity}`}
                  {' · '}Line total:{' '}
                  <strong>{line.total.toLocaleString()}</strong>
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-sm text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {line.item_type === 'mobile' && line.item_id !== 0 && (
              <div className="space-y-2 border-t pt-2">
                {line.loadingImeis ? (
                  <p className="text-xs text-muted-foreground">Loading available IMEIs…</p>
                ) : line.availableImeis.length === 0 ? (
                  <p className="text-xs text-destructive">No in-stock IMEIs for this item.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Select IMEIs — {line.imeis.length} selected of {line.availableImeis.length} available
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {line.availableImeis.map((imei) => (
                        <Badge
                          key={imei}
                          variant={line.imeis.includes(imei) ? 'default' : 'outline'}
                          className="cursor-pointer select-none font-mono text-xs"
                          onClick={() => toggleImei(i, imei)}
                        >
                          {imei}
                        </Badge>
                      ))}
                    </div>
                  </>
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
