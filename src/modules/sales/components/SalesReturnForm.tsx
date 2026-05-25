import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getSalesInvoices, getSalesInvoiceById, saveSalesReturn } from '../../../db/repositories/sales';
import type { SalesInvoiceRow, SalesInvoiceDetail, SalesReturnLineInput, SaveSalesReturnInput } from '../types';

import { C } from '../../../lib/theme';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString('en-US');
const todayIso = () => new Date().toISOString().slice(0, 10);
const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

type LineDetail = SalesInvoiceDetail['lines'][0];
type LineState = { checked: boolean; selectedImeis: Set<string>; qty: number };

const isMobileLine = (line: LineDetail) => line.imeis.length > 0;
const returnableImeis = (line: LineDetail) => line.imeis.filter(i => i.status === 'sold');
const lineUnits = (line: LineDetail, s: LineState) => !s.checked ? 0 : isMobileLine(line) ? s.selectedImeis.size : s.qty;
const lineAmount = (line: LineDetail, s: LineState) => lineUnits(line, s) * line.sale_price;
const lineCost = (line: LineDetail, s: LineState) => lineUnits(line, s) * line.cost_price;

function Dot() {
  return <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', display: 'inline-block' }} />;
}

function ColLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>;
}

function TypeChip({ type }: { type: 'mobile' | 'accessory' }) {
  const mobile = type === 'mobile';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px',
      borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
      marginRight: 6, verticalAlign: '1px',
      background: mobile ? C.infoBg : '#ececea',
      color: mobile ? C.info : C.ink2,
      border: `1px solid ${mobile ? 'rgba(31,58,138,0.22)' : C.line2}`,
    }}>
      {mobile ? 'Mobile' : 'Acc.'}
    </span>
  );
}

function ImeiBadge({ imei, status }: { imei: string; status: string }) {
  const colors: Record<string, { bg: string; border: string; pip: string; label: string }> = {
    sold: { bg: 'rgba(15,122,74,0.05)', border: 'rgba(15,122,74,0.28)', pip: C.ok, label: C.ok },
    in_stock: { bg: 'rgba(31,58,138,0.05)', border: 'rgba(31,58,138,0.26)', pip: C.info, label: C.info },
    returned: { bg: 'rgba(138,106,0,0.06)', border: 'rgba(138,106,0,0.30)', pip: C.warn, label: C.warn },
  };
  const c = colors[status] ?? colors.sold;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, padding: '3px 7px 3px 6px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: C.ink2, letterSpacing: '0.02em' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.pip, flexShrink: 0 }} />
      {imei}
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.label }}>
        {status === 'sold' ? 'Sold' : status === 'in_stock' ? 'In Stock' : 'Returned'}
      </span>
    </span>
  );
}

function PayTag({ mode }: { mode: string }) {
  const labels: Record<string, string> = { cash: 'Cash', credit: 'Credit', card: 'Card', bank: 'Bank transfer' };
  return <span style={{ fontSize: 12.5, color: C.ink2, fontWeight: 500 }}>{labels[mode] ?? mode}</span>;
}

function IndeterminateCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      style={{ width: 16, height: 16, cursor: 'pointer', margin: 0, accentColor: C.accent }} />
  );
}

