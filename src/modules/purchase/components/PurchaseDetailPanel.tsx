import { useState, useEffect } from 'react';
import { getPurchaseInvoiceById } from '@/db/repositories/purchase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { usePurchaseStore } from '../store';
import { useReturnPurchaseInvoice } from '../hooks/useReturnPurchaseInvoice';
import type { PurchaseInvoiceDetail, PurchaseReturnLineInput } from '../types';

export function PurchaseDetailPanel({
  onClose,
  onReturned,
}: {
  onClose: () => void;
  onReturned: () => void;
}) {
  const { selectedInvoiceId, saving, error } = usePurchaseStore();
  const { returnInvoice } = useReturnPurchaseInvoice();

  const [detail, setDetail] = useState<PurchaseInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [accessoryQtys, setAccessoryQtys] = useState<Record<number, number>>({});
  const [selectedImeis, setSelectedImeis] = useState<Record<number, Set<string>>>({});

  useEffect(() => {
    if (!selectedInvoiceId) return;
    setLoading(true);
    setFetchError(null);
    getPurchaseInvoiceById(selectedInvoiceId)
      .then((d) => {
        setDetail(d);
        setLoading(false);
      })
      .catch((e) => {
        setFetchError(e instanceof Error ? e.message : 'Failed to load invoice');
        setLoading(false);
      });
  }, [selectedInvoiceId]);

  async function reload() {
    if (!selectedInvoiceId) return;
    const d = await getPurchaseInvoiceById(selectedInvoiceId).catch(() => null);
    setDetail(d);
  }

  function toggleLine(lineId: number) {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  }

  function toggleImei(lineId: number, imei: string) {
    setSelectedImeis((prev) => {
      const lineSet = new Set(prev[lineId] ?? []);
      if (lineSet.has(imei)) {
        lineSet.delete(imei);
      } else {
        lineSet.add(imei);
      }
      return { ...prev, [lineId]: lineSet };
    });
  }

  function getReturnTotal(): number {
    if (!detail) return 0;
    return detail.lines
      .filter((l) => selectedLines.has(l.id))
      .reduce((sum, l) => {
        const isMobile = (selectedImeis[l.id]?.size ?? 0) > 0 || l.imeis.length > 0;
        const qty = isMobile
          ? (selectedImeis[l.id]?.size ?? 0)
          : (accessoryQtys[l.id] ?? 0);
        return sum + l.rate * qty;
      }, 0);
  }

  async function handleSubmit() {
    if (!detail) return;

    const lines: PurchaseReturnLineInput[] = detail.lines
      .filter((l) => selectedLines.has(l.id))
      .map((l) => {
        const isMobile = l.imeis.length > 0;
        return {
          purchase_invoice_line_id: l.id,
          quantity_returned: isMobile ? 0 : (accessoryQtys[l.id] ?? 0),
          imeis: isMobile ? Array.from(selectedImeis[l.id] ?? []) : [],
        };
      })
      .filter((l) => l.imeis.length > 0 || l.quantity_returned > 0);

    if (lines.length === 0) return;

    const id = await returnInvoice({
      original_invoice_id: detail.id,
      return_date: returnDate,
      remarks: remarks || undefined,
      lines,
    });

    if (id !== null) {
      await reload();
      // If invoice is now fully returned, go back to list
      const refreshed = await getPurchaseInvoiceById(detail.id).catch(() => null);
      if (refreshed?.status === 'returned') {
        onReturned();
      } else {
        // Reset selections
        setSelectedLines(new Set());
        setSelectedImeis({});
        setAccessoryQtys({});
      }
    }
  }

  if (loading) return <p className="p-4 text-muted-foreground">Loading…</p>;
  if (fetchError) return <p className="p-4 text-destructive">{fetchError}</p>;
  if (!detail) return <p className="p-4 text-muted-foreground">Invoice not found.</p>;

  const canReturn = detail.status === 'active';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold font-mono">{detail.invoice_no}</h2>
          <p className="text-sm text-muted-foreground">
            {detail.supplier_name} · {detail.invoice_date} · {detail.payment_type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={detail.status === 'active' ? 'default' : 'secondary'}>
            {detail.status}
          </Badge>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <p>{line.item_name}</p>
                  {line.imeis.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {line.imeis.map((d) => (
                        <Badge
                          key={d.imei}
                          variant={
                            d.status === 'in_stock'
                              ? 'default'
                              : d.status === 'sold'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="font-mono text-xs"
                        >
                          {d.imei} · {d.status}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right font-mono">{line.rate.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">{line.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td colSpan={3} className="px-3 py-2 font-semibold text-right">Total</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {detail.total_amount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canReturn && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-medium">Process Return</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Return Date</Label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Remarks <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for return…"
                />
              </div>
            </div>

            <div className="space-y-3">
              {detail.lines.map((line) => {
                const isMobile = line.imeis.length > 0;
                const inStockImeis = line.imeis.filter((d) => d.status === 'in_stock');
                const isChecked = selectedLines.has(line.id);

                return (
                  <div key={line.id} className="rounded border p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLine(line.id)}
                        disabled={isMobile && inStockImeis.length === 0}
                      />
                      <span className="font-medium text-sm">{line.item_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {isMobile ? `${inStockImeis.length} returnable IMEI(s)` : `qty ${line.quantity}`}
                      </span>
                    </label>

                    {isChecked && isMobile && (
                      <div className="ml-6 flex flex-wrap gap-1.5">
                        {line.imeis.map((d) => {
                          const eligible = d.status === 'in_stock';
                          const checked = selectedImeis[line.id]?.has(d.imei) ?? false;
                          return (
                            <Badge
                              key={d.imei}
                              variant={checked ? 'default' : eligible ? 'outline' : 'secondary'}
                              className={`font-mono text-xs ${eligible ? 'cursor-pointer select-none' : 'opacity-40'}`}
                              onClick={() => eligible && toggleImei(line.id, d.imei)}
                            >
                              {d.imei}
                              {!eligible && ` (${d.status})`}
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {isChecked && !isMobile && (
                      <div className="ml-6 flex items-center gap-2">
                        <Label className="text-xs">Qty to return</Label>
                        <Input
                          type="number"
                          min={1}
                          max={line.quantity}
                          value={accessoryQtys[line.id] ?? 1}
                          onChange={(e) =>
                            setAccessoryQtys((prev) => ({
                              ...prev,
                              [line.id]: Math.min(line.quantity, Math.max(1, Number(e.target.value))),
                            }))
                          }
                          className="w-20 h-7 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">of {line.quantity}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Return total: <span className="font-mono">{getReturnTotal().toLocaleString()}</span>
              </p>
              <Button
                onClick={handleSubmit}
                disabled={saving || selectedLines.size === 0}
              >
                {saving ? 'Processing…' : 'Process Return'}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
