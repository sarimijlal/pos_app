import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSalesList } from '../hooks/useSalesList';
import { useSalesStore } from '../store';

export function SalesTable({ onNew }: { onNew: () => void }) {
  const { invoices, loading, error, reload } = useSalesList();
  const { setSelectedInvoiceId } = useSalesStore();

  if (loading) return <p className="p-4 text-muted-foreground">Loading…</p>;
  if (error)   return <p className="p-4 text-destructive">{error}</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sales Invoices</h2>
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
        <p className="py-8 text-center text-muted-foreground">No sales invoices yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Salesperson</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedInvoiceId(inv.id)}
              >
                <TableCell className="font-mono">{inv.invoice_no}</TableCell>
                <TableCell>{inv.date}</TableCell>
                <TableCell>{inv.customer_name}</TableCell>
                <TableCell className="capitalize">{inv.payment_mode}</TableCell>
                <TableCell>{inv.salesperson_name ?? '—'}</TableCell>
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
