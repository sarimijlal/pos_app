import { useState, useEffect, useRef, Fragment } from 'react';
import { useImeiScanner } from '../../../hooks/useImeiScanner';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type SplitMethod = 'cash' | 'credit' | 'bank';

interface LineState extends PurchaseLineInput {
  imeiInput: string;
}

function emptyLine(): LineState {
  return { item_id: 0, item_type: 'accessory', item_name: '', quantity: 1, rate: 0, discount: 0, total: 0, imeis: [], imeiInput: '' };
}

// ── LineRow ───────────────────────────────────────────────────────────────────

interface LineRowProps {
  rowNum: number;
  line: LineState;
  items: Item[];
  submitted: boolean;
  onPickItem: (item: Item) => void;
  onPatch: (patch: Partial<LineState>) => void;
  onRemove: () => void;
  onActivate: () => void;
}

function LineRow({ rowNum, line, items, submitted, onPickItem, onPatch, onRemove, onActivate }: LineRowProps) {
  const [rowHovered, setRowHovered] = useState(false);
  const [itemPopOpen, setItemPopOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [itemPopPos, setItemPopPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const itemComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (itemComboRef.current && !itemComboRef.current.contains(e.target as Node)) setItemPopOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const isEmpty = line.item_id === 0;
  const isMobile = line.item_type === 'mobile';
  const imeiComplete = isMobile && !isEmpty && line.imeis.length === line.quantity && line.quantity > 0;
  const imeiIncomplete = isMobile && !isEmpty && line.imeis.length < line.quantity;
  const rateInvalid = submitted && !isEmpty && (line.rate <= 0 || isNaN(line.rate));
  const filteredItems = items.filter(it => !itemSearch || it.name.toLowerCase().includes(itemSearch.toLowerCase()));

  const tdBg = rowHovered && !isEmpty ? 'var(--c-subtle)' : C.paper;
  const td: React.CSSProperties = { padding: 0, borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle', position: 'relative', background: tdBg };
  const cellIn: React.CSSProperties = { width: '100%', height: 44, border: 0, outline: 0, background: 'transparent', padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: C.ink };
  const firstTdExtra: React.CSSProperties = imeiComplete ? { boxShadow: `inset 2px 0 0 ${C.ok}` } : imeiIncomplete ? { boxShadow: `inset 2px 0 0 ${C.warn}` } : {};

  return (
    <tr onMouseEnter={() => { setRowHovered(true); onActivate(); }} onMouseLeave={() => setRowHovered(false)}>

      {/* # */}
      <td style={{ ...td, ...firstTdExtra, textAlign: 'center', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
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
      <td style={{ ...td, paddingLeft: 10 }}>
        {isEmpty ? (
          <span style={{ color: C.muted2, fontSize: 11.5 }}>—</span>
        ) : isMobile ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6, background: imeiComplete ? C.okBg : line.imeis.length > 0 ? C.warnBg : C.subtle, color: imeiComplete ? C.ok : line.imeis.length > 0 ? C.warn : C.muted2, border: `1px solid ${imeiComplete ? '#b8d8c5' : line.imeis.length > 0 ? '#d9bf6c' : C.line}` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
            {line.imeis.length} / {line.quantity} IMEIs
          </span>
        ) : (
          <span style={{ color: C.muted2, fontSize: 11.5 }}>—</span>
        )}
      </td>

      {/* Qty */}
      <td style={td}>
        <input className="sf-cell" type="number" min="1" step="1"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent', color: isEmpty ? C.muted : C.ink, cursor: isEmpty ? 'not-allowed' : 'text' }}
          value={isEmpty ? '' : line.quantity} placeholder={isEmpty ? '—' : '1'} disabled={isEmpty}
          onChange={e => onPatch({ quantity: Math.max(1, Number(e.target.value)) })}
        />
      </td>

      {/* Rate */}
      <td style={{ ...td, boxShadow: rateInvalid ? `inset 0 0 0 2px ${C.bad}` : 'none' }}>
        <input className="sf-cell" type="number" min="0.01" step="0.01"
          style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', background: isEmpty ? C.subtle : 'transparent', color: rateInvalid ? C.bad : C.ink }}
          value={isEmpty ? '' : (line.rate || '')} placeholder="0.00" disabled={isEmpty}
          onChange={e => onPatch({ rate: Number(e.target.value) })}
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
        <input className="sf-cell-ro" style={{ ...cellIn, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600, background: C.subtle, color: C.muted, cursor: 'not-allowed' }}
          value={isEmpty ? '' : fmtNum(line.total)} placeholder="0.00" readOnly
        />
      </td>

      {/* Remove */}
      <td style={td}>
        <button type="button" onClick={onRemove}
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
  colSpan: number;
  onAddImei: (imei: string) => void;
  onRemoveImei: (imei: string) => void;
  onPatchImeiInput: (val: string) => void;
}

function ImeiSubRow({ line, colSpan, onAddImei, onRemoveImei, onPatchImeiInput }: ImeiSubRowProps) {
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
      <td colSpan={colSpan} style={{ background: 'var(--c-sidebar)', padding: '10px 14px 14px', borderTop: `1px dashed ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
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
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 40, padding: '6px 8px', background: C.paper, border: `1px solid ${isComplete ? '#b8d8c5' : entered > 0 ? '#d9bf6c' : C.line}`, borderRadius: 4, boxShadow: isComplete ? '0 0 0 2px rgba(15,122,74,0.1)' : entered > 0 ? '0 0 0 2px rgba(217,191,108,0.18)' : 'none' }}>
            {line.imeis.map(imei => (
              <span key={imei} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 4px 0 8px', background: '#eef5ee', border: '1px solid #cfe2d3', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink2 }}>
                {imei}
                <span onClick={() => onRemoveImei(imei)}
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
            {!isComplete
              ? <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto', paddingRight: 4, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}><Kbd>⏎</Kbd> add · <Kbd>⌫</Kbd> remove last</span>
              : <span style={{ fontSize: 11, color: C.ok, marginLeft: 'auto', paddingRight: 4, whiteSpace: 'nowrap' }}>✓ matches qty</span>
            }
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
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'bank' | 'partial'>('cash');
  const [splitMethod0, setSplitMethod0] = useState<SplitMethod>('cash');
  const [splitAmount0, setSplitAmount0] = useState('');
  const [splitMethod1, setSplitMethod1] = useState<SplitMethod>('credit');
  const [splitAmount1, setSplitAmount1] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (supplierComboRef.current && !supplierComboRef.current.contains(e.target as Node)) setSupplierPopOpen(false);
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
    patchLine(idx, { item_id: item.id, item_type: item.item_type, item_name: item.name, imeis: [], imeiInput: '', quantity: 1, rate: 0, discount: 0, total: 0 });
  }

  function addImei(idx: number, imei: string) {
    setLines(prev => { const n = [...prev]; const l = n[idx]; if (l.imeis.includes(imei)) return prev; n[idx] = { ...l, imeis: [...l.imeis, imei], imeiInput: '' }; return n; });
  }

  function removeImei(idx: number, imei: string) {
    setLines(prev => { const n = [...prev]; const l = n[idx]; n[idx] = { ...l, imeis: l.imeis.filter(x => x !== imei) }; return n; });
  }

  useImeiScanner((imei) => {
    const line = lines[activeLineIdx];
    if (!line || line.item_id === 0 || line.item_type !== 'mobile') return;
    if (line.imeis.length >= line.quantity) return;
    addImei(activeLineIdx, imei);
  });

  // Derived values
  const filledLines = lines.filter(l => l.item_id !== 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const totalAmount = lines.reduce((s, l) => s + l.total, 0);
  const allRatesPositive = filledLines.length > 0 && filledLines.every(l => l.rate > 0);
  const incompleteMobileRows = filledLines.filter(l => l.item_type === 'mobile' && l.imeis.length !== l.quantity);
  const allImeisComplete = incompleteMobileRows.length === 0;
  const filteredSuppliers = suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || (s.phone ?? '').includes(supplierSearch));

  // Partial split validation
  const split0 = parseFloat(splitAmount0) || 0;
  const split1 = parseFloat(splitAmount1) || 0;
  const splitSum = split0 + split1;
  const splitMethodsDistinct = splitMethod0 !== splitMethod1;
  const partialBalanced = paymentType !== 'partial' || (splitMethodsDistinct && Math.abs(splitSum - totalAmount) < 0.005 && split0 > 0 && split1 > 0);

  const checks = [
    { ok: supplierId !== null, label: 'Supplier selected' },
    { ok: !!invoiceDate, label: 'Invoice date set' },
    { ok: filledLines.length > 0, label: 'At least one line item' },
    { ok: allRatesPositive, label: 'All rates > 0' },
    { ok: allImeisComplete, label: 'All mobile IMEIs receipted' },
    ...(paymentType === 'partial' ? [{ ok: partialBalanced, label: 'Payment split balances' }] : []),
  ];
  const canSave = checks.every(c => c.ok);

  function buildSplitAmounts() {
    const result = { cash_amount: 0, credit_amount: 0, bank_amount: 0 };
    if (paymentType === 'cash') { result.cash_amount = totalAmount; }
    else if (paymentType === 'credit') { result.credit_amount = totalAmount; }
    else if (paymentType === 'bank') { result.bank_amount = totalAmount; }
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
    const saveLines: PurchaseLineInput[] = filledLines.map(({ imeiInput: _i, ...rest }) => rest);
    const amounts = buildSplitAmounts();
    const id = await save({
      supplier_id: supplierId!,
      invoice_date: invoiceDate,
      payment_type: paymentType,
      ...amounts,
      bank_account_id: null,
      remarks,
      lines: saveLines,
    });
    if (id !== null) onSaved();
  }
  handleSaveRef.current = handleSave;

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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.1 }}>New purchase invoice</h1>
            <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Choose a supplier, add stock, then scan an IMEI for every phone received.</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr' }}>

            {/* Supplier */}
            <div style={fieldDiv}>
              <label style={lbl}>Supplier <span style={{ color: C.bad }}>*</span></label>
              <div ref={supplierComboRef} style={{ position: 'relative' }}>
                <input className="sf-input"
                  style={{ ...inputBase, paddingRight: 28, fontWeight: supplierId ? 500 : 'normal', border: formSubmitted && !supplierId ? `1px solid ${C.bad}` : `1px solid ${C.line2}` }}
                  value={supplierSearch} placeholder="Search by name or phone…" autoComplete="off"
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
                              {s.phone && <div style={{ fontSize: 11.5, color: C.muted }}>{s.phone}</div>}
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
                <col style={{ width: 30 }} /><col /><col style={{ width: 108 }} /><col style={{ width: 190 }} />
                <col style={{ width: 84 }} /><col style={{ width: 140 }} /><col style={{ width: 120 }} />
                <col style={{ width: 150 }} /><col style={{ width: 48 }} />
              </colgroup>
              <thead>
                <tr>
                  {(['', 'Item', 'Type', 'IMEI / Stock', 'Qty', 'Rate', 'Discount', 'Line total', ''] as const).map((h, i) => (
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
                      onRemove={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                      onActivate={() => setActiveLineIdx(i)}
                    />
                    {line.item_type === 'mobile' && line.item_id !== 0 && (
                      <ImeiSubRow
                        line={line} colSpan={7}
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
              placeholder="Notes for this purchase (LC ref, container no, warranty terms…)"
              value={remarks} onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── form-aside ── */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

        {/* Checklist card */}
        <div style={cardStyle}>
          <div style={{ ...cardHead }}>
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
              {paymentType === 'cash' ? 'cash · inventory' : paymentType === 'credit' ? 'payable · inventory' : paymentType === 'bank' ? 'bank · inventory' : 'split · inventory'}
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
                  <button key={mode} type="button" onClick={() => setPaymentType(mode)}
                    style={{ border: 0, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, padding: '5px 0', borderRadius: 3, cursor: 'pointer', background: paymentType === mode ? C.paper : 'transparent', color: paymentType === mode ? C.ink : C.ink2, boxShadow: paymentType === mode ? `0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px ${C.line2}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: paymentType === mode ? C.muted2 : C.muted2, border: `1px solid ${C.line}`, borderRadius: 2, padding: '0 3px', lineHeight: '14px', background: C.paper }}>{idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Partial split */}
            {paymentType === 'partial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Split <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: C.muted2 }}>— must sum to total</span>
                </div>
                {[
                  { method: splitMethod0, amount: splitAmount0, setMethod: (m: SplitMethod) => { setSplitMethod0(m); if (m === splitMethod1) setSplitMethod1(splitMethod0); }, setAmount: setSplitAmount0, label: 'Leg 1' },
                  { method: splitMethod1, amount: splitAmount1, setMethod: (m: SplitMethod) => { setSplitMethod1(m); if (m === splitMethod0) setSplitMethod0(splitMethod1); }, setAmount: setSplitAmount1, label: 'Leg 2' },
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
                {saving ? 'Saving…' : <><span>Save purchase</span><Kbd>⌘S</Kbd></>}
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
