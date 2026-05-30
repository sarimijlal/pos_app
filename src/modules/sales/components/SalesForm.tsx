import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getCustomers, insertCustomer } from '@/db/repositories/accounting';
import { getItems, getInventoryAccessories } from '@/db/repositories/inventory';
import { getSalespersons, getAvailableImeis } from '@/db/repositories/sales';
import { useSaveSalesInvoice } from '../hooks/useSaveSalesInvoice';
import { useSalesStore } from '../store';
import type { Customer, Item, Salesperson } from '../../../../interfaces';
import type { SalesLineInput } from '../types';

import { C } from '../../../lib/theme';

function fmtNum(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Kbd({ children }: { children: string }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.ink2, border: `1px solid ${C.line2}`, borderRadius: 3, padding: '0 4px', background: C.paper }}>
      {children}
    </span>
  );
}

// ── Line state ────────────────────────────────────────────────────────────────
interface LineState extends SalesLineInput {
  availableImeis: string[];
  loadingImeis: boolean;
  imeiCellOpen: boolean;
  imeiSearch: string;
  stockQty: number;
}

function emptyLine(): LineState {
  return {
    item_id: 0, item_type: 'accessory', item_name: '',
    quantity: 0, sale_price: 0, discount: 0, total: 0, imeis: [],
    availableImeis: [], loadingImeis: false,
    imeiCellOpen: false, imeiSearch: '', stockQty: 0,
  };
}

// ── LineRow ───────────────────────────────────────────────────────────────────
interface LineRowProps {
  rowNum: number;
  line: LineState;
  items: Item[];
  onPickItem: (item: Item) => void;
  onPatch: (patch: Partial<LineState>) => void;
  onAddImei: (imei: string) => void;
  onRemoveImei: (imei: string) => void;
  onRemove: () => void;
}

