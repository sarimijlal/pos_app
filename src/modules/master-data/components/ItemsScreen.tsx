import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItems } from '../hooks/useItems';

export function ItemsScreen() {
  const { items, loading, error, add } = useItems();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'mobile' | 'accessory'>('mobile');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await add({ name, item_type: itemType });
      setName('');
      setItemType('mobile');
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Master Data — Items</h2>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : '+ Add Item'}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Item Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Samsung Galaxy S24"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select
                value={itemType}
                onValueChange={(v) => { if (v) setItemType(v as typeof itemType); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">Mobile (IMEI tracked)</SelectItem>
                  <SelectItem value="accessory">Accessory (quantity tracked)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save Item'}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground p-4">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant={item.item_type === 'mobile' ? 'default' : 'secondary'}>
                    {item.item_type}
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