function OriginalInvoiceCard({ invoice }: { invoice: SalesInvoiceDetail }) {
  const totalUnits = invoice.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <div style={{
      background: `repeating-linear-gradient(135deg, var(--c-hatch) 0 2px, transparent 2px 7px), var(--c-subtle)`,
      border: `1px dashed ${C.line2}`, borderRadius: 6, position: 'relative',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.muted2, borderRadius: '6px 0 0 6px', opacity: 0.55 }} />

      {/* Lock header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px dashed ${C.line2}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 7px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 999, color: C.ink2, textTransform: 'none', letterSpacing: 0, fontSize: 11, fontWeight: 500 }}>
          <svg viewBox="0 0 16 16" width="10" height="10" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}><rect x="3" y="7" width="10" height="6" rx="1" /><path d="M5 7V5a3 3 0 016 0v2" /></svg>
          Original invoice
        </span>
        <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11.5, color: C.muted }}>Read-only · cannot be edited</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted2, textTransform: 'none', letterSpacing: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{invoice.invoice_no} · v1</span>
          <Dot />
          <span>Created {invoice.created_at?.slice(0, 10) ?? invoice.date}</span>
        </span>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1.4fr 130px 130px 1fr', borderBottom: `1px dashed ${C.line2}` }}>
        {[
          { k: 'Invoice no.', v: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.invoice_no}</span>, sub: `id #${invoice.id}` },
          { k: 'Customer', v: invoice.customer_name, sub: null },
          { k: 'Date', v: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.date}</span>, sub: null },
          { k: 'Payment', v: <PayTag mode={invoice.payment_mode} />, sub: null },
          { k: 'Salesperson', v: invoice.salesperson_name ?? '—', sub: null },
        ].map((cell, i) => (
          <div key={i} style={{ padding: '12px 14px', borderRight: i < 4 ? `1px dashed ${C.line2}` : 'none', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{cell.k}</div>
            <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.v}</div>
            {cell.sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{cell.sub}</div>}
          </div>
        ))}
      </div>

      {/* Line table */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 'auto' }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr>
            {['Item', 'Qty', 'Sale price', 'Cost price', 'Line total'].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '9px 12px', borderBottom: `1px dashed ${C.line2}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => {
            const mobile = isMobileLine(line);
            const isLast = i === invoice.lines.length - 1;
            return (
              <tr key={line.id}>
                <td style={{ padding: 12, borderBottom: isLast ? 'none' : `1px dashed ${C.line2}`, verticalAlign: 'top' }}>
                  <div style={{ color: C.ink, fontWeight: 500, lineHeight: 1.25 }}>
                    <TypeChip type={mobile ? 'mobile' : 'accessory'} />
                    {line.item_name}
                  </div>
                  {mobile && line.imeis.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {line.imeis.map(im => <ImeiBadge key={im.imei} imei={im.imei} status={im.status} />)}
                    </div>
                  )}
                </td>
                <td style={{ padding: 12, borderBottom: isLast ? 'none' : `1px dashed ${C.line2}`, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', verticalAlign: 'top' }}>{line.quantity}</td>
                <td style={{ padding: 12, borderBottom: isLast ? 'none' : `1px dashed ${C.line2}`, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', verticalAlign: 'top' }}>{fmt(line.sale_price)}</td>
                <td style={{ padding: 12, borderBottom: isLast ? 'none' : `1px dashed ${C.line2}`, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: C.muted, verticalAlign: 'top' }}>{fmt(line.cost_price)}</td>
                <td style={{ padding: 12, borderBottom: isLast ? 'none' : `1px dashed ${C.line2}`, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: C.ink, verticalAlign: 'top' }}>{fmt(line.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Foot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: `1px dashed ${C.line2}`, background: 'var(--c-sidebar)', borderRadius: '0 0 6px 6px', fontSize: 12, color: C.muted }}>
        <span>{invoice.lines.length} line items · {totalUnits} units</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Invoice total</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: C.ink, fontWeight: 600 }}>
            <span style={{ color: C.muted2, fontSize: 11.5, fontWeight: 500, marginRight: 2 }}>₨</span>
            {fmt(invoice.total_amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface Props { initialInvoiceId?: number | null; onSaved: () => void; onCancel: () => void; }

export function SalesReturnForm({ initialInvoiceId, onSaved, onCancel }: Props) {
  const [invoiceId, setInvoiceId] = useState<number | null>(initialInvoiceId ?? null);
  const [invoice, setInvoice] = useState<SalesInvoiceDetail | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [lineStates, setLineStates] = useState<Record<number, LineState>>({});
  const [returnDate, setReturnDate] = useState(todayIso);
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'invoice' | null>('today');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(!initialInvoiceId);
  const [invoiceList, setInvoiceList] = useState<SalesInvoiceRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    setLoadingList(true);
    getSalesInvoices()
      .then(rows => setInvoiceList(rows.filter(r => r.status === 'active')))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingList(false));
    setTimeout(() => pickerInputRef.current?.focus(), 60);
  }, [showPicker]);

  useEffect(() => {
    if (invoiceId === null) return;
    setLoadingInvoice(true);
    setInvoice(null);
    getSalesInvoiceById(invoiceId)
      .then(detail => {
        if (!detail) { setError('Invoice not found'); return; }
        setInvoice(detail);
        const states: Record<number, LineState> = {};
        for (const line of detail.lines) {
          states[line.id] = { checked: false, selectedImeis: new Set(), qty: 1 };
        }
        setLineStates(states);
        setReturnDate(todayIso());
        setDatePreset('today');
        setRemarks('');
        setError(null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoadingInvoice(false));
  }, [invoiceId]);

  const { selLines, totalUnits, totalAmount, totalCost } = useMemo(() => {
    if (!invoice) return { selLines: 0, totalUnits: 0, totalAmount: 0, totalCost: 0 };
    let selLines = 0, totalUnits = 0, totalAmount = 0, totalCost = 0;
    for (const line of invoice.lines) {
      const s = lineStates[line.id];
      if (!s?.checked) continue;
      selLines++;
      totalUnits += lineUnits(line, s);
      totalAmount += lineAmount(line, s);
      totalCost += lineCost(line, s);
    }
    return { selLines, totalUnits, totalAmount, totalCost };
  }, [invoice, lineStates]);

  const handleSave = useCallback(async () => {
    if (!invoice || totalUnits === 0 || saving) return;
    const lines: SalesReturnLineInput[] = [];
    for (const line of invoice.lines) {
      const s = lineStates[line.id];
      if (!s?.checked) continue;
      const mobile = isMobileLine(line);
      const qty = mobile ? s.selectedImeis.size : s.qty;
      if (qty === 0) continue;
      lines.push({ sales_invoice_line_id: line.id, quantity_returned: qty, imeis: mobile ? Array.from(s.selectedImeis) : [] });
    }
    if (lines.length === 0) return;
    const input: SaveSalesReturnInput = {
      original_invoice_id: invoice.id,
      return_date: returnDate,
      remarks: remarks.trim() || undefined,
      lines,
    };
    setSaving(true);
    setError(null);
    try {
      await saveSalesReturn(input);
      onSaved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }, [invoice, lineStates, returnDate, remarks, totalUnits, saving, onSaved]);

  const handleSelectAll = useCallback(() => {
    if (!invoice) return;
    const allChecked = invoice.lines.every(l => lineStates[l.id]?.checked);
    setLineStates(prev => {
      const next = { ...prev };
      for (const line of invoice.lines) {
        const mobile = isMobileLine(line);
        if (allChecked) {
          next[line.id] = { ...next[line.id], checked: false };
        } else {
          next[line.id] = {
            checked: true,
            selectedImeis: mobile ? new Set(returnableImeis(line).map(i => i.imei)) : (next[line.id]?.selectedImeis ?? new Set()),
            qty: mobile ? (next[line.id]?.qty ?? 1) : line.quantity,
          };
        }
      }
      return next;
    });
  }, [invoice, lineStates]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); return; }
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && invoice) handleSelectAll();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel, handleSave, handleSelectAll, invoice]);

  const filteredInvoices = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return invoiceList;
    return invoiceList.filter(inv => inv.invoice_no.toLowerCase().includes(q) || inv.customer_name.toLowerCase().includes(q));
  }, [invoiceList, pickerSearch]);

  const selectInvoice = (id: number) => {
    setInvoiceId(id);
    setShowPicker(false);
    setPickerSearch('');
  };

  const allChecked = invoice ? invoice.lines.every(l => lineStates[l.id]?.checked) : false;
  const someChecked = invoice ? invoice.lines.some(l => lineStates[l.id]?.checked) : false;
  const indeterminate = someChecked && !allChecked;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 1080 }}>

        {/* Page head */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 10 }}>
              Sales return
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: C.warnBg, color: C.warn, border: '1px solid rgba(138,106,0,0.28)', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Draft
              </span>
            </h1>
            <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>
              Tick the lines and units the customer is returning. The original invoice above is read-only.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: C.muted }}>
            <span>Auto-ref <b style={{ color: C.ink2, fontWeight: 500 }}>SR-draft</b></span>
          </div>
        </div>

        {/* Picker strip */}
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
            Source invoice
          </span>
          {invoice ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, background: C.infoBg, border: '1px solid rgba(31,58,138,0.22)', color: C.info, padding: '3px 8px', borderRadius: 3 }}>
                {invoice.invoice_no}
              </span>
              <span style={{ fontSize: 12.5, color: C.muted, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b style={{ color: C.ink2, fontWeight: 500 }}>{invoice.customer_name}</b>
                <Dot /><span>{invoice.date}</span>
                <Dot /><span>{invoice.lines.length} lines</span>
                <Dot /><span>₨ {fmtNum(invoice.total_amount)}</span>
              </span>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: 13, color: C.muted2, fontStyle: 'italic' }}>
              {loadingInvoice ? 'Loading…' : 'No invoice selected — choose below'}
            </div>
          )}
          <button
            onClick={() => setShowPicker(v => !v)}
            style={{ fontSize: 12, color: C.accent, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(31,58,138,0.24)', background: 'rgba(31,58,138,0.04)', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" style={{ stroke: C.accent, fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            {invoice ? 'Change invoice' : 'Select invoice'}
          </button>

          {/* Picker dropdown */}
          {showPicker && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}`, background: C.subtle }}>
                <input
                  ref={pickerInputRef}
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Search invoice no. or customer…"
                  style={{ width: '100%', height: 32, border: `1px solid ${C.line2}`, borderRadius: 4, padding: '0 10px', fontSize: 13, background: C.paper, color: C.ink, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {loadingList && <div style={{ padding: '16px 14px', fontSize: 13, color: C.muted, textAlign: 'center' }}>Loading…</div>}
                {!loadingList && filteredInvoices.length === 0 && <div style={{ padding: '16px 14px', fontSize: 13, color: C.muted, textAlign: 'center' }}>No active invoices found</div>}
                {!loadingList && filteredInvoices.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => selectInvoice(inv.id)}
                    style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: `1px solid ${C.line}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.subtle; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                  >
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: C.info, background: C.infoBg, padding: '2px 7px', borderRadius: 3, border: '1px solid rgba(31,58,138,0.18)', flexShrink: 0 }}>
                      {inv.invoice_no}
                    </span>
                    <span style={{ fontSize: 13, color: C.ink2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.customer_name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.muted, flexShrink: 0 }}>{inv.date}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.ink2, flexShrink: 0 }}>₨ {fmtNum(inv.total_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingInvoice && (
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Loading invoice…
          </div>
        )}

        {/* Empty state */}
        {!invoice && !loadingInvoice && !showPicker && (
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, padding: '60px 20px', textAlign: 'center', color: C.muted }}>
            <div style={{ fontSize: 15, marginBottom: 10 }}>Select a source invoice to start the return</div>
            <button onClick={() => setShowPicker(true)} style={{ fontSize: 13, color: C.accent, border: '1px solid rgba(31,58,138,0.24)', background: C.infoBg, borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Select invoice
            </button>
          </div>
        )}

        {/* Main content: only when invoice is loaded */}
        {invoice && !loadingInvoice && (
          <>
            {/* Original invoice card */}
            <OriginalInvoiceCard invoice={invoice} />

            {/* Seam */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: C.muted, margin: '2px 4px' }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 10px', background: 'rgba(31,58,138,0.06)', border: '1px solid rgba(31,58,138,0.22)', borderRadius: 999 }}>
                <svg viewBox="0 0 16 16" width="11" height="11" style={{ stroke: C.accent, fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M8 3v10M3 8h10" /></svg>
                Select items to return
              </div>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>

            {/* Return card */}
            <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              {/* Card head */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <span>Return lines</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.ink2, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 999, padding: '1px 7px', letterSpacing: 0, textTransform: 'none' }}>
                  {selLines} of {invoice.lines.length} lines
                </span>
                {totalUnits > 0 && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: 'rgba(31,58,138,0.06)', color: C.accent, border: '1px solid rgba(31,58,138,0.22)', letterSpacing: 0, textTransform: 'none' }}>
                    {totalUnits} unit{totalUnits !== 1 ? 's' : ''} selected
                  </span>
                )}
              </div>

              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.subtle, borderBottom: `1px solid ${C.line}` }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.ink2, fontWeight: 500, cursor: 'pointer', padding: '4px 10px 4px 6px', border: `1px solid ${C.line2}`, background: C.paper, borderRadius: 4 }}>
                  <IndeterminateCheckbox checked={allChecked} indeterminate={indeterminate} onChange={handleSelectAll} />
                  Select all lines
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 4px', background: C.subtle, marginLeft: 6 }}>A</span>
                </label>
                <div style={{ color: C.muted, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ color: C.ink2, fontWeight: 500 }}>{invoice.lines.length}</b> lines
                  <Dot />
                  <b style={{ color: C.ink2, fontWeight: 500 }}>{invoice.lines.reduce((s, l) => s + l.quantity, 0)}</b> units total
                </div>
                <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 11, color: C.muted }}>
                  {[
                    { pip: 'rgba(15,122,74,0.25)', border: 'rgba(15,122,74,0.5)', label: 'Returnable' },
                    { pip: C.accent, border: C.accent, label: 'Selected' },
                    { pip: C.subtle, border: C.line2, label: 'Locked' },
                  ].map(({ pip, border, label }) => (
                    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: pip, border: `1px solid ${border}` }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Column header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(220px, 1fr) 80px 130px 140px 160px', background: C.subtle, cursor: 'default' }}>
                <div style={{ padding: '10px 14px' }} />
                <div style={{ padding: '10px 12px' }}><ColLabel>Item</ColLabel></div>
                <div style={{ padding: '10px 12px', textAlign: 'right' }}><ColLabel>Orig qty</ColLabel></div>
                <div style={{ padding: '10px 12px', textAlign: 'right' }}><ColLabel>Sale price</ColLabel></div>
                <div style={{ padding: '10px 12px', textAlign: 'right' }}><ColLabel>Return qty</ColLabel></div>
                <div style={{ padding: '10px 12px', textAlign: 'right' }}><ColLabel>Return amount</ColLabel></div>
              </div>

              {/* Lines */}
              <div>
                {invoice.lines.map((line, idx) => {
                  const s = lineStates[line.id] ?? { checked: false, selectedImeis: new Set(), qty: 1 };
                  const mobile = isMobileLine(line);
                  const units = lineUnits(line, s);
                  const amount = lineAmount(line, s);
                  const retImeis = returnableImeis(line);
                  const isLast = idx === invoice.lines.length - 1;

                  return (
                    <div key={line.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '36px minmax(220px, 1fr) 80px 130px 140px 160px',
                      alignItems: 'flex-start',
                      borderBottom: isLast ? 'none' : `1px solid ${C.line}`,
                      background: s.checked ? 'rgba(31,58,138,0.04)' : undefined,
                      transition: 'background 0.12s',
                    }}>
                      {/* Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 16, paddingLeft: 14, paddingBottom: 14 }}>
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={e => {
                            const checked = e.target.checked;
                            setLineStates(prev => ({ ...prev, [line.id]: { ...prev[line.id], checked } }));
                          }}
                          style={{ width: 16, height: 16, cursor: 'pointer', margin: 0, accentColor: C.accent }}
                        />
                      </div>

                      {/* Item info */}
                      <div style={{ padding: '14px 12px' }}>
                        <div style={{ color: C.ink, fontWeight: 500, lineHeight: 1.25 }}>
                          <TypeChip type={mobile ? 'mobile' : 'accessory'} />
                          {line.item_name}
                        </div>
                        <div style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>
                          {mobile
                            ? `${retImeis.length} returnable unit${retImeis.length !== 1 ? 's' : ''} · pick IMEIs to return`
                            : 'Accessory — quantity-based · set return qty'}
                        </div>
                      </div>

                      {/* Orig qty */}
                      <div style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                        <div style={{ fontSize: 13, color: C.ink2 }}>{line.quantity}</div>
                        <div style={{ fontSize: 11.5, color: C.muted }}>{mobile ? 'units' : 'pcs'}</div>
                      </div>

                      {/* Sale price */}
                      <div style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: C.muted }}>
                        <b style={{ color: C.ink2, fontWeight: 500 }}>{fmtNum(line.sale_price)}</b>
                        <br />
                        <span style={{ fontSize: 11 }}>per {mobile ? 'unit' : 'pc'}</span>
                      </div>

                      {/* Return qty */}
                      <div style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {s.checked ? (
                          <>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: C.ink, fontWeight: 600 }}>{units}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>of {line.quantity} {mobile ? 'sold' : 'pcs'}</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: C.muted, fontWeight: 500 }}>—</div>
                            <div style={{ fontSize: 11, color: C.muted2 }}>tick line to pick</div>
                          </>
                        )}
                      </div>

                      {/* Return amount */}
                      <div style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: s.checked ? C.ink : C.muted2, fontWeight: s.checked ? 600 : 500 }}>
                        {s.checked ? fmt(amount) : '—'}
                      </div>

                      {/* Interactive zone */}
                      {s.checked && (
                        <div style={{ gridColumn: '2 / -1', padding: '0 12px 12px', marginTop: -2 }}>
                          {mobile ? (
                            /* IMEI picker */
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, background: C.paper, border: `1px dashed ${C.line2}`, borderRadius: 4 }}>
                              <div style={{ width: '100%', fontSize: 11, color: C.muted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {retImeis.length} sold unit{retImeis.length !== 1 ? 's' : ''} returnable.{' '}
                                <b style={{ color: C.ink2 }}>{s.selectedImeis.size} selected</b>
                                {retImeis.length - s.selectedImeis.size > 0 && `, ${retImeis.length - s.selectedImeis.size} still with customer`}.
                              </div>
                              {line.imeis.map(imei => {
                                const isReturnable = imei.status === 'sold';
                                const isSel = s.selectedImeis.has(imei.imei);
                                return (
                                  <div
                                    key={imei.imei}
                                    onClick={() => {
                                      if (!isReturnable) return;
                                      setLineStates(prev => {
                                        const cur = prev[line.id];
                                        const next = new Set(cur.selectedImeis);
                                        if (next.has(imei.imei)) next.delete(imei.imei); else next.add(imei.imei);
                                        return { ...prev, [line.id]: { ...cur, selectedImeis: next } };
                                      });
                                    }}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 7,
                                      fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
                                      padding: '4px 9px 4px 7px', borderRadius: 3, letterSpacing: '0.02em',
                                      cursor: isReturnable ? 'pointer' : 'not-allowed',
                                      userSelect: 'none', transition: 'background 0.1s, border-color 0.1s',
                                      ...(isReturnable && isSel
                                        ? { background: C.accent, border: `1px solid ${C.accent}`, color: C.accentFg }
                                        : isReturnable
                                        ? { background: C.paper, border: '1px solid rgba(15,122,74,0.36)', color: C.ink2 }
                                        : { background: C.subtle, border: `1px dashed ${C.line}`, color: C.muted2 }
                                      ),
                                    }}
                                  >
                                    {/* tick box (hidden for disabled) */}
                                    {isReturnable && (
                                      <span style={{ width: 14, height: 14, border: isSel ? 'none' : `1.5px solid ${C.line2}`, borderRadius: 3, display: 'inline-grid', placeItems: 'center', background: isSel ? 'rgba(255,255,255,0.9)' : C.paper, flexShrink: 0 }}>
                                        {isSel && <span style={{ width: 7, height: 4, borderLeft: `1.5px solid ${C.accent}`, borderBottom: `1.5px solid ${C.accent}`, transform: 'rotate(-45deg) translate(1px,-1px)', display: 'block' }} />}
                                      </span>
                                    )}
                                    {/* pip */}
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isReturnable ? (isSel ? 'rgba(255,255,255,0.85)' : C.ok) : C.muted2 }} />
                                    {imei.imei}
                                    {!isReturnable && (
                                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: imei.status === 'returned' ? C.warn : C.info, opacity: 0.8 }}>
                                        {imei.status === 'returned' ? 'Returned' : 'In Stock'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Qty stepper for accessories */
                            <div style={{ padding: '10px 12px', background: C.paper, border: `1px dashed ${C.line2}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span style={{ fontSize: 12, color: C.muted }}>Return quantity</span>
                              <div style={{ display: 'inline-flex', alignItems: 'stretch', border: `1px solid ${C.line2}`, borderRadius: 4, overflow: 'hidden', height: 32 }}>
                                <button
                                  onClick={() => setLineStates(prev => ({ ...prev, [line.id]: { ...prev[line.id], qty: Math.max(1, prev[line.id].qty - 1) } }))}
                                  disabled={s.qty <= 1}
                                  style={{ width: 30, background: C.subtle, border: 0, color: s.qty <= 1 ? C.muted2 : C.ink2, fontSize: 14, cursor: s.qty <= 1 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center' }}
                                >−</button>
                                <input
                                  type="number" min={1} max={line.quantity} value={s.qty}
                                  onChange={e => {
                                    let v = parseInt(e.target.value || '1', 10);
                                    if (isNaN(v)) v = 1;
                                    v = Math.max(1, Math.min(line.quantity, v));
                                    setLineStates(prev => ({ ...prev, [line.id]: { ...prev[line.id], qty: v } }));
                                  }}
                                  style={{ width: 60, height: '100%', padding: 0, border: 0, outline: 0, borderLeft: `1px solid ${C.line2}`, borderRight: `1px solid ${C.line2}`, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, color: C.ink, background: C.paper }}
                                />
                                <button
                                  onClick={() => setLineStates(prev => ({ ...prev, [line.id]: { ...prev[line.id], qty: Math.min(line.quantity, prev[line.id].qty + 1) } }))}
                                  disabled={s.qty >= line.quantity}
                                  style={{ width: 30, background: C.subtle, border: 0, color: s.qty >= line.quantity ? C.muted2 : C.ink2, fontSize: 14, cursor: s.qty >= line.quantity ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center' }}
                                >+</button>
                              </div>
                              <span style={{ fontSize: 11.5, color: C.muted2, fontFamily: 'JetBrains Mono, monospace' }}>max {line.quantity} · stock returns to inventory</span>
                              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                <span style={{ color: C.muted, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>Line</span>
                                <span style={{ color: C.ink, fontWeight: 600 }}>₨ {fmt(amount)}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              {/* Left */}
              <div style={{ padding: 16, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Date row */}
                <div style={{ display: 'grid', gridTemplateColumns: '200px auto', gap: 14, alignItems: 'end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return date</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => { setReturnDate(e.target.value); setDatePreset(null); }}
                      style={{ height: 32, padding: '0 10px', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, color: C.ink, outline: 'none', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 6 }}>
                    {(['today', 'yesterday', 'invoice'] as const).map(preset => (
                      <span
                        key={preset}
                        onClick={() => {
                          setDatePreset(preset);
                          if (preset === 'today') setReturnDate(todayIso());
                          else if (preset === 'yesterday') setReturnDate(yesterdayIso());
                          else setReturnDate(invoice.date);
                        }}
                        style={{
                          fontSize: 11, padding: '3px 9px', borderRadius: 3, cursor: 'pointer',
                          ...(datePreset === preset
                            ? { background: C.infoBg, color: C.info, border: '1px solid rgba(31,58,138,0.20)', fontWeight: 500 }
                            : { color: C.muted, border: `1px solid ${C.line}`, background: C.paper }),
                        }}
                      >
                        {preset === 'today' ? 'Today' : preset === 'yesterday' ? 'Yesterday' : 'Invoice date'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Remarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Remarks
                    <span style={{ fontWeight: 500, color: C.muted2, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>— optional, shown on the ledger entry</span>
                  </label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="e.g. Customer returned defective unit."
                    style={{ border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper, color: C.ink, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '10px 12px', minHeight: 70, resize: 'vertical', outline: 'none', width: '100%' }}
                  />
                </div>

                {/* Accounting preview */}
                {totalAmount > 0 && (
                  <div style={{ border: `1px dashed ${C.line2}`, background: C.subtle, borderRadius: 4, padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: C.muted, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      Journal preview · auto-posted on confirm
                    </div>
                    {[
                      { side: 'DR', label: 'Sales Revenue', amt: totalAmount },
                      { side: 'CR', label: invoice.payment_mode === 'credit' ? `A/R · ${invoice.customer_name}` : invoice.payment_mode === 'cash' ? 'Cash in hand' : invoice.payment_mode === 'card' ? 'Card settlements' : 'Bank account', amt: totalAmount },
                    ].map(({ side, label, amt }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ color: side === 'DR' ? C.ok : C.bad, fontWeight: 600, width: 30 }}>{side}</span>
                        <span style={{ flex: 1, color: C.ink2 }}>{label}</span>
                        <span style={{ color: C.ink }}>{fmt(amt)}</span>
                      </div>
                    ))}
                    {totalCost > 0 && [
                      { side: 'DR', label: 'Inventory', amt: totalCost },
                      { side: 'CR', label: 'Cost of Goods Sold', amt: totalCost },
                    ].map(({ side, label, amt }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: i === 0 ? 4 : 0 }}>
                        <span style={{ color: side === 'DR' ? C.ok : C.bad, fontWeight: 600, width: 30 }}>{side}</span>
                        <span style={{ flex: 1, color: C.ink2 }}>{label}</span>
                        <span style={{ color: C.ink }}>{fmt(amt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{ padding: '10px 14px', background: C.badBg, border: '1px solid var(--c-bad-border)', borderRadius: 4, fontSize: 12.5, color: C.bad }}>
                    {error}
                  </div>
                )}
              </div>

              {/* Right */}
              <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Lines selected', val: `${selLines} of ${invoice.lines.length}` },
                  { label: 'Units returning', val: String(totalUnits) },
                  { label: 'Invoice total', val: `₨ ${fmtNum(invoice.total_amount)}`, muted: true },
                ].map(({ label, val, muted }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, color: C.muted }}>{label}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: muted ? C.muted : C.ink2 }}>{val}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${C.line}`, margin: '4px 0' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Return total</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 600, color: totalAmount > 0 ? C.ink : C.muted2, letterSpacing: -0.4, lineHeight: 1 }}>
                    <span style={{ fontSize: 14, color: C.muted2, fontWeight: 500, marginRight: 4 }}>₨</span>
                    {totalAmount > 0 ? fmtNum(Math.round(totalAmount)) : '0'}
                  </span>
                </div>

                {/* Save bar */}
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 11, color: C.muted }}>
                    Press{' '}
                    {['Ctrl', '↵'].map(k => (
                      <span key={k} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.ink2, border: `1px solid ${C.line2}`, borderRadius: 3, padding: '0 4px', background: C.paper, margin: '0 2px' }}>{k}</span>
                    ))}
                    {' '}to confirm
                  </span>
                  <button
                    onClick={onCancel}
                    style={{ height: 34, padding: '0 14px', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, border: `1px solid ${C.line2}`, cursor: 'pointer', background: C.paper, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    Cancel
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, opacity: 0.7, border: '1px solid currentColor', borderRadius: 2, padding: '0 3px' }}>Esc</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={totalUnits === 0 || saving}
                    style={{
                      height: 34, padding: '0 14px', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      cursor: totalUnits === 0 || saving ? 'not-allowed' : 'pointer',
                      ...(totalUnits === 0 || saving
                        ? { background: C.line2, border: `1px solid ${C.line2}`, color: C.muted }
                        : { background: C.accent, border: `1px solid ${C.accent}`, color: C.accentFg }),
                    }}
                  >
                    <svg viewBox="0 0 16 16" width="13" height="13" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                      <path d="M3 8l3 3 7-7" />
                    </svg>
                    {saving ? 'Saving…' : 'Confirm return'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
