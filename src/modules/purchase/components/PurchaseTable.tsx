import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { usePurchaseList } from '../hooks/usePurchaseList';
import { usePurchaseStore } from '../store';

export function PurchaseTable({ onNew, onSelect }: { onNew: () => void; onSelect?: () => void }) {
  const { invoices, loading, error, reload } = usePurchaseList();
  const { setSelectedInvoiceId } = usePurchaseStore();

  if (loading) return <p className="p-4 text-muted-foreground">Loading…</p>;
  if (error)   return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Purchase Invoices</h2>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
          <button
            onClick={onNew}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            + New Invoice
          </button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No purchase invoices yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => { setSelectedInvoiceId(inv.id); onSelect?.(); }}
              >
                <TableCell className="font-mono">{inv.invoice_no}</TableCell>
                <TableCell>{inv.invoice_date}</TableCell>
                <TableCell>{inv.supplier_name}</TableCell>
                <TableCell className="capitalize">{inv.payment_type}</TableCell>
                <TableCell className="text-right font-mono">
                  {inv.total_amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={inv.status === 'active' ? 'default' : 'secondary'}>
                    {inv.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