function LineRow({ rowNum, line, items, onPickItem, onPatch, onAddImei, onRemoveImei, onRemove }: LineRowProps) {
  const [rowHovered, setRowHovered] = useState(false);
  const [itemPopOpen, setItemPopOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemPopPos, setItemPopPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [imeiPopPos, setImeiPopPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const itemComboRef = useRef<HTMLDivElement>(null);
  const imeiCellRef = useRef<HTMLDivElement>(null);
  const imeiInputRef = useRef<HTMLInputElement>(null);

  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (itemComboRef.current && !itemComboRef.current.contains(e.target as Node)) {
        setItemPopOpen(false);
      }
      if (imeiCellRef.current && !imeiCellRef.current.contains(e.target as Node)) {
        onPatchRef.current({ imeiCellOpen: false });
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useLayoutEffect(() => {
    if (line.imeiCellOpen && imeiCellRef.current) {
      const r = imeiCellRef.current.getBoundingClientRect();
      setImeiPopPos({ top: r.bottom + 2, left: r.left, width: Math.max(320, r.width) });
    }
  }, [line.imeiCellOpen, line.imeis.length]);

  const isEmpty = line.item_id === 0;
  const filteredItems = items.filter(it => !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase()));
  const filteredAvail = line.availableImeis.filter(im => !line.imeiSearch || im.includes(line.imeiSearch));

  const tdBg = rowHovered && !isEmpty ? 'var(--c-subtle)' : C.paper;
  const td: React.CSSProperties = { padding: 0, borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle', position: 'relative', background: tdBg };
  const cellIn: React.CSSProperties = { width: '100%', height: 44, border: 0, outline: 0, background: 'transparent', padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: C.ink };

  return (
    <tr onMouseEnter={() => setRowHovered(true)} onMouseLeave={() => setRowHovered(false)}>

      {/* # */}
      <td style={{ ...td, textAlign: 'center', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {rowNum}
      </td>

      {/* Item combo */}
      <td style={td}>
        <div ref={itemComboRef} style={{ position: 'relative', height: 44 }}>
          <div
            onClick={() => {
              if (!itemPopOpen) {
                if (itemComboRef.current) {
                  const r = itemComboRef.current.getBoundingClientRect();
                  setItemPopPos({ top: r.bottom + 2, left: r.left, width: Math.max(280, r.width) });
                }
                setItemPopOpen(true);
                setItemSearch('');
              }
            }}
            style={{ height: 44, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, background: itemPopOpen ? 'var(--c-accent-bg)' : 'transparent', boxShadow: itemPopOpen ? `inset 0 0 0 2px ${C.accent}` : 'none' }}
            onMouseEnter={e => { if (!itemPopOpen) e.currentTarget.style.background = C.subtle; }}
            onMouseLeave={e => { if (!itemPopOpen) e.currentTarget.style.background = 'transparent'; }}
          >
            {isEmpty
              ? <span style={{ color: C.muted2 }}>Search item…</span>
              : <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.item_name}</div>
            }
            <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
          </div>

          {itemPopOpen && itemPopPos && (
            <div style={{ position: 'fixed', top: itemPopPos.top, left: itemPopPos.left, width: itemPopPos.width, zIndex: 9999, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden', minWidth: 280 }}>
              <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>
                <input autoFocus style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: C.ink, flex: 1 }} placeholder="Search items…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                {filteredItems.length === 0
                  ? <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No items found</div>
                  : filteredItems.map(it => (
                    <div key={it.id}
                      onClick={() => { onPickItem(it); setItemPopOpen(false); setItemSearch(''); }}
                      style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ flex: 1 }}>
                        {it.name}
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{it.item_type === 'mobile' ? 'Mobile' : 'Accessory'}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Type badge */}
      <td style={{ ...td, paddingLeft: 10 }}>
        {isEmpty
          ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted2, border: `1px dashed ${C.line}` }}>—</span>
          : line.item_type === 'mobile'
            ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: C.infoBg, color: C.info, border: '1px solid rgba(31,58,138,0.22)' }}>Mobile</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#ececea', color: C.ink2, border: `1px solid ${C.line2}` }}>Accessory</span>
        }
      </td>

      {/* IMEI / Stock cell */}
      <td style={{ ...td, overflow: 'visible' }}>
        {isEmpty ? (
          <span style={{ padding: '0 10px', color: C.muted2, fontSize: 12 }}>Pick item first</span>
        ) : line.item_type === 'mobile' ? (
          <div
            ref={imeiCellRef}
            onClick={e => {
              if ((e.target as HTMLElement).closest('[data-ix]')) return;
              if (!line.imeiCellOpen) {
                onPatch({ imeiCellOpen: true });
                setTimeout(() => imeiInputRef.current?.focus(), 10);
              }
            }}
            style={{ minHeight: 44, padding: '6px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, cursor: 'text', position: 'relative', fontSize: 13, background: line.imeiCellOpen ? 'var(--c-accent-bg)' : 'transparent', boxShadow: line.imeiCellOpen ? `inset 0 0 0 2px ${C.accent}` : 'none' }}
            onMouseEnter={e => { if (!line.imeiCellOpen) e.currentTarget.style.background = C.subtle; }}
            onMouseLeave={e => { if (!line.imeiCellOpen) e.currentTarget.style.background = line.imeiCellOpen ? 'var(--c-accent-bg)' : 'transparent'; }}
          >
            {line.imeis.length === 0 && !line.imeiCellOpen && (
              <span style={{ color: C.muted2, padding: '0 4px', fontSize: 12.5 }}>
                {line.loadingImeis ? 'Loading IMEIs…' : '+ Tap to add IMEI'}
              </span>
            )}

            {line.imeis.map(imei => (
              <span key={imei} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, background: C.infoBg, border: '1px solid rgba(31,58,138,0.22)', borderRadius: 3, padding: '2px 4px 2px 6px', color: C.info, letterSpacing: '0.02em' }}>
                {imei}
                <span
                  data-ix="1"
                  onClick={e => { e.stopPropagation(); onRemoveImei(imei); }}
                  style={{ width: 14, height: 14, borderRadius: 2, display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: 'rgba(31,58,138,0.6)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(31,58,138,0.18)'; (e.currentTarget as HTMLElement).style.color = C.info; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(31,58,138,0.6)'; }}
                >
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                </span>
              </span>
            ))}

            <input
              ref={imeiInputRef}
              className="sf-cell"
              style={{ flex: 1, minWidth: 90, border: 0, outline: 0, background: 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink, padding: '2px 4px', height: 22 }}
              placeholder={line.imeis.length > 0 ? '+ Scan / add' : 'Scan or type IMEI…'}
              value={line.imeiSearch}
              onChange={e => onPatch({ imeiSearch: e.target.value, imeiCellOpen: true })}
              onFocus={() => onPatch({ imeiCellOpen: true })}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.stopPropagation(); onPatch({ imeiCellOpen: false }); return; }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = line.imeiSearch.trim();
                  if (filteredAvail.length === 1 && !line.imeis.includes(filteredAvail[0])) {
                    onAddImei(filteredAvail[0]);
                  } else if (trimmed && line.availableImeis.includes(trimmed) && !line.imeis.includes(trimmed)) {
                    onAddImei(trimmed);
                  }
                  onPatch({ imeiSearch: '' });
                }
              }}
            />

            {/* IMEI picker popover */}
            {line.imeiCellOpen && imeiPopPos && (
              <div style={{ position: 'fixed', top: imeiPopPos.top, left: imeiPopPos.left, width: imeiPopPos.width, zIndex: 9999, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden', minWidth: 320 }}>
                <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6"><path d="M2 8h12M8 2v12"/></svg>
                  <span style={{ flex: 1 }}>{line.imeis.length} selected · scan auto-adds &amp; keeps focus</span>
                  <Kbd>⏎ done</Kbd>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                  {line.loadingImeis ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>Loading…</div>
                  ) : line.availableImeis.length === 0 ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No in-stock IMEIs for this item</div>
                  ) : filteredAvail.length === 0 && line.imeiSearch ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No IMEI matches "{line.imeiSearch}"</div>
                  ) : (
                    line.availableImeis.map(imei => {
                      if (line.imeiSearch && !imei.includes(line.imeiSearch)) return null;
                      const isAdded = line.imeis.includes(imei);
                      return (
                        <div key={imei}
                          onClick={() => { if (!isAdded) { onAddImei(imei); onPatch({ imeiSearch: '' }); } }}
                          style={{ padding: '7px 10px', borderRadius: 4, cursor: isAdded ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, opacity: isAdded ? 0.55 : 1 }}
                          onMouseEnter={e => { if (!isAdded) e.currentTarget.style.background = C.subtle; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>{imei}</span>
                          <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 11.5 }}>{isAdded ? 'already added ✓' : 'in stock'}</span>
                          {!isAdded && <span style={{ color: C.muted2, fontFamily: 'monospace', fontSize: 10 }}>↵ add</span>}
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ borderTop: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                  <span>{line.availableImeis.length - line.imeis.length} of {line.availableImeis.length} in stock</span>
                  <span style={{ marginLeft: 'auto' }}><Kbd>↑↓</Kbd> · <Kbd>↵</Kbd> add · <Kbd>Esc</Kbd> close</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 11, padding: '0 10px' }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 7v6h10V7"/><path d="M2 5h12v2H2z"/><path d="M6 9h4"/></svg>
            Stock: {line.stockQty} left
          </span>
        )}
      </td>

      {/* Qty */}
      <td style={td}>
        <input
          className={line.item_type === 'mobile' || isEmpty ? 'sf-cell-ro' : 'sf-cell'}
          type="number" min="0" step="1"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: (isEmpty || line.item_type === 'mobile') ? C.muted : C.ink, background: (isEmpty || line.item_type === 'mobile') ? C.subtle : 'transparent', cursor: (isEmpty || line.item_type === 'mobile') ? 'not-allowed' : 'text' }}
          value={isEmpty ? '' : line.quantity}
          placeholder={isEmpty ? '—' : '0'}
          readOnly={line.item_type === 'mobile'}
          disabled={isEmpty}
          onChange={e => { if (line.item_type !== 'mobile') onPatch({ quantity: Math.max(0, Number(e.target.value)) }); }}
        />
      </td>

      {/* Sale price */}
      <td style={td}>
        <input
          className="sf-cell" type="number" min="0" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent' }}
          value={isEmpty ? '' : (line.sale_price || '')}
          placeholder="0.00"
          disabled={isEmpty}
          onChange={e => onPatch({ sale_price: Number(e.target.value) })}
        />
      </td>

      {/* Discount */}
      <td style={td}>
        <input
          className="sf-cell" type="number" min="0" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent' }}
          value={isEmpty ? '' : (line.discount || '')}
          placeholder="0.00"
          disabled={isEmpty}
          onChange={e => onPatch({ discount: Number(e.target.value) })}
        />
      </td>

      {/* Line total */}
      <td style={td}>
        <input
          className="sf-cell-ro"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600, background: C.subtle, color: C.muted, cursor: 'not-allowed' }}
          value={isEmpty ? '' : fmtNum(line.total)}
          placeholder="0.00"
          readOnly
        />
      </td>

      {/* Remove */}
      <td style={td}>
        <button
          type="button" onClick={onRemove}
          style={{ width: 28, height: 28, border: 0, background: 'transparent', color: C.muted2, cursor: 'pointer', borderRadius: 3, display: 'grid', placeItems: 'center', margin: '0 auto' }}
          onMouseEnter={e => { e.currentTarget.style.color = C.bad; e.currentTarget.style.background = '#f7e6e6'; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted2; e.currentTarget.style.background = 'transparent'; }}
          title="Remove row"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </td>
    </tr>
  );
}

