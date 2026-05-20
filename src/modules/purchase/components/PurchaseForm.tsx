import { useState, useEffect, useRef, Fragment } from 'react';
import { getSuppliers, insertSupplier } from '@/db/repositories/accounting';
import { getItems } from '@/db/repositories/inventory';
import { useSavePurchaseInvoice } from '../hooks/useSavePurchaseInvoice';
import { usePurchaseStore } from '../store';
import type { Supplier, Item } from '../../../../interfaces';
import type { PurchaseLineInput } from '../types';

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
interface LineState extends PurchaseLineInput {
  imeiInput: string;
}

function emptyLine(): LineState {
  return {
    item_id: 0, item_type: 'accessory', item_name: '',
    quantity: 1, rate: 0, discount: 0, total: 0, imeis: [],
    imeiInput: '',
  };
}

// ── LineRow ───────────────────────────────────────────────────────────────────
interface LineRowProps {
  rowNum: number;
  line: LineState;
  items: Item[];
  onPickItem: (item: Item) => void;
  onPatch: (patch: Partial<LineState>) => void;
  onRemove: () => void;
}

function LineRow({ rowNum, line, items, onPickItem, onPatch, onRemove }: LineRowProps) {
  const [rowHovered, setRowHovered] = useState(false);
  const [itemPopOpen, setItemPopOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemPopPos, setItemPopPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const itemComboRef = useRef<HTMLDivElement>(null);

  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (itemComboRef.current && !itemComboRef.current.contains(e.target as Node)) {
        setItemPopOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const isEmpty = line.item_id === 0;
  const isMobile = line.item_type === 'mobile';
  const imeiComplete = isMobile && !isEmpty && line.imeis.length === line.quantity && line.quantity > 0;
  const imeiIncomplete = isMobile && !isEmpty && line.imeis.length < line.quantity;
  const filteredItems = items.filter(it =>
    !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const tdBg = rowHovered && !isEmpty ? 'var(--c-subtle)' : C.paper;
  const td: React.CSSProperties = { padding: 0, borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle', position: 'relative', background: tdBg };
  const cellIn: React.CSSProperties = { width: '100%', height: 44, border: 0, outline: 0, background: 'transparent', padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: C.ink };
  const firstTdExtra: React.CSSProperties = imeiComplete
    ? { boxShadow: `inset 2px 0 0 ${C.ok}` }
    : imeiIncomplete ? { boxShadow: `inset 2px 0 0 ${C.warn}` } : {};

  return (
    <tr onMouseEnter={() => setRowHovered(true)} onMouseLeave={() => setRowHovered(false)}>

      {/* # */}
      <td style={{ ...td, ...firstTdExtra, textAlign: 'center', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
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
          : isMobile
            ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: C.infoBg, color: C.info, border: '1px solid rgba(31,58,138,0.22)' }}>Mobile</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#ececea', color: C.ink2, border: `1px solid ${C.line2}` }}>Accessory</span>
        }
      </td>

      {/* Qty */}
      <td style={td}>
        <input
          className="sf-cell" type="number" min="1" step="1"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent', color: isEmpty ? C.muted : C.ink, cursor: isEmpty ? 'not-allowed' : 'text' }}
          value={isEmpty ? '' : line.quantity}
          placeholder={isEmpty ? '—' : '1'}
          disabled={isEmpty}
          onChange={e => onPatch({ quantity: Math.max(1, Number(e.target.value)) })}
        />
      </td>

      {/* Rate */}
      <td style={td}>
        <input
          className="sf-cell" type="number" min="0" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent' }}
          value={isEmpty ? '' : (line.rate || '')}
          placeholder="0.00"
          disabled={isEmpty}
          onChange={e => onPatch({ rate: Number(e.target.value) })}
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
          onMouseEnter={e => { e.currentTarget.style.color = C.bad; e.currentTarget.style.background = C.badBg; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted2; e.currentTarget.style.background = 'transparent'; }}
          title="Remove row"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </td>
    </tr>
  );
}

// ── ImeiSubRow ────────────────────────────────────────────────────────────────
interface ImeiSubRowProps {
  line: LineState;
  onAddImei: (imei: string) => void;
  onRemoveImei: (imei: string) => void;
  onPatchImeiInput: (val: string) => void;
}

function ImeiSubRow({ line, onAddImei, onRemoveImei, onPatchImeiInput }: ImeiSubRowProps) {
  const entered = line.imeis.length;
  const needed = line.quantity;
  const isComplete = entered >= needed && needed > 0;
  const remaining = needed - entered;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = line.imeiInput.trim();
      if (val && !line.imeis.includes(val)) onAddImei(val);
    }
    if (e.key === 'Backspace' && !line.imeiInput && line.imeis.length > 0) {
      onRemoveImei(line.imeis[line.imeis.length - 1]);
    }
  }

  return (
    <tr>
      <td style={{ background: 'var(--c-sidebar)', padding: 0, borderBottom: isComplete ? `1px solid ${C.line}` : 0 }} />
      <td colSpan={7} style={{ background: 'var(--c-sidebar)', padding: '10px 14px 14px', borderTop: `1px dashed ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>

          {/* Meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180, paddingTop: 2 }}>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 2h10v12H3z"/><path d="M3 5h10M3 11h10"/></svg>
              IMEI receipt
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.ink2 }}>
              <b style={{ fontWeight: 600 }}>{entered}</b> / {needed} IMEIs entered
            </div>
            <div>
              {isComplete
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, lineHeight: 1.6, background: C.okBg, color: C.ok }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    Line complete
                  </span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, lineHeight: 1.6, background: C.warnBg, color: C.warn }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {remaining} still required
                  </span>
              }
            </div>
          </div>

          {/* Input area */}
          <div style={{
            flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
            minHeight: 40, padding: '6px 8px', background: C.paper,
            border: `1px solid ${isComplete ? '#b8d8c5' : entered > 0 ? '#d9bf6c' : C.line}`,
            borderRadius: 4,
            boxShadow: isComplete ? '0 0 0 2px rgba(15,122,74,0.1)' : entered > 0 ? '0 0 0 2px rgba(217,191,108,0.18)' : 'none',
          }}>
            {line.imeis.map(imei => (
              <span key={imei} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 4px 0 8px', background: '#eef5ee', border: '1px solid #cfe2d3', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink2 }}>
                {imei}
                <span
                  onClick={() => onRemoveImei(imei)}
                  style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, color: C.muted2, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.paper; (e.currentTarget as HTMLElement).style.color = C.bad; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.muted2; }}
                >
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                </span>
              </span>
            ))}
            <input
              style={{ flex: 1, minWidth: 220, border: 0, outline: 0, background: 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, padding: '4px 4px', color: C.ink }}
              placeholder={isComplete ? 'All IMEIs received — qty matched' : 'Scan or type IMEI · Enter to add'}
              disabled={isComplete}
              value={line.imeiInput}
              onChange={e => onPatchImeiInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {!isComplete ? (
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto', paddingRight: 4, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                <Kbd>⏎</Kbd> add · <Kbd>⌫</Kbd> remove last
              </span>
            ) : (
              <span style={{ fontSize: 11, color: C.ok, marginLeft: 'auto', paddingRight: 4, whiteSpace: 'nowrap' }}>✓ matches qty</span>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── PurchaseForm ──────────────────────────────────────────────────────────────
export function PurchaseForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { saving, error } = usePurchaseStore();
  const { save } = useSavePurchaseInvoice();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPopOpen, setSupplierPopOpen] = useState(false);
  const supplierComboRef = useRef<HTMLDivElement>(null);

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'partial'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (supplierComboRef.current && !supplierComboRef.current.contains(e.target as Node)) {
        setSupplierPopOpen(false);
      }
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
      if (!meta && /^[1-3]$/.test(e.key)) {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        const modes: ('cash' | 'credit' | 'partial')[] = ['cash', 'credit', 'partial'];
        setPaymentType(modes[parseInt(e.key, 10) - 1]);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function patchLine(i: number, patch: Partial<LineState>) {
    setLines(prev => {
      const next = [...prev];
      const m = { ...next[i], ...patch };
      m.total = Math.max(0, m.quantity * m.rate - m.discount);
      next[i] = m;
      return next;
    });
  }

  function pickItem(idx: number, item: Item) {
    patchLine(idx, {
      item_id: item.id, item_type: item.item_type, item_name: item.name,
      imeis: [], imeiInput: '',
      quantity: 1, rate: 0, discount: 0, total: 0,
    });
  }

  function addImei(idx: number, imei: string) {
    setLines(prev => {
      const n = [...prev]; const l = n[idx];
      if (l.imeis.includes(imei)) return prev;
      n[idx] = { ...l, imeis: [...l.imeis, imei], imeiInput: '' };
      return n;
    });
  }

  function removeImei(idx: number, imei: string) {
    setLines(prev => {
      const n = [...prev]; const l = n[idx];
      n[idx] = { ...l, imeis: l.imeis.filter(x => x !== imei) };
      return n;
    });
  }

  // Derived
  const filledLines = lines.filter(l => l.item_id !== 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount = lines.reduce((s, l) => s + l.total, 0);
  const cashAmountNum = parseFloat(cashAmount) || 0;
  const creditAmountNum = parseFloat(creditAmount) || 0;
  const partialSum = cashAmountNum + creditAmountNum;
  const partialDiff = partialSum - totalAmount;
  const partialBalanced = paymentType !== 'partial' || Math.abs(partialDiff) < 0.005;

  const incompleteMobileRows = filledLines.filter(l => l.item_type === 'mobile' && l.imeis.length !== l.quantity);
  const allImeisComplete = incompleteMobileRows.length === 0;
  const canSave = supplierId !== null && filledLines.length > 0 && allImeisComplete && partialBalanced;

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || (s.phone ?? '').includes(supplierSearch)
  );

  const mobileCount = filledLines.filter(l => l.item_type === 'mobile').reduce((s, l) => s + l.quantity, 0);
  const accessoryCount = filledLines.filter(l => l.item_type === 'accessory').reduce((s, l) => s + l.quantity, 0);
  const imeisReceived = filledLines.filter(l => l.item_type === 'mobile').reduce((s, l) => s + l.imeis.length, 0);

  async function handleSave() {
    if (!supplierId) { alert('Select a supplier.'); return; }
    if (filledLines.length === 0) { alert('Add at least one line item.'); return; }
    if (!allImeisComplete) { alert('All mobile lines must have IMEIs matching the quantity.'); return; }
    if (!partialBalanced) { alert('Cash + credit amounts must equal the invoice total.'); return; }

    const saveLines: PurchaseLineInput[] = filledLines.map(
      ({ imeiInput: _i, ...rest }) => rest,
    );

    let cashAmt: number;
    let creditAmt: number;
    if (paymentType === 'cash') { cashAmt = totalAmount; creditAmt = 0; }
    else if (paymentType === 'credit') { cashAmt = 0; creditAmt = totalAmount; }
    else { cashAmt = cashAmountNum; creditAmt = creditAmountNum; }

    const id = await save({
      supplier_id: supplierId,
      invoice_date: invoiceDate,
      payment_type: paymentType,
      cash_amount: cashAmt,
      credit_amount: creditAmt,
      remarks,
      lines: saveLines,
    });
    if (id !== null) onSaved();
  }
  handleSaveRef.current = handleSave;

  const inputBase: React.CSSProperties = { height: 32, padding: '0 10px', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, fontFamily: 'inherit', fontSize: 13.5, color: C.ink, width: '100%', boxSizing: 'border-box', outline: 'none' };
  const fieldDiv: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', borderRight: `1px solid ${C.line}` };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' } as React.CSSProperties;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 22px 0', gap: 16, minWidth: 980, boxSizing: 'border-box' }}>

      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.1 }}>New purchase invoice</h1>
          <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Mobile lines expand for IMEI entry — scan or type one at a time. Save unlocks once every mobile line is fully receipted.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.muted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, background: C.subtle, border: `1px solid ${C.line}`, fontSize: 11 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.muted2, display: 'inline-block' }} />
            Draft · unsaved
          </span>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', display: 'inline-block' }} />
          <span>Posts <b style={{ color: C.ink2, fontWeight: 500 }}>inventory + journal_entries</b> on save</span>
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
            Required: <b style={{ color: C.ink2 }}>Supplier</b><b style={{ color: C.ink2 }}>Date</b>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr' }}>

          {/* Supplier */}
          <div style={fieldDiv}>
            <label style={lbl}>Supplier <span style={{ color: C.bad }}>*</span></label>
            <div ref={supplierComboRef} style={{ position: 'relative' }}>
              <input
                className="sf-input"
                style={{ ...inputBase, paddingRight: 28, fontWeight: supplierId ? 500 : 'normal' }}
                value={supplierSearch}
                placeholder="Search by name or phone…"
                autoComplete="off"
                onFocus={() => setSupplierPopOpen(true)}
                onClick={() => setSupplierPopOpen(true)}
                onChange={e => { setSupplierSearch(e.target.value); setSupplierPopOpen(true); if (!e.target.value) setSupplierId(null); }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.muted, pointerEvents: 'none' }}>▾</span>
              {supplierPopOpen && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden' }}>
                  <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>
                    <input autoFocus style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: C.ink, flex: 1 }} placeholder="Type name or phone…" value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                    {filteredSuppliers.length === 0
                      ? <div style={{ padding: '14px 10px', color: C.muted, fontSize: 12.5, textAlign: 'center' }}>No suppliers found</div>
                      : filteredSuppliers.map(s => (
                        <div key={s.id}
                          onClick={() => { setSupplierId(s.id); setSupplierSearch(s.name); setSupplierPopOpen(false); }}
                          style={{ padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: s.id === supplierId ? C.subtle : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.subtle)}
                          onMouseLeave={e => (e.currentTarget.style.background = s.id === supplierId ? C.subtle : 'transparent')}
                        >
                          <div style={{ flex: 1 }}>
                            {s.name}
                            {s.phone && <div style={{ fontSize: 11.5, color: C.muted }}>{s.phone}{s.balance > 0 ? ` · ₨ ${fmtNum(s.balance)} outstanding` : ''}</div>}
                          </div>
                          {s.id === supplierId && <span style={{ color: C.muted2, fontSize: 10 }}>↵</span>}
                        </div>
                      ))
                    }
                  </div>
                  <div style={{ borderTop: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                    <span style={{ color: C.accent, cursor: 'pointer', fontWeight: 500 }}
                      onClick={async () => {
                        const name = supplierSearch.trim(); if (!name) return;
                        try { const id = await insertSupplier({ name }); const upd = await getSuppliers(); setSuppliers(upd); setSupplierId(id); setSupplierSearch(name); setSupplierPopOpen(false); } catch (err) { console.error(err); }
                      }}
                    >+ Add new supplier</span>
                    <span style={{ marginLeft: 'auto' }}><Kbd>↑↓</Kbd> nav · <Kbd>↵</Kbd> select · <Kbd>Esc</Kbd> close</span>
                  </div>
                </div>
              )}
            </div>
            {!supplierId && (
              <span style={{ fontSize: 11, color: C.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setSupplierPopOpen(true)}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: C.accent, color: C.accentFg, display: 'inline-grid', placeItems: 'center', fontSize: 10 }}>+</span>
                Add new supplier
              </span>
            )}
          </div>

          {/* Invoice No */}
          <div style={fieldDiv}>
            <label style={lbl}>Invoice no.</label>
            <input style={{ ...inputBase, background: C.subtle, color: C.muted, cursor: 'default', borderStyle: 'dashed', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' }} value="PI-####" readOnly />
            <div style={{ fontSize: 11, color: C.muted2 }}>Auto-generated on save.</div>
          </div>

          {/* Date */}
          <div style={{ ...fieldDiv, borderRight: 0 }}>
            <label style={lbl}>Invoice date <span style={{ color: C.bad }}>*</span></label>
            <input className="sf-input" type="date" style={{ ...inputBase, fontFamily: "'JetBrains Mono', monospace" }} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <div style={{ fontSize: 11, color: C.muted2 }}>Defaults to today.</div>
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
              <col style={{ width: 30 }} /><col /><col style={{ width: 110 }} />
              <col style={{ width: 90 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} />
              <col style={{ width: 150 }} /><col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr>
                {(['', 'Item', 'Type', 'Qty', 'Rate', 'Discount', 'Line total', ''] as const).map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 3 && i <= 6 ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '9px 10px', borderBottom: `1px solid ${C.line}`, background: C.subtle, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <Fragment key={i}>
                  <LineRow
                    rowNum={i + 1}
                    line={line}
                    items={items}
                    onPickItem={item => pickItem(i, item)}
                    onPatch={patch => patchLine(i, patch)}
                    onRemove={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                  />
                  {line.item_type === 'mobile' && line.item_id !== 0 && (
                    <ImeiSubRow
                      line={line}
                      onAddImei={imei => addImei(i, imei)}
                      onRemoveImei={imei => removeImei(i, imei)}
                      onPatchImeiInput={val => patchLine(i, { imeiInput: val })}
                    />
                  )}
                </Fragment>
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

      {/* ── Payment card ── */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Payment</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>
            Posts to: <b style={{ color: C.ink2 }}>cash · accounts_payable</b>
          </span>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Payment type segmented */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace", minWidth: 120 }}>Payment type <span style={{ color: C.bad }}>*</span></span>
            <div style={{ display: 'inline-flex', alignItems: 'stretch', border: `1px solid ${C.line2}`, borderRadius: 4, background: C.subtle, padding: 2, gap: 2, height: 32 }}>
              {(['cash', 'credit', 'partial'] as const).map((mode, idx) => (
                <button key={mode} type="button" onClick={() => setPaymentType(mode)} style={{ appearance: 'none', border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, color: paymentType === mode ? C.ink : C.ink2, padding: '0 12px', borderRadius: 3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, background: paymentType === mode ? C.paper : 'transparent', boxShadow: paymentType === mode ? `0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px ${C.line2}` : 'none' }}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: paymentType === mode ? C.ink2 : C.muted2, border: `1px solid ${C.line2}`, borderRadius: 2, padding: '0 3px', background: C.paper }}>{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Partial split inputs */}
          {paymentType === 'partial' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace", minWidth: 120 }}>Split</span>
              {/* Cash input */}
              <div style={{ display: 'inline-flex', alignItems: 'center', height: 36, border: `1px solid ${C.line}`, borderRadius: 4, background: C.paper, overflow: 'hidden' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', background: C.subtle, borderRight: `1px solid ${C.line}` }}>₨</span>
                <span style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace", padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Cash</span>
                <input
                  type="number" min="0" step="0.01"
                  style={{ border: 0, outline: 0, background: 'transparent', padding: '0 10px', height: '100%', width: 140, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, textAlign: 'right', color: C.ink }}
                  placeholder="0.00"
                  value={cashAmount}
                  onChange={e => setCashAmount(e.target.value)}
                />
              </div>
              {/* Credit input */}
              <div style={{ display: 'inline-flex', alignItems: 'center', height: 36, border: `1px solid ${!partialBalanced && creditAmount ? '#c98686' : C.line}`, borderRadius: 4, background: C.paper, overflow: 'hidden', boxShadow: !partialBalanced && creditAmount ? '0 0 0 2px rgba(201,134,134,0.18)' : 'none' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center', background: C.subtle, borderRight: `1px solid ${C.line}` }}>₨</span>
                <span style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace", padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Credit</span>
                <input
                  type="number" min="0" step="0.01"
                  style={{ border: 0, outline: 0, background: 'transparent', padding: '0 10px', height: '100%', width: 140, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, textAlign: 'right', color: C.ink }}
                  placeholder="0.00"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.muted }}>Must sum to invoice total</span>
            </div>
          )}

          {/* Partial validation banner */}
          {paymentType === 'partial' && (cashAmount || creditAmount) && (
            partialBalanced
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 4, fontSize: 12.5, background: C.okBg, color: C.ok, border: '1px solid #b8d8c5' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M5 8l2 2 4-4"/></svg>
                  Cash + Credit = <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>₨ {fmtNum(partialSum)}</b>. Balanced — ready to save.
                </div>
              : <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 4, fontSize: 12.5, background: C.badBg, color: C.bad, border: '1px solid #e5b8b8' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v4M8 11v.5"/></svg>
                  Cash + Credit = <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>₨ {fmtNum(partialSum)}</b>, but invoice total is <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>₨ {fmtNum(totalAmount)}</b>. Off by <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>₨ {fmtNum(Math.abs(partialDiff))}</b>. Adjust either field to balance.
                </div>
          )}
        </div>
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
            placeholder="Notes for this purchase (LC ref, container no, warranty terms…)"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
          />
          <div style={{ marginTop: 4, display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
            <span>Lines: <b style={{ color: C.ink2, fontWeight: 500 }}>{filledLines.length}</b></span>
            <span>Units: <b style={{ color: C.ink2, fontWeight: 500 }}>{lines.reduce((s, l) => s + l.quantity, 0)}</b></span>
            {mobileCount > 0 && <span>Mobile: <b style={{ color: C.ink2, fontWeight: 500 }}>{mobileCount}</b></span>}
            {accessoryCount > 0 && <span>Accessory: <b style={{ color: C.ink2, fontWeight: 500 }}>{accessoryCount}</b></span>}
            {mobileCount > 0 && (
              <span style={{ color: imeisReceived < mobileCount ? C.warn : C.ok }}>
                IMEIs received: <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>{imeisReceived} / {mobileCount}</b>
              </span>
            )}
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
            <button type="button" onClick={handleSave} disabled={saving || !canSave}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: (saving || !canSave) ? C.line2 : C.accent, color: (saving || !canSave) ? C.muted : C.accentFg, border: 'none', cursor: (saving || !canSave) ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : <><span>Save purchase</span><Kbd>Ctrl+S</Kbd></>}
            </button>
          </div>

          {/* Save reason */}
          {!canSave && filledLines.length > 0 && (
            <div style={{ fontSize: 11.5, color: C.bad, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v4M8 11v.5"/></svg>
              {incompleteMobileRows.map((l, i) => {
                const rowNum = lines.findIndex(x => x === l) + 1;
                const need = l.quantity - l.imeis.length;
                return <span key={i}>Row {rowNum} needs <b style={{ color: C.bad }}>{need} more IMEI{need > 1 ? 's' : ''}</b></span>;
              })}
              {!partialBalanced && (cashAmount || creditAmount) && (
                <><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                <span>Partial payment off by <b style={{ color: C.bad }}>₨ {fmtNum(Math.abs(partialDiff))}</b></span></>
              )}
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: C.bad, margin: 0 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

