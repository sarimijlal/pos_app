import { useState, useEffect, useRef, useCallback } from 'react';
import type { Item } from '../../../../interfaces';
import type { MobileInventoryRow, AccessoryInventoryRow } from '../../inventory/types';
import { getItems, insertItem, updateItem, getInventoryMobiles, getInventoryAccessories } from '../../../db/repositories/inventory';
import { C } from '../../../lib/theme';

type FilterTab = 'all' | 'mobile' | 'accessory' | 'low';

type ItemDisplayRow = Item & {
  in_stock: number;
  sold: number;
  returned: number;
  total_purchased: number;
};

const th: React.CSSProperties = {
  padding: '9px 14px', background: 'var(--c-sidebar)',
  borderBottom: `1px solid ${C.line}`,
  fontSize: 10.5, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  whiteSpace: 'nowrap', textAlign: 'left',
};
const thR: React.CSSProperties = { ...th, textAlign: 'right' };

function isLow(row: ItemDisplayRow): boolean {
  return row.item_type === 'mobile' ? row.in_stock === 0 : row.in_stock < 5;
}

function fmt(n: number) {
  return n.toLocaleString('en-PK');
}

function StockStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(value)}</div>
    </div>
  );
}

function ItemRow({ row, idx, onEdit }: { row: ItemDisplayRow; idx: number; onEdit: (r: ItemDisplayRow) => void }) {
  const [hovered, setHovered] = useState(false);

  const isMobile = row.item_type === 'mobile';
  const stockColor = row.in_stock === 0 ? C.bad : (isMobile ? row.in_stock <= 2 : row.in_stock < 5) ? C.warn : C.ok;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--c-subtle)' : idx % 2 === 0 ? C.paper : 'var(--c-sidebar)', transition: 'background 80ms' }}
    >
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 13, color: C.ink, fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
          {hovered && (
            <button
              onClick={() => onEdit(row)}
              style={{
                flexShrink: 0, padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.line}`,
                background: C.paper, color: C.muted, fontSize: 11, cursor: 'pointer', fontWeight: 500,
              }}
            >
              Edit
            </button>
          )}
        </div>
      </td>
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}` }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4,
          fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          background: isMobile ? 'var(--c-accent-bg)' : 'var(--c-warn-bg)',
          color: isMobile ? C.accent : C.warn,
        }}>
          {isMobile ? 'Mobile' : 'Accessory'}
        </span>
      </td>
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: stockColor }}>
        {fmt(row.in_stock)}
      </td>
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: isMobile ? C.ink2 : C.muted2 }}>
        {isMobile ? fmt(row.sold) : '—'}
      </td>
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: isMobile ? C.ink2 : C.muted2 }}>
        {isMobile ? fmt(row.returned) : '—'}
      </td>
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: isMobile ? C.muted : C.muted2 }}>
        {isMobile ? fmt(row.total_purchased) : '—'}
      </td>
    </tr>
  );
}