// ── SalesForm ─────────────────────────────────────────────────────────────────
export function SalesForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { saving, error } = useSalesStore();
  const { save } = useSaveSalesInvoice();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [stockMap, setStockMap] = useState<Map<number, number>>(new Map());

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPopOpen, setCustomerPopOpen] = useState(false);
  const customerComboRef = useRef<HTMLDivElement>(null);

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'card' | 'bank'>('cash');

  const [salespersonId, setSalespersonId] = useState<number | null>(null);
  const [salespersonSearch, setSalespersonSearch] = useState('');
  const [salespersonPopOpen, setSalespersonPopOpen] = useState(false);
  const salespersonComboRef = useRef<HTMLDivElement>(null);

  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
    getItems().then(setItems).catch(console.error);
    getSalespersons().then(setSalespersons).catch(console.error);
    getInventoryAccessories().then(rows => {
      const m = new Map<number, number>();
      rows.forEach(r => m.set(r.id, r.quantity));
      setStockMap(m);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (customerComboRef.current && !customerComboRef.current.contains(e.target as Node)) setCustomerPopOpen(false);
      if (salespersonComboRef.current && !salespersonComboRef.current.contains(e.target as Node)) setSalespersonPopOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const handleSaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); handleSaveRef.current(); }
      if (e.key === 'Escape') onCancelRef.current();
      if (!meta && /^[1-4]$/.test(e.key)) {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        const modes: ('cash' | 'credit' | 'card' | 'bank')[] = ['cash', 'credit', 'card', 'bank'];
        setPaymentMode(modes[parseInt(e.key, 10) - 1]);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function patchLine(i: number, patch: Partial<LineState>) {
    setLines(prev => {
      const next = [...prev];
      const m = { ...next[i], ...patch };
      if (m.item_type === 'mobile') m.quantity = m.imeis.length;
      m.total = Math.max(0, m.quantity * m.sale_price - m.discount);
      next[i] = m;
      return next;
    });
  }

  async function pickItem(idx: number, item: Item) {
    const isAcc = item.item_type === 'accessory';
    patchLine(idx, {
      item_id: item.id, item_type: item.item_type, item_name: item.name,
      imeis: [], quantity: isAcc ? 1 : 0, sale_price: 0, discount: 0, total: 0,
      availableImeis: [], loadingImeis: !isAcc,
      stockQty: isAcc ? (stockMap.get(item.id) ?? 0) : 0,
      imeiCellOpen: false, imeiSearch: '',
    });
    if (!isAcc) {
      try {
        const avail = await getAvailableImeis(item.id);
        setLines(prev => { const n = [...prev]; n[idx] = { ...n[idx], availableImeis: avail, loadingImeis: false }; return n; });
      } catch {
        setLines(prev => { const n = [...prev]; n[idx] = { ...n[idx], loadingImeis: false }; return n; });
      }
    }
  }

  function addImei(idx: number, imei: string) {
    setLines(prev => {
      const n = [...prev]; const l = n[idx];
      if (l.imeis.includes(imei)) return prev;
      const imeis = [...l.imeis, imei];
      n[idx] = { ...l, imeis, quantity: imeis.length, total: Math.max(0, imeis.length * l.sale_price - l.discount), imeiSearch: '' };
      return n;
    });
  }

  function removeImei(idx: number, imei: string) {
    setLines(prev => {
      const n = [...prev]; const l = n[idx];
      const imeis = l.imeis.filter(x => x !== imei);
      n[idx] = { ...l, imeis, quantity: imeis.length, total: Math.max(0, imeis.length * l.sale_price - l.discount) };
      return n;
    });
  }

  async function handleSave() {
    if (!customerId) { alert('Select a customer.'); return; }
    const filled = lines.filter(l => l.item_id !== 0);
    if (filled.length === 0) { alert('Add at least one line item.'); return; }
    for (const l of filled) {
      if (l.item_type === 'mobile' && l.imeis.length === 0) { alert('Select at least one IMEI for each mobile item.'); return; }
      if (l.item_type === 'accessory' && l.quantity <= 0) { alert('Enter quantity > 0 for each accessory.'); return; }
      if (l.sale_price <= 0) { alert('Enter a sale price > 0 for all items.'); return; }
    }
    const saveLines: SalesLineInput[] = filled.map(
      ({ availableImeis: _a, loadingImeis: _l, imeiCellOpen: _b, imeiSearch: _s, stockQty: _q, ...rest }) => rest,
    );
    const id = await save({ customer_id: customerId, invoice_date: invoiceDate, payment_mode: paymentMode, salesperson_id: salespersonId, lines: saveLines });
    if (id !== null) onSaved();
  }
  handleSaveRef.current = handleSave;

  // Derived
  const filledLines = lines.filter(l => l.item_id !== 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.sale_price, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount = lines.reduce((s, l) => s + l.total, 0);
  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone ?? '').includes(customerSearch)
  );
  const filteredSalespersons = salespersons.filter(sp =>
    !salespersonSearch || sp.name.toLowerCase().includes(salespersonSearch.toLowerCase())
  );

  const inputBase: React.CSSProperties = { height: 32, padding: '0 10px', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, fontFamily: 'inherit', fontSize: 13.5, color: C.ink, width: '100%', boxSizing: 'border-box', outline: 'none' };
  const fieldDiv: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', borderRight: `1px solid ${C.line}` };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' } as React.CSSProperties;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 22px 0', gap: 16, minWidth: 980, boxSizing: 'border-box' }}>

      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.1 }}>New sales invoice</h1>
          <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Tab to move between fields. Mobile lines lock quantity to the selected IMEI count.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.muted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, background: C.subtle, border: `1px solid ${C.line}`, fontSize: 11 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.muted2, display: 'inline-block' }} />
            Draft · unsaved
          </span>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', display: 'inline-block' }} />
          <span>Posts <b style={{ color: C.ink2, fontWeight: 500 }}>journal_entries</b> on save</span>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>Ctrl+S</Kbd> save</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>Esc</Kbd> cancel</span>
        </div>
      </div>

      {/* ── Header card ── */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Header</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
            Required fields: <b style={{ color: C.ink2 }}>Customer</b><b style={{ color: C.ink2 }}>Payment</b>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) 160px 140px 1.2fr 200px' }}>

          {/* Customer */}
          <div style={fieldDiv}>
            <label style={lbl}>Customer <span style={{ color: C.bad }}>*</span></label>
            <div ref={customerComboRef} style={{ position: 'relative' }}>
              <input
                className="sf-input"
                style={{ ...inputBase, paddingRight: 28, fontWeight: customerId ? 500 : 'normal' }}
                value={customerSearch}
                placeholder="Search by name or phone…"
                autoComplete="off"
                onFocus={() => setCustomerPopOpen(true)}
                onClick={() => setCustomerPopOpen(true)}
                onChange={e => { setCustomerSearch(e.target.value); setCustomerPopOpen(true); if (!e.target.value) setCustomerId(null); }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.muted, pointerEvents: 'none' }}>▾</span>
              {customerPopOpen && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden' }}>
                  <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>
                    <input autoFocus style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: C.ink, flex: 1 }} placeholder="Type name or phone…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                    {filteredCustomers.length === 0
                      ? <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No customers found</div>
                      : filteredCustomers.map(c => (
                        <div key={c.id}
                          onClick={() => { setCustomerId(c.id); setCustomerSearch(c.name); setCustomerPopOpen(false); }}
                          style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: c.id === customerId ? C.subtle : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
                          onMouseLeave={e => (e.currentTarget.style.background = c.id === customerId ? C.subtle : 'transparent')}
                        >
                          <div style={{ flex: 1 }}>
                            {c.name}
                            {c.phone && <div style={{ fontSize: 11.5, color: C.muted }}>{c.phone}</div>}
                          </div>
                          {c.id === customerId && <span style={{ color: C.muted2, fontSize: 10 }}>↵</span>}
                        </div>
                      ))
                    }
                  </div>
                  <div style={{ borderTop: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                    <span style={{ color: C.accent, cursor: 'pointer', fontWeight: 500 }}
                      onClick={async () => {
                        const name = customerSearch.trim(); if (!name) return;
                        try { const id = await insertCustomer({ name }); const upd = await getCustomers(); setCustomers(upd); setCustomerId(id); setCustomerSearch(name); setCustomerPopOpen(false); } catch (err) { console.error(err); }
                      }}
                    >+ Add new customer</span>
                    <span style={{ marginLeft: 'auto' }}><Kbd>↑↓</Kbd> nav · <Kbd>↵</Kbd> select · <Kbd>Esc</Kbd> close</span>
                  </div>
                </div>
              )}
            </div>
            {!customerId && (
              <span style={{ fontSize: 11, color: C.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setCustomerPopOpen(true)}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: C.accent, color: C.accentFg, display: 'inline-grid', placeItems: 'center', fontSize: 10 }}>+</span>
                Add new customer
              </span>
            )}
          </div>

          {/* Invoice No */}
          <div style={fieldDiv}>
            <label style={lbl}>Invoice no.</label>
            <input style={{ ...inputBase, background: C.subtle, color: C.muted, cursor: 'default', borderStyle: 'dashed', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }} value="SI-####" readOnly />
            <div style={{ fontSize: 11, color: C.muted2 }}>Auto-generated on save.</div>
          </div>

          {/* Date */}
          <div style={fieldDiv}>
            <label style={lbl}>Date</label>
            <input className="sf-input" type="date" style={{ ...inputBase, fontFamily: "'JetBrains Mono', monospace" }} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <div style={{ fontSize: 11, color: C.muted2 }}>Defaults to today.</div>
          </div>

          {/* Payment mode */}
          <div style={fieldDiv}>
            <label style={lbl}>Payment mode <span style={{ color: C.bad }}>*</span></label>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', border: `1px solid ${C.line2}`, borderRadius: 4, background: C.subtle, padding: 2, gap: 2, height: 32 }}>
              {(['cash', 'credit', 'card', 'bank'] as const).map((mode, idx) => (
                <button key={mode} type="button" onClick={() => setPaymentMode(mode)} style={{ appearance: 'none', border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, color: paymentMode === mode ? C.ink : C.ink2, padding: '0 12px', borderRadius: 3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, background: paymentMode === mode ? C.paper : 'transparent', boxShadow: paymentMode === mode ? `0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px ${C.line2}` : 'none' }}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: paymentMode === mode ? C.ink2 : C.muted2, border: `1px solid ${C.line2}`, borderRadius: 2, padding: '0 3px', background: C.paper }}>{idx + 1}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted2 }}>Press 1–4 to switch.</div>
          </div>

          {/* Salesperson */}
          <div style={{ ...fieldDiv, borderRight: 0 }}>
            <label style={lbl}>Salesperson <span style={{ color: C.muted2, fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>— optional</span></label>
            <div ref={salespersonComboRef} style={{ position: 'relative' }}>
              <input
                className="sf-input"
                style={{ ...inputBase, paddingRight: 28, fontWeight: salespersonId ? 500 : 'normal' }}
                value={salespersonSearch}
                placeholder="Select salesperson…"
                autoComplete="off"
                onFocus={() => setSalespersonPopOpen(true)}
                onClick={() => setSalespersonPopOpen(true)}
                onChange={e => { setSalespersonSearch(e.target.value); setSalespersonPopOpen(true); if (!e.target.value) setSalespersonId(null); }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.muted, pointerEvents: 'none' }}>▾</span>
              {salespersonPopOpen && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden' }}>
                  <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                    <div onClick={() => { setSalespersonId(null); setSalespersonSearch(''); setSalespersonPopOpen(false); }} style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: C.muted }} onMouseEnter={e => (e.currentTarget.style.background = C.subtle)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>None</div>
                    {filteredSalespersons.map(sp => (
                      <div key={sp.id}
                        onClick={() => { setSalespersonId(sp.id); setSalespersonSearch(sp.name); setSalespersonPopOpen(false); }}
                        style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 13, background: sp.id === salespersonId ? C.subtle : 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
                        onMouseLeave={e => (e.currentTarget.style.background = sp.id === salespersonId ? C.subtle : 'transparent')}
                      >{sp.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted2 }}>Tracked for commission reports.</div>
          </div>
        </div>
      </div>

      {/* ── Line items card ── */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
          <span>Line items</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.ink2, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 999, padding: '1px 7px', letterSpacing: 0 }}>
            {filledLines.length} {filledLines.length === 1 ? 'line' : 'lines'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>⏎</Kbd> add row</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>Tab</Kbd> next field</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>⌫</Kbd> remove row</span>
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 30 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 260 }} />
              <col style={{ width: 90 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} /><col style={{ width: 140 }} /><col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr>
                {(['', 'Item', 'Type', 'IMEI / Stock', 'Qty', 'Sale price', 'Discount', 'Line total', ''] as const).map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 4 && i <= 7 ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '9px 10px', borderBottom: `1.5px solid ${C.line3}`, background: C.subtle, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <LineRow
                  key={i} rowNum={i + 1} line={line} items={items}
                  onPickItem={item => pickItem(i, item)}
                  onPatch={patch => patchLine(i, patch)}
                  onAddImei={imei => addImei(i, imei)}
                  onRemoveImei={imei => removeImei(i, imei)}
                  onRemove={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setLines(prev => [...prev, emptyLine()])}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: C.paper, border: 0, borderTop: `1px dashed ${C.line2}`, width: '100%', textAlign: 'left' }}
          onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
          onMouseLeave={e => (e.currentTarget.style.background = C.paper)}
        >
          <span style={{ width: 16, height: 16, borderRadius: 4, background: C.accent, color: C.accentFg, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 11, lineHeight: '16px' }}>+</span>
          Add line
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 4px', background: C.paper, marginLeft: 'auto' }}>⏎</span>
        </button>
      </div>

      {/* ── Footer grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 20 }}>
        <div style={{ padding: 16, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Remarks <span style={{ textTransform: 'none', letterSpacing: 0, color: C.muted2, fontWeight: 500 }}>— optional</span>
          </label>
          <textarea
            className="sf-textarea"
            style={{ border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', minHeight: 92, resize: 'vertical', boxSizing: 'border-box', width: '100%', outline: 'none' }}
            placeholder="Notes for this invoice (warranty terms, customer requests…)"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
          />
          <div style={{ marginTop: 4, display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: C.muted }}>
            <span>Lines: <b style={{ color: C.ink2, fontWeight: 500 }}>{filledLines.length}</b></span>
            <span>Units: <b style={{ color: C.ink2, fontWeight: 500 }}>{lines.reduce((s, l) => s + l.quantity, 0)}</b></span>
          </div>
        </div>

        <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: C.muted }}>Subtotal ({filledLines.length} {filledLines.length === 1 ? 'line' : 'lines'})</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 13, color: C.ink2 }}>{fmtNum(subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12.5, color: C.muted }}>Discount</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 13, color: C.bad }}>− {fmtNum(totalDiscount)}</span>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${C.line}`, margin: '2px 0' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 30, fontWeight: 600, color: C.ink, letterSpacing: -0.5, lineHeight: 1 }}>
              {(() => {
                const [int, dec] = fmtNum(totalAmount).split('.');
                return <><span style={{ color: C.muted2, fontSize: 16, marginRight: 4, fontWeight: 500 }}>₨</span>{int}<span style={{ color: C.muted }}>.{dec}</span></>;
              })()}
            </span>
          </div>

          <div style={{ marginTop: 6, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 11, color: C.muted }}>
              <Kbd>Ctrl+S</Kbd> Save · <Kbd>Ctrl+Shift+S</Kbd> Save &amp; print · <Kbd>Esc</Kbd> Cancel
            </div>
            <button type="button" onClick={onCancel}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 34, padding: '0 14px', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, border: `1px solid ${C.line2}`, cursor: 'pointer', background: C.paper, color: C.ink }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.ink2; e.currentTarget.style.background = C.subtle; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.line2; e.currentTarget.style.background = C.paper; }}
            >Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: saving ? C.line2 : C.accent, color: C.accentFg, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : <><span>Save invoice</span><Kbd>Ctrl+S</Kbd></>}
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: C.bad, margin: 0 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
