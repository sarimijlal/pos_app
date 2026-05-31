import { useState, useEffect, useLayoutEffect, useRef, Fragment } from 'react';
import { useImeiScanner } from '../../../hooks/useImeiScanner';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type SplitMethod = 'cash' | 'credit' | 'bank';

interface LineState extends SalesLineInput {
  availableImeis: string[];
  loadingImeis: boolean;
  imeiCellOpen: boolean;
  imeiSearch: string;
  stockQty: number;
}

function emptyLine(): LineState {
  return { item_id: 0, item_type: 'accessory', item_name: '', quantity: 0, sale_price: 0, discount: 0, total: 0, imeis: [], availableImeis: [], loadingImeis: false, imeiCellOpen: false, imeiSearch: '', stockQty: 0 };
}

// ── LineRow ───────────────────────────────────────────────────────────────────

interface LineRowProps {
  rowNum: number;
  line: LineState;
  items: Item[];
  submitted: boolean;
  onPickItem: (item: Item) => void;
  onPatch: (patch: Partial<LineState>) => void;
  onAddImei: (imei: string) => void;
  onRemoveImei: (imei: string) => void;
  onRemove: () => void;
  onActivate: () => void;
}

function LineRow({ rowNum, line, items, submitted, onPickItem, onPatch, onAddImei, onRemoveImei, onRemove, onActivate }: LineRowProps) {
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
      if (itemComboRef.current && !itemComboRef.current.contains(e.target as Node)) setItemPopOpen(false);
      if (imeiCellRef.current && !imeiCellRef.current.contains(e.target as Node)) onPatchRef.current({ imeiCellOpen: false });
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
  const isMobile = line.item_type === 'mobile';
  const priceInvalid = submitted && !isEmpty && (line.sale_price <= 0 || isNaN(line.sale_price));
  const filteredItems = items.filter(it => !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase()));
  const filteredAvail = line.availableImeis.filter(im => !line.imeiSearch || im.includes(line.imeiSearch));

  const tdBg = rowHovered && !isEmpty ? 'var(--c-subtle)' : C.paper;
  const td: React.CSSProperties = { padding: 0, borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle', position: 'relative', background: tdBg };
  const cellIn: React.CSSProperties = { width: '100%', height: 44, border: 0, outline: 0, background: 'transparent', padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: C.ink };

  return (
    <tr onMouseEnter={() => { setRowHovered(true); onActivate(); }} onMouseLeave={() => setRowHovered(false)}>

      {/* # */}
      <td style={{ ...td, textAlign: 'center', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {rowNum}
      </td>

      {/* Item combo */}
      <td style={td}>
        <div ref={itemComboRef} style={{ position: 'relative', height: 44 }}>
          <div
            onClick={() => {
              if (!itemPopOpen && itemComboRef.current) {
                const r = itemComboRef.current.getBoundingClientRect();
                setItemPopPos({ top: r.bottom + 2, left: r.left, width: Math.max(280, r.width) });
                setItemPopOpen(true);
                setItemSearch('');
              }
            }}
            style={{ height: 44, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, background: itemPopOpen ? 'var(--c-accent-bg)' : 'transparent', boxShadow: itemPopOpen ? `inset 0 0 0 2px ${C.accent}` : 'none' }}
            onMouseEnter={e => { if (!itemPopOpen) e.currentTarget.style.background = C.subtle; }}
            onMouseLeave={e => { if (!itemPopOpen) e.currentTarget.style.background = 'transparent'; }}
          >
            {isEmpty ? <span style={{ color: C.muted2 }}>Search item…</span> : <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.item_name}</div>}
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
                    <div key={it.id} onClick={() => { onPickItem(it); setItemPopOpen(false); setItemSearch(''); }}
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
          : isMobile
            ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: C.infoBg, color: C.info, border: '1px solid rgba(31,58,138,0.22)' }}>Mobile</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#ececea', color: C.ink2, border: `1px solid ${C.line2}` }}>Accessory</span>
        }
      </td>

      {/* IMEI / Stock */}
      <td style={{ ...td, overflow: 'visible' }}>
        {isEmpty ? (
          <span style={{ padding: '0 10px', color: C.muted2, fontSize: 12 }}>Pick item first</span>
        ) : isMobile ? (
          <div ref={imeiCellRef}
            onClick={e => {
              if ((e.target as HTMLElement).closest('[data-ix]')) return;
              if (!line.imeiCellOpen) { onPatch({ imeiCellOpen: true }); setTimeout(() => imeiInputRef.current?.focus(), 10); }
            }}
            style={{ minHeight: 44, padding: '6px 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, cursor: 'text', position: 'relative', fontSize: 13, background: line.imeiCellOpen ? 'var(--c-accent-bg)' : 'transparent', boxShadow: line.imeiCellOpen ? `inset 0 0 0 2px ${C.accent}` : 'none' }}
            onMouseEnter={e => { if (!line.imeiCellOpen) e.currentTarget.style.background = C.subtle; }}
            onMouseLeave={e => { if (!line.imeiCellOpen) e.currentTarget.style.background = line.imeiCellOpen ? 'var(--c-accent-bg)' : 'transparent'; }}
          >
            {line.imeis.length === 0 && !line.imeiCellOpen && (
              <span style={{ color: C.muted2, padding: '0 4px', fontSize: 12.5 }}>
                {line.loadingImeis ? 'Loading IMEIs…' : '+ Tap to select IMEI'}
              </span>
            )}
            {line.imeis.map(imei => (
              <span key={imei} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, background: C.infoBg, border: '1px solid rgba(31,58,138,0.22)', borderRadius: 3, padding: '2px 4px 2px 6px', color: C.info, letterSpacing: '0.02em' }}>
                {imei}
                <span data-ix="1" onClick={e => { e.stopPropagation(); onRemoveImei(imei); }}
                  style={{ width: 14, height: 14, borderRadius: 2, display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: 'rgba(31,58,138,0.6)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(31,58,138,0.18)'; (e.currentTarget as HTMLElement).style.color = C.info; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(31,58,138,0.6)'; }}
                >
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                </span>
              </span>
            ))}
            <input ref={imeiInputRef} className="sf-cell"
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
                  if (filteredAvail.length === 1 && !line.imeis.includes(filteredAvail[0])) { onAddImei(filteredAvail[0]); }
                  else if (trimmed && line.availableImeis.includes(trimmed) && !line.imeis.includes(trimmed)) { onAddImei(trimmed); }
                  onPatch({ imeiSearch: '' });
                }
              }}
            />
            {line.imeiCellOpen && imeiPopPos && (
              <div style={{ position: 'fixed', top: imeiPopPos.top, left: imeiPopPos.left, width: imeiPopPos.width, zIndex: 9999, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden', minWidth: 320 }}>
                <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6"><path d="M2 8h12M8 2v12"/></svg>
                  <span style={{ flex: 1 }}>{line.imeis.length} selected · scan auto-adds</span>
                  <Kbd>⏎ done</Kbd>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                  {line.loadingImeis ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>Loading…</div>
                  ) : line.availableImeis.length === 0 ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No in-stock IMEIs for this item</div>
                  ) : filteredAvail.length === 0 && line.imeiSearch ? (
                    <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No match for "{line.imeiSearch}"</div>
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
                          <span style={{ marginLeft: 'auto', color: C.muted, fontSize: 11.5 }}>{isAdded ? 'added ✓' : 'in stock'}</span>
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
            {line.stockQty} in stock
          </span>
        )}
      </td>

      {/* Qty */}
      <td style={td}>
        <input className={isMobile || isEmpty ? 'sf-cell-ro' : 'sf-cell'} type="number" min="0" step="1"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: (isEmpty || isMobile) ? C.muted : C.ink, background: (isEmpty || isMobile) ? C.subtle : 'transparent', cursor: (isEmpty || isMobile) ? 'not-allowed' : 'text' }}
          value={isEmpty ? '' : line.quantity} placeholder={isEmpty ? '—' : '0'}
          readOnly={isMobile} disabled={isEmpty}
          onChange={e => { if (!isMobile) onPatch({ quantity: Math.max(0, Number(e.target.value)) }); }}
        />
      </td>

      {/* Sale price */}
      <td style={{ ...td, boxShadow: priceInvalid ? `inset 0 0 0 2px ${C.bad}` : 'none' }}>
        <input className="sf-cell" type="number" min="0.01" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent', color: priceInvalid ? C.bad : C.ink }}
          value={isEmpty ? '' : (line.sale_price || '')} placeholder="0.00" disabled={isEmpty}
          onChange={e => onPatch({ sale_price: Number(e.target.value) })}
        />
      </td>

      {/* Discount */}
      <td style={td}>
        <input className="sf-cell" type="number" min="0" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent' }}
          value={isEmpty ? '' : (line.discount || '')} placeholder="0.00" disabled={isEmpty}
          onChange={e => onPatch({ discount: Number(e.target.value) })}
        />
      </td>

      {/* Line total */}
      <td style={td}>
        <input className="sf-cell-ro"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600, background: C.subtle, color: C.muted, cursor: 'not-allowed' }}
          value={isEmpty ? '' : fmtNum(line.total)} placeholder="0.00" readOnly
        />
      </td>

      {/* Remove */}
      <td style={td}>
        <button type="button" onClick={onRemove}
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

  const [salespersonId, setSalespersonId] = useState<number | null>(null);
  const [salespersonSearch, setSalespersonSearch] = useState('');
  const [salespersonPopOpen, setSalespersonPopOpen] = useState(false);
  const salespersonComboRef = useRef<HTMLDivElement>(null);

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit' | 'bank' | 'partial'>('cash');
  const [splitMethod0, setSplitMethod0] = useState<SplitMethod>('cash');
  const [splitAmount0, setSplitAmount0] = useState('');
  const [splitMethod1, setSplitMethod1] = useState<SplitMethod>('credit');
  const [splitAmount1, setSplitAmount1] = useState('');

  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(0);

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
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
        const modes: ('cash' | 'credit' | 'bank' | 'partial')[] = ['cash', 'credit', 'bank', 'partial'];
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
    patchLine(idx, { item_id: item.id, item_type: item.item_type, item_name: item.name, imeis: [], quantity: isAcc ? 1 : 0, sale_price: 0, discount: 0, total: 0, availableImeis: [], loadingImeis: !isAcc, stockQty: isAcc ? (stockMap.get(item.id) ?? 0) : 0, imeiCellOpen: false, imeiSearch: '' });
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

  // Derived values
  const filledLines = lines.filter(l => l.item_id !== 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.sale_price, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount = lines.reduce((s, l) => s + l.total, 0);
  const allPricesPositive = filledLines.length > 0 && filledLines.every(l => l.sale_price > 0);
  const mobileWithoutImeis = filledLines.filter(l => l.item_type === 'mobile' && l.imeis.length === 0);
  const allImeisSelected = mobileWithoutImeis.length === 0;
  const filteredCustomers = customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone ?? '').includes(customerSearch));
  const filteredSalespersons = salespersons.filter(sp => !salespersonSearch || sp.name.toLowerCase().includes(salespersonSearch.toLowerCase()));

  // Partial split validation
  const split0 = parseFloat(splitAmount0) || 0;
  const split1 = parseFloat(splitAmount1) || 0;
  const splitSum = split0 + split1;
  const splitMethodsDistinct = splitMethod0 !== splitMethod1;
  const partialBalanced = paymentMode !== 'partial' || (splitMethodsDistinct && Math.abs(splitSum - totalAmount) < 0.005 && split0 > 0 && split1 > 0);

  const checks = [
    { ok: customerId !== null, label: 'Customer selected' },
    { ok: !!invoiceDate, label: 'Invoice date set' },
    { ok: filledLines.length > 0, label: 'At least one line item' },
    { ok: allPricesPositive, label: 'All sale prices > 0' },
    { ok: allImeisSelected, label: 'All mobile lines have IMEIs' },
    ...(paymentMode === 'partial' ? [{ ok: partialBalanced, label: 'Payment split balances' }] : []),
  ];
  const canSave = checks.every(c => c.ok);

  function buildSplitAmounts() {
    const result = { cash_amount: 0, credit_amount: 0, bank_amount: 0 };
    if (paymentMode === 'cash') { result.cash_amount = totalAmount; }
    else if (paymentMode === 'credit') { result.credit_amount = totalAmount; }
    else if (paymentMode === 'bank') { result.bank_amount = totalAmount; }
    else {
      if (splitMethod0 === 'cash') result.cash_amount += split0;
      else if (splitMethod0 === 'credit') result.credit_amount += split0;
      else result.bank_amount += split0;
      if (splitMethod1 === 'cash') result.cash_amount += split1;
      else if (splitMethod1 === 'credit') result.credit_amount += split1;
      else result.bank_amount += split1;
    }
    return result;
  }

  async function handleSave() {
    setFormSubmitted(true);
    if (!canSave) return;
    const saveLines: SalesLineInput[] = filledLines.map(({ availableImeis: _a, loadingImeis: _l, imeiCellOpen: _b, imeiSearch: _s, stockQty: _q, ...rest }) => rest);
    const amounts = buildSplitAmounts();
    const id = await save({
      customer_id: customerId!,
      invoice_date: invoiceDate,
      payment_mode: paymentMode,
      salesperson_id: salespersonId,
      ...amounts,
      bank_account_id: null,
      lines: saveLines,
    });
    if (id !== null) onSaved();
  }
  handleSaveRef.current = handleSave;

  useImeiScanner((imei) => {
    const line = lines[activeLineIdx];
    if (!line || line.item_id === 0 || line.item_type !== 'mobile') return;
    if (!line.availableImeis.includes(imei)) return;
    addImei(activeLineIdx, imei);
    patchLine(activeLineIdx, { imeiCellOpen: true });
  });

  // Styles
  const inputBase: React.CSSProperties = { height: 32, padding: '0 10px', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, fontFamily: 'inherit', fontSize: 13.5, color: C.ink, width: '100%', boxSizing: 'border-box', outline: 'none' };
  const fieldDiv: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', borderRight: `1px solid ${C.line}` };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' } as React.CSSProperties;
  const cardStyle: React.CSSProperties = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 };
  const cardHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' };

  const PAY_MODES = ['cash', 'credit', 'bank', 'partial'] as const;

  return (
    <div style={{ flex: 1, display: 'flex', gap: 20, padding: '20px 22px 20px', minWidth: 0, boxSizing: 'border-box', alignItems: 'flex-start' }}>

      {/* ── form-main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

        {/* Page heading */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.1 }}>New sales invoice</h1>
            <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Pick a customer, add items, choose IMEIs for each phone. Mobile quantity equals IMEI count.</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, background: C.subtle, border: `1px solid ${C.line}`, fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.muted2, display: 'inline-block' }} />
            Draft · unsaved
          </span>
        </div>

        {/* Header card */}
        <div style={cardStyle}>
          <div style={cardHead}>
            <span>Header</span>
            <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
              <Kbd>Tab</Kbd> moves field to field
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1.6fr) 160px 140px 1fr' }}>

            {/* Customer */}
            <div style={fieldDiv}>
              <label style={lbl}>Customer <span style={{ color: C.bad }}>*</span></label>
              <div ref={customerComboRef} style={{ position: 'relative' }}>
                <input className="sf-input"
                  style={{ ...inputBase, paddingRight: 28, fontWeight: customerId ? 500 : 'normal', border: formSubmitted && !customerId ? `1px solid ${C.bad}` : `1px solid ${C.line2}` }}
                  value={customerSearch} placeholder="Search by name or phone…" autoComplete="off"
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

            {/* Salesperson */}
            <div style={{ ...fieldDiv, borderRight: 0 }}>
              <label style={lbl}>Salesperson <span style={{ color: C.muted2, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>— optional</span></label>
              <div ref={salespersonComboRef} style={{ position: 'relative' }}>
                <input className="sf-input"
                  style={{ ...inputBase, paddingRight: 28, fontWeight: salespersonId ? 500 : 'normal' }}
                  value={salespersonSearch} placeholder="Select salesperson…" autoComplete="off"
                  onFocus={() => setSalespersonPopOpen(true)}
                  onClick={() => setSalespersonPopOpen(true)}
                  onChange={e => { setSalespersonSearch(e.target.value); setSalespersonPopOpen(true); if (!e.target.value) setSalespersonId(null); }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.muted, pointerEvents: 'none' }}>▾</span>
                {salespersonPopOpen && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden' }}>
                    <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                      <div onClick={() => { setSalespersonId(null); setSalespersonSearch(''); setSalespersonPopOpen(false); }}
                        style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: C.muted }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >None</div>
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

        {/* Line items card */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
          <div style={{ ...cardHead, flexShrink: 0 }}>
            <span>Line items</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.ink2, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 999, padding: '1px 7px', letterSpacing: 0 }}>
              {filledLines.length} {filledLines.length === 1 ? 'line' : 'lines'}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>↵</Kbd> add IMEI</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>Tab</Kbd> next field</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>⌫</Kbd> remove IMEI</span>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 1020, borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 30 }} /><col /><col style={{ width: 108 }} /><col style={{ width: 200 }} />
                <col style={{ width: 84 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} />
                <col style={{ width: 140 }} /><col style={{ width: 48 }} />
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
                  <Fragment key={i}>
                    <LineRow
                      rowNum={i + 1} line={line} items={items} submitted={formSubmitted}
                      onPickItem={item => pickItem(i, item)}
                      onPatch={patch => patchLine(i, patch)}
                      onAddImei={imei => addImei(i, imei)}
                      onRemoveImei={imei => removeImei(i, imei)}
                      onRemove={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                      onActivate={() => setActiveLineIdx(i)}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: C.paper, border: 0, borderTop: `1px dashed ${C.line2}`, width: '100%', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
            onMouseLeave={e => (e.currentTarget.style.background = C.paper)}
          >
            <span style={{ width: 16, height: 16, borderRadius: 4, background: C.accent, color: C.accentFg, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 11 }}>+</span>
            Add line
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 4px', background: C.paper, marginLeft: 'auto' }}>⏎</span>
          </button>
        </div>

        {/* Remarks */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={cardHead}><span>Remarks</span><span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontSize: 11.5, color: C.muted2 }}>optional</span></div>
          <div style={{ padding: 16 }}>
            <textarea className="sf-textarea"
              style={{ border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', minHeight: 72, resize: 'vertical', boxSizing: 'border-box', width: '100%', outline: 'none' }}
              placeholder="Notes for this invoice (warranty terms, customer requests…)"
              value={remarks} onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── form-aside ── */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

        {/* Checklist card */}
        <div style={cardStyle}>
          <div style={cardHead}>
            <span>Before you save</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 0, textTransform: 'none', color: checks.filter(c => c.ok).length === checks.length ? C.ok : C.muted2 }}>
              {checks.filter(c => c.ok).length} / {checks.length}
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${c.ok ? C.ok : C.line2}`, background: c.ok ? C.okBg : C.paper, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.ok && <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round"><path d="M3 8l3.5 3.5L13 5"/></svg>}
                </span>
                <span style={{ color: c.ok ? C.ink2 : C.muted }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals card */}
        <div style={cardStyle}>
          <div style={cardHead}><span>Totals</span></div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.muted }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{fmtNum(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: C.muted }}>Discount</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.bad }}>− {fmtNum(totalDiscount)}</span>
              </div>
            )}
            <div style={{ borderTop: `1px solid ${C.line}`, margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.ink }}>Total</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 26, fontWeight: 600, color: C.ink, letterSpacing: -0.5 }}>
                <span style={{ color: C.muted2, fontSize: 14, marginRight: 3, fontWeight: 500 }}>₨</span>{fmtNum(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment card */}
        <div style={cardStyle}>
          <div style={cardHead}>
            <span>Payment</span>
            <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: 0, textTransform: 'none', color: C.muted2 }}>
              {paymentMode === 'cash' ? 'cash · sales' : paymentMode === 'credit' ? 'ar · sales' : paymentMode === 'bank' ? 'bank · sales' : 'split · sales'}
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Mode segmented */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                Mode <span style={{ color: C.bad }}>*</span>
                <span style={{ float: 'right', fontFamily: "'JetBrains Mono', monospace", color: C.muted2, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>1–4</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, border: `1px solid ${C.line2}`, borderRadius: 5, padding: 3, background: C.subtle }}>
                {PAY_MODES.map((mode, idx) => (
                  <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                    style={{ border: 0, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, padding: '5px 0', borderRadius: 3, cursor: 'pointer', background: paymentMode === mode ? C.paper : 'transparent', color: paymentMode === mode ? C.ink : C.ink2, boxShadow: paymentMode === mode ? `0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px ${C.line2}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted2, border: `1px solid ${C.line}`, borderRadius: 2, padding: '0 3px', lineHeight: '14px', background: C.paper }}>{idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Partial split */}
            {paymentMode === 'partial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Split <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.muted2 }}>— must sum to total</span>
                </div>
                {[
                  { method: splitMethod0, amount: splitAmount0, setMethod: (m: SplitMethod) => { setSplitMethod0(m); if (m === splitMethod1) setSplitMethod1(splitMethod0); }, setAmount: setSplitAmount0 },
                  { method: splitMethod1, amount: splitAmount1, setMethod: (m: SplitMethod) => { setSplitMethod1(m); if (m === splitMethod0) setSplitMethod0(splitMethod1); }, setAmount: setSplitAmount1 },
                ].map((leg, li) => (
                  <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={leg.method} onChange={e => leg.setMethod(e.target.value as SplitMethod)}
                      style={{ height: 32, border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper, fontFamily: 'inherit', fontSize: 12.5, color: C.ink, padding: '0 6px', outline: 'none', flex: '0 0 80px' }}>
                      <option value="cash">Cash</option>
                      <option value="credit">Credit</option>
                      <option value="bank">Bank</option>
                    </select>
                    <div style={{ flex: 1, display: 'inline-flex', alignItems: 'center', height: 32, border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper, overflow: 'hidden' }}>
                      <span style={{ fontSize: 11, color: C.muted, padding: '0 7px', borderRight: `1px solid ${C.line}`, height: '100%', display: 'flex', alignItems: 'center', background: C.subtle, fontFamily: "'JetBrains Mono', monospace" }}>₨</span>
                      <input type="number" min="0" step="0.01"
                        style={{ flex: 1, border: 0, outline: 0, background: 'transparent', padding: '0 8px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.ink, textAlign: 'right' }}
                        placeholder="0.00" value={leg.amount}
                        onChange={e => leg.setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                {(splitAmount0 || splitAmount1) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 4, fontSize: 12, background: partialBalanced ? C.okBg : C.badBg, color: partialBalanced ? C.ok : C.bad, border: `1px solid ${partialBalanced ? '#b8d8c5' : '#e5b8b8'}` }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5"/><path d={partialBalanced ? 'M5 8l2 2 4-4' : 'M8 5v4M8 11v.5'}/></svg>
                    {partialBalanced
                      ? `₨ ${fmtNum(splitSum)} · balanced`
                      : !splitMethodsDistinct ? 'Same method on both legs' : `Off by ₨ ${fmtNum(Math.abs(splitSum - totalAmount))}`
                    }
                  </div>
                )}
              </div>
            )}

            {/* Save block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, borderTop: `1px solid ${C.line}` }}>
              {formSubmitted && !canSave && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {checks.filter(c => !c.ok).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.bad }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.bad, flexShrink: 0 }} />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, borderRadius: 5, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? C.line2 : canSave ? C.accent : C.line2, color: saving ? C.muted : canSave ? C.accentFg : C.muted, transition: 'background 0.15s' }}
              >
                {saving ? 'Saving…' : <><span>Save invoice</span><Kbd>⌘S</Kbd></>}
              </button>
              <button type="button" onClick={onCancel}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, border: `1px solid ${C.line2}`, cursor: 'pointer', background: C.paper, color: C.ink }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.ink2; e.currentTarget.style.background = C.subtle; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.line2; e.currentTarget.style.background = C.paper; }}
              >Cancel</button>
              {error && <p style={{ fontSize: 12, color: C.bad, margin: 0 }}>{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