export function ItemsMasterScreen() {
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [mobileRows, setMobileRows] = useState<MobileInventoryRow[]>([]);
  const [accessoryRows, setAccessoryRows] = useState<AccessoryInventoryRow[]>([]);

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'new' | 'edit'>('new');
  const [editId, setEditId] = useState<number | null>(null);
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<'mobile' | 'accessory'>('mobile');
  const [nameErr, setNameErr] = useState(false);
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelSaveErr, setPanelSaveErr] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoadState('loading');
    try {
      const [its, mobiles, accessories] = await Promise.all([
        getItems(),
        getInventoryMobiles(),
        getInventoryAccessories(),
      ]);
      setItems(its);
      setMobileRows(mobiles);
      setAccessoryRows(accessories);
      setLoadState('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const displayRows: ItemDisplayRow[] = items.map(item => {
    if (item.item_type === 'mobile') {
      const m = mobileRows.find(r => r.id === item.id);
      return { ...item, in_stock: m?.in_stock ?? 0, sold: m?.sold ?? 0, returned: m?.returned ?? 0, total_purchased: m?.total ?? 0 };
    }
    const a = accessoryRows.find(r => r.id === item.id);
    return { ...item, in_stock: a?.quantity ?? 0, sold: 0, returned: 0, total_purchased: 0 };
  });

  const filtered = displayRows
    .filter(r => filterTab === 'mobile' ? r.item_type === 'mobile' : filterTab === 'accessory' ? r.item_type === 'accessory' : filterTab === 'low' ? isLow(r) : true)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  const totalItems    = displayRows.length;
  const mobileCount   = displayRows.filter(r => r.item_type === 'mobile').length;
  const accessoryCount= displayRows.filter(r => r.item_type === 'accessory').length;
  const lowCount      = displayRows.filter(isLow).length;

  const editRow = editId !== null ? displayRows.find(r => r.id === editId) : undefined;

  function openNew() {
    setFName(''); setFType('mobile');
    setNameErr(false); setPanelSaveErr('');
    setPanelMode('new'); setEditId(null);
    setPanelOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 80);
  }

  function openEdit(row: ItemDisplayRow) {
    setFName(row.name); setFType(row.item_type);
    setNameErr(false); setPanelSaveErr('');
    setPanelMode('edit'); setEditId(row.id);
    setPanelOpen(true);
    setTimeout(() => nameInputRef.current?.focus(), 80);
  }

  async function handleSave() {
    if (!fName.trim()) { setNameErr(true); nameInputRef.current?.focus(); return; }
    setPanelSaving(true); setPanelSaveErr('');
    try {
      if (panelMode === 'new') {
        await insertItem({ name: fName.trim(), item_type: fType });
      } else if (editId !== null) {
        await updateItem({ id: editId, name: fName.trim() });
      }
      setPanelOpen(false);
      await loadAll();
    } catch (e) {
      setPanelSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelSaving(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
        Loading items…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ color: C.bad, fontSize: 13 }}>{errorMsg || 'Failed to load items.'}</span>
        <button
          onClick={loadAll}
          style={{ fontSize: 12, padding: '6px 16px', borderRadius: 5, border: `1px solid ${C.line}`, background: C.subtle, color: C.ink, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const tabLabels: Record<FilterTab, string> = { all: 'All', mobile: 'Mobiles', accessory: 'Accessories', low: 'Low / Out' };
  const tabCounts: Record<FilterTab, number> = { all: totalItems, mobile: mobileCount, accessory: accessoryCount, low: lowCount };
  const activeType = panelMode === 'new' ? fType : (editRow?.item_type ?? 'mobile');

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 16, padding: '2px 0' }}>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12 }}>
          {([
            { label: 'Total Items',       value: totalItems,    color: C.ink },
            { label: 'Mobiles',           value: mobileCount,   color: C.accent },
            { label: 'Accessories',       value: accessoryCount,color: C.warn },
            { label: 'Low / Out of Stock',value: lowCount,      color: C.bad },
          ] as const).map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, padding: '14px 18px', borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--c-subtle)', borderRadius: 6, padding: 3, border: `1px solid ${C.line}` }}>
            {(['all', 'mobile', 'accessory', 'low'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500,
                  background: filterTab === tab ? C.paper : 'transparent',
                  color: filterTab === tab ? C.ink : C.muted,
                  boxShadow: filterTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 100ms',
                }}
              >
                {tabLabels[tab]}
                <span style={{ marginLeft: 5, fontSize: 10.5, color: filterTab === tab ? C.muted : C.muted2 }}>
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5"/><path d="M11 11l2.5 2.5"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 10, height: 32,
                border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5, boxSizing: 'border-box',
                background: C.paper, color: C.ink, outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={openNew}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 6, border: 'none',
              background: C.accent, color: C.accentFg,
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 1v10M1 6h10"/>
            </svg>
            Add Item
          </button>
        </div>

        {/* Table */}
        <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'auto', background: C.paper }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Item Name</th>
                <th style={th}>Type</th>
                <th style={thR}>In Stock</th>
                <th style={thR}>Sold</th>
                <th style={thR}>Returned</th>
                <th style={thR}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    {search ? 'No items match your search.' : filterTab !== 'all' ? 'No items in this category.' : 'No items yet. Add your first item.'}
                  </td>
                </tr>
              ) : filtered.map((row, i) => (
                <ItemRow key={row.id} row={row} idx={i} onEdit={openEdit} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overlay */}
      {panelOpen && (
        <div
          onClick={() => !panelSaving && setPanelOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--c-overlay)', zIndex: 40 }}
        />
      )}

      {/* Side panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
        background: C.paper, borderLeft: `1px solid ${C.line}`,
        display: 'flex', flexDirection: 'column', zIndex: 50,
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Panel header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
              {panelMode === 'new' ? 'Add Item' : 'Edit Item'}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
              {panelMode === 'new' ? 'Create a new inventory item' : `Item #${editId}`}
            </div>
          </div>
          <button
            onClick={() => !panelSaving && setPanelOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 4, border: `1px solid ${C.line}`,
              background: 'var(--c-subtle)', cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', color: C.muted,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stock card — edit mode only */}
          {panelMode === 'edit' && editRow && (
            <div style={{ padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'var(--c-sidebar)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                Current Stock
              </div>
              {editRow.item_type === 'mobile' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <StockStat label="In Stock" value={editRow.in_stock}
                    color={editRow.in_stock === 0 ? C.bad : editRow.in_stock <= 2 ? C.warn : C.ok} />
                  <StockStat label="Sold" value={editRow.sold} color={C.muted} />
                  <StockStat label="Returned" value={editRow.returned} color={C.muted} />
                  <StockStat label="Total Purchased" value={editRow.total_purchased} color={C.ink2} />
                </div>
              ) : (
                <StockStat label="Quantity" value={editRow.in_stock}
                  color={editRow.in_stock === 0 ? C.bad : editRow.in_stock < 5 ? C.warn : C.ok} />
              )}
            </div>
          )}

          {/* Name field */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              Item Name <span style={{ color: C.bad }}>*</span>
            </label>
            <input
              ref={nameInputRef}
              value={fName}
              onChange={e => { setFName(e.target.value); if (nameErr) setNameErr(false); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. iPhone 15 Pro Max"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                border: `1px solid ${nameErr ? C.bad : C.line}`,
                background: C.paper, color: C.ink, outline: 'none',
                boxShadow: nameErr ? '0 0 0 3px var(--c-bad-bg)' : undefined,
              }}
            />
            {nameErr && <div style={{ fontSize: 11, color: C.bad, marginTop: 4 }}>Name is required.</div>}
          </div>

          {/* Item type */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
              Item Type
            </label>
            {panelMode === 'new' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {(['mobile', 'accessory'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFType(t)}
                    style={{
                      flex: 1, padding: '10px 10px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 600, transition: 'all 120ms',
                      border: `1.5px solid ${fType === t ? C.accent : C.line}`,
                      background: fType === t ? 'var(--c-accent-bg)' : 'var(--c-subtle)',
                      color: fType === t ? C.accent : C.muted,
                    }}
                  >
                    {t === 'mobile' ? 'Mobile' : 'Accessory'}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                borderRadius: 6, border: `1px solid ${C.line}`, background: 'var(--c-subtle)',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4,
                  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: fType === 'mobile' ? 'var(--c-accent-bg)' : 'var(--c-warn-bg)',
                  color: fType === 'mobile' ? C.accent : C.warn,
                }}>
                  {fType === 'mobile' ? 'Mobile' : 'Accessory'}
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>Cannot be changed after creation.</span>
              </div>
            )}
          </div>

          {/* Accounting meta */}
          <div style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'var(--c-sidebar)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Accounting</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: C.muted }}>Posts to</span>
              <span style={{ fontWeight: 600, color: C.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>1004 · Inventory</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.muted }}>Tracking</span>
              <span style={{ fontWeight: 500, color: C.ink2, fontSize: 11 }}>
                {activeType === 'mobile' ? 'IMEI tracking' : 'Quantity tracking'}
              </span>
            </div>
          </div>

          {panelSaveErr && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--c-bad-bg)', color: C.bad, fontSize: 12 }}>
              {panelSaveErr}
            </div>
          )}
        </div>

        {/* Panel footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8, background: C.paper }}>
          <button
            onClick={() => !panelSaving && setPanelOpen(false)}
            style={{
              flex: 1, padding: '9px 10px', borderRadius: 6,
              border: `1px solid ${C.line}`, background: 'var(--c-subtle)',
              color: C.ink, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={panelSaving}
            style={{
              flex: 2, padding: '9px 10px', borderRadius: 6, border: 'none',
              background: C.accent, color: C.accentFg,
              fontSize: 13, fontWeight: 600,
              cursor: panelSaving ? 'not-allowed' : 'pointer',
              opacity: panelSaving ? 0.7 : 1,
            }}
          >
            {panelSaving ? 'Saving…' : panelMode === 'new' ? 'Add Item' : 'Save Changes'}
          </button>
        </div>
      </aside>
    </>
  );
}
