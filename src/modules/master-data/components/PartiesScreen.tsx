import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSuppliers } from '../hooks/useSuppliers';
import { useCustomers } from '../hooks/useCustomers';
import { useSalespersons } from '../hooks/useSalespersons';

export function PartiesScreen() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Master Data — Parties</h2>
      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="salespersons">Salespersons</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="salespersons"><SalespersonsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

function SuppliersTab() {
  const { suppliers, loading, error, add } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await add({ name, phone: phone || undefined, address: address || undefined });
      setName(''); setPhone(''); setAddress('');
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : '+ Add Supplier'}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Supplier'}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suppliers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No suppliers yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone ?? '—'}</TableCell>
                <TableCell>{s.address ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Customers ────────────────────────────────────────────────────────────────

function CustomersTab() {
  const { customers, loading, error, add } = useCustomers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await add({ name, phone: phone || undefined });
      setName(''); setPhone('');
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : '+ Add Customer'}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Customer'}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No customers yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Salespersons ─────────────────────────────────────────────────────────────

function SalespersonsTab() {
  const { salespersons, loading, error, add } = useSalespersons();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await add({ name });
      setName('');
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : '+ Add Salesperson'}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3">
          <div className="w-64 space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Salesperson'}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : salespersons.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No salespersons yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salespersons.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
