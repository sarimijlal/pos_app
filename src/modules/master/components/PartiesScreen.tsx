import { useState, useEffect, useRef, useCallback } from 'react';
import type { Supplier, Customer, Salesperson } from '../../../../interfaces';
import { getSuppliers, insertSupplier, updateSupplier, getCustomers, insertCustomer, updateCustomer, recordPayment, getPartyLedger } from '../../../db/repositories/accounting';
import { getSalespersons, insertSalesperson } from '../../../db/repositories/sales';
import { C } from '../../../lib/theme';
import type { LedgerRow } from '../../accounting/types';

type Tab = 'suppliers' | 'customers' | 'salespersons';
type PanelMode = 'new' | 'edit' | 'payment';
type PanelKind = 'supplier' | 'customer';

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function sourceLabel(st: string): string {
  switch (st) {
    case 'purchase_invoice': return 'Purchase Invoice';
    case 'sales_invoice':    return 'Sales Invoice';
    case 'payment_voucher':  return 'Payment Voucher';
    case 'receipt_voucher':  return 'Receipt Voucher';
    case 'purchase_return':  return 'Purchase Return';
    case 'sales_return':     return 'Sales Return';
    default: return st.replace(/_/g, ' ');
  }
}

const th: React.CSSProperties = {
  padding: '9px 14px', background: 'var(--c-sidebar)',
  borderBottom: `1.5px solid ${C.line3}`,
  fontSize: 10.5, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};
const thR: React.CSSProperties = { ...th, textAlign: 'right' };

export function PartiesScreen() {
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);

  const [tab, setTab] = useState<Tab>('suppliers');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKind, setPanelKind] = useState<PanelKind>('supplier');
  const [panelMode, setPanelMode] = useState<PanelMode>('new');
  const [editId, setEditId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState(0);
  const [fName, setFName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fAddr, setFAddr] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelSaveErr, setPanelSaveErr] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Payment form state
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'bank'>('cash');
  const [payDate, setPayDate] = useState('');
  const [payNote, setPayNote] = useState('');
  const payAmountRef = useRef<HTMLInputElement>(null);

  // Party ledger state
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerState, setLedgerState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [_ledgerErr, setLedgerErr] = useState('');

  // Salesperson inline form
  const [salName, setSalName] = useState('');
  const [salSaving, setSalSaving] = useState(false);
  const [salErr, setSalErr] = useState('');

  const loadAll = useCallback(async () => {
    setLoadState('loading');
    try {
      const [sups, custs, sals] = await Promise.all([
        getSuppliers(),
        getCustomers(),
        getSalespersons(),
      ]);
      setSuppliers(sups);
      setCustomers(custs);
      setSalespersons(sals);
      setLoadState('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadLedger(kind: PanelKind, entityId: number) {
    setLedgerState('loading');
    setLedger([]);
    setLedgerErr('');
    try {
      const rows = await getPartyLedger(entityId, kind);
      setLedger(rows);
      setLedgerState('success');
    } catch (e) {
      setLedgerErr(e instanceof Error ? e.message : String(e));
      setLedgerState('error');
    }
  }

  // Focus name input when panel opens
  useEffect(() => {
    if (panelOpen) setTimeout(() => nameInputRef.current?.focus(), 60);
  }, [panelOpen]);

  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) { e.stopPropagation(); closePanel(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [panelOpen]);

  function openNew(kind: PanelKind) {
    setPanelKind(kind);
    setPanelMode('new');
    setEditId(null);
    setEditBalance(0);
    setFName(''); setFPhone(''); setFAddr('');
    setNameErr(false); setPanelSaveErr('');
    setLedger([]); setLedgerState('idle');
    setPanelOpen(true);
  }

  function openEdit(kind: PanelKind, entity: Supplier | Customer) {
    setPanelKind(kind);
    setPanelMode('edit');
    setEditId(entity.id);
    setEditBalance(entity.balance);
    setFName(entity.name);
    setFPhone(entity.phone ?? '');
    setFAddr(kind === 'supplier' ? (entity as Supplier).address ?? '' : '');
    setNameErr(false); setPanelSaveErr('');
    setPanelOpen(true);
    loadLedger(kind, entity.id);
  }

  function openPayment(kind: PanelKind, entity: Supplier | Customer) {
    setPanelKind(kind);
    setPanelMode('payment');
    setEditId(entity.id);
    setEditBalance(entity.balance);
    setFName(entity.name);
    setPayAmount(String(Math.round(entity.balance)));
    setPayMode('cash');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote('');
    setPanelSaveErr('');
    setPanelOpen(true);
    setTimeout(() => payAmountRef.current?.select(), 60);
    loadLedger(kind, entity.id);
  }

  function closePanel() { setPanelOpen(false); }

  async function handlePaymentSave() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPanelSaveErr('Enter a valid amount.'); payAmountRef.current?.focus(); return; }
    setPanelSaving(true);
    setPanelSaveErr('');
    try {
      await recordPayment({
        entity_id: editId!,
        entity_type: panelKind,
        amount,
        payment_mode: payMode,
        date: payDate,
        note: payNote.trim() || undefined,
      });
      if (panelKind === 'supplier') setSuppliers(await getSuppliers());
      else setCustomers(await getCustomers());
      closePanel();
    } catch (e) {
      setPanelSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelSaving(false);
    }
  }

  async function handlePanelSave() {
    if (!fName.trim()) { setNameErr(true); nameInputRef.current?.focus(); return; }
    setNameErr(false);
    setPanelSaving(true);
    setPanelSaveErr('');
    try {
      if (panelKind === 'supplier') {
        const data = { name: fName.trim(), phone: fPhone.trim() || undefined, address: fAddr.trim() || undefined };
        if (panelMode === 'new') await insertSupplier(data);
        else await updateSupplier({ id: editId!, ...data });
        setSuppliers(await getSuppliers());
      } else {
        const data = { name: fName.trim(), phone: fPhone.trim() || undefined };
        if (panelMode === 'new') await insertCustomer(data);
        else await updateCustomer({ id: editId!, ...data });
        setCustomers(await getCustomers());
      }
      closePanel();
    } catch (e) {
      setPanelSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelSaving(false);
    }
  }

  async function handleAddSalesperson() {
    if (!salName.trim()) return;
    setSalSaving(true);
    setSalErr('');
    try {
      await insertSalesperson({ name: salName.trim() });
      setSalespersons(await getSalespersons());
      setSalName('');
    } catch (e) {
      setSalErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSalSaving(false);
    }
  }

  const q = search.toLowerCase();
  const filteredSups = suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || (s.phone?.includes(q) ?? false));
  const filteredCusts = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone?.includes(q) ?? false));
  const filteredSals = salespersons.filter(s => !q || s.name.toLowerCase().includes(q));

  const totalPayable = suppliers.reduce((sum, s) => sum + s.balance, 0);
  const totalReceivable = customers.reduce((sum, c) => sum + c.balance, 0);
  const totalSaleSales = salespersons.reduce((sum, s) => sum + s.sales_count, 0);

  const kpiData: Record<Tab, Array<{ label: string; value: string; sub?: string }>> = {
    suppliers: [
      { label: 'Active suppliers', value: String(suppliers.length) },
      { label: 'Total payable', value: `₨ ${fmt(totalPayable)}`, sub: totalPayable > 0 ? 'outstanding balance' : 'all settled' },
    ],
    customers: [
      { label: 'Active customers', value: String(customers.length) },
      { label: 'Total receivable', value: `₨ ${fmt(totalReceivable)}`, sub: totalReceivable > 0 ? 'outstanding balance' : 'all settled' },
    ],
    salespersons: [
      { label: 'Active salespersons', value: String(salespersons.length) },
      { label: 'Sales recorded', value: String(totalSaleSales), sub: 'across all staff' },
    ],
  };

  const tabRowStyle = (hovered: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    background: hovered ? 'var(--c-subtle)' : 'transparent',
    transition: 'background 80ms',
  });

  const tdBase: React.CSSProperties = {
    padding: '11px 14px', borderBottom: `1px solid ${C.line}`,
    verticalAlign: 'middle', fontSize: 13,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.ink, letterSpacing: '-0.025em' }}>
            Parties &amp; staff
          </h1>
          <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted, maxWidth: 520, lineHeight: 1.5 }}>
            Master data for everyone who appears on an invoice. Outstanding balances are derived from posted journal entries and update automatically.
          </div>
        </div>
      </div>

      {loadState === 'error' && (
        <div style={{ padding: '10px 14px', background: C.badBg, border: `1px solid var(--c-bad-border)`, borderRadius: 6, fontSize: 12.5, color: C.bad, display: 'flex', alignItems: 'center', gap: 10 }}>
          Failed to load data. {errorMsg && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.8 }}>{errorMsg}</span>}
          <button onClick={loadAll} style={{ marginLeft: 'auto', height: 26, padding: '0 10px', border: `1px solid var(--c-bad-border)`, background: 'transparent', color: C.bad, fontFamily: 'inherit', fontSize: 12, borderRadius: 4, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* KPI strip */}
      {loadState === 'success' && (
        <div style={{ display: 'flex', gap: 12 }}>
          {kpiData[tab].map(kpi => (
            <div key={kpi.label} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, padding: '10px 16px', minWidth: 140 }}>
              <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: 11, color: C.muted2, marginTop: 1 }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.line}`, gap: 0, padding: '0 14px', background: 'var(--c-sidebar)' }}>
          {(['suppliers', 'customers', 'salespersons'] as Tab[]).map(t => {
            const active = tab === t;
            const count = t === 'suppliers' ? suppliers.length : t === 'customers' ? customers.length : salespersons.length;
            const labels: Record<Tab, string> = { suppliers: 'Suppliers', customers: 'Customers', salespersons: 'Salespersons' };
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); }}
                style={{
                  height: 42, padding: '0 14px', border: 'none', background: 'transparent',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? C.ink : C.muted, cursor: 'pointer',
                  borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
                  display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  transition: 'color 120ms, border-color 120ms',
                  marginBottom: -1,
                }}
              >
                {labels[t]}
                {loadState === 'success' && (
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 999,
                    background: active ? C.accent : 'var(--c-nav-active)',
                    color: active ? '#fff' : C.muted,
                    transition: 'background 120ms, color 120ms',
                  }}>{count}</span>
                )}
              </button>
            );
          })}

          {/* Search + Add */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" style={{ position: 'absolute', left: 8, pointerEvents: 'none' }}>
                <circle cx="7" cy="7" r="4" /><path d="M10 10l3 3" />
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or phone…"
                style={{
                  height: 30, paddingLeft: 28, paddingRight: search ? 24 : 10,
                  border: `1px solid ${C.line2}`, borderRadius: 4,
                  background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 12.5,
                  outline: 'none', width: 200,
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 5, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
              )}
            </div>
            {tab !== 'salespersons' && (
              <button
                onClick={() => openNew(tab === 'suppliers' ? 'supplier' : 'customer')}
                style={{
                  height: 30, padding: '0 12px', border: 'none',
                  background: C.accent, color: '#fff', fontFamily: 'inherit',
                  fontSize: 12.5, fontWeight: 500, borderRadius: 4, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
                Add {tab === 'suppliers' ? 'supplier' : 'customer'}
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loadState === 'loading' && (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40, color: C.muted, fontSize: 13 }}>Loading…</div>
        )}

        {/* ── Suppliers panel ── */}
        {loadState === 'success' && tab === 'suppliers' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ ...th, width: '28%' }}>Name</th>
                  <th style={{ ...th, width: '16%' }}>Phone</th>
                  <th style={th}>Address</th>
                  <th style={{ ...thR, width: '18%' }}>Outstanding</th>
                  <th style={{ ...thR, width: '10%' }}>Invoices</th>
                  <th style={{ ...th, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filteredSups.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdBase, textAlign: 'center', color: C.muted, padding: '32px 14px' }}>
                    {search ? 'No suppliers match your search.' : 'No suppliers yet. Add one to get started.'}
                  </td></tr>
                ) : filteredSups.map(s => (
                  <SupplierRow key={s.id} supplier={s} tdBase={tdBase} tabRowStyle={tabRowStyle} onEdit={() => openEdit('supplier', s)} onPay={() => openPayment('supplier', s)} />
                ))}
              </tbody>
              {filteredSups.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ ...tdBase, background: 'var(--c-sidebar)', fontSize: 11.5, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: `1px solid ${C.line}`, borderBottom: 'none' }}>
                      Total payable
                    </td>
                    <td style={{ ...tdBase, background: 'var(--c-sidebar)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: C.ink, borderTop: `1px solid ${C.line}`, borderBottom: 'none' }}>
                      ₨ {fmt(filteredSups.reduce((s, r) => s + r.balance, 0))}
                    </td>
                    <td colSpan={2} style={{ ...tdBase, background: 'var(--c-sidebar)', borderTop: `1px solid ${C.line}`, borderBottom: 'none' }} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ── Customers panel ── */}
        {loadState === 'success' && tab === 'customers' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ ...th, width: '32%' }}>Name</th>
                  <th style={{ ...th, width: '18%' }}>Phone</th>
                  <th style={th}>Last activity</th>
                  <th style={{ ...thR, width: '18%' }}>Outstanding</th>
                  <th style={{ ...thR, width: '10%' }}>Invoices</th>
                  <th style={{ ...th, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filteredCusts.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdBase, textAlign: 'center', color: C.muted, padding: '32px 14px' }}>
                    {search ? 'No customers match your search.' : 'No customers yet. Add one to get started.'}
                  </td></tr>
                ) : filteredCusts.map(c => (
                  <CustomerRow key={c.id} customer={c} tdBase={tdBase} tabRowStyle={tabRowStyle} onEdit={() => openEdit('customer', c)} onReceive={() => openPayment('customer', c)} />
                ))}
              </tbody>
              {filteredCusts.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ ...tdBase, background: 'var(--c-sidebar)', fontSize: 11.5, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: `1px solid ${C.line}`, borderBottom: 'none' }}>
                      Total receivable
                    </td>
                    <td style={{ ...tdBase, background: 'var(--c-sidebar)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: C.ink, borderTop: `1px solid ${C.line}`, borderBottom: 'none' }}>
                      ₨ {fmt(filteredCusts.reduce((s, r) => s + r.balance, 0))}
                    </td>
                    <td colSpan={2} style={{ ...tdBase, background: 'var(--c-sidebar)', borderTop: `1px solid ${C.line}`, borderBottom: 'none' }} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ── Salespersons panel ── */}
        {loadState === 'success' && tab === 'salespersons' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 0 }}>
            {/* Table */}
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', borderRight: `1px solid ${C.line}` }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ ...th, width: 40, textAlign: 'center' }}>#</th>
                    <th style={th}>Name</th>
                    <th style={{ ...thR, width: '22%' }}>Sales recorded</th>
                    <th style={{ ...thR, width: '22%' }}>Last sale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSals.length === 0 ? (
                    <tr><td colSpan={4} style={{ ...tdBase, textAlign: 'center', color: C.muted, padding: '32px 14px' }}>
                      {search ? 'No salespersons match your search.' : 'No salespersons yet. Add one using the form.'}
                    </td></tr>
                  ) : filteredSals.map((sp, idx) => (
                    <SalespersonRow key={sp.id} sp={sp} idx={idx} tdBase={tdBase} tabRowStyle={tabRowStyle} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add card */}
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-sidebar)' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.ink }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="6" r="2.5" /><path d="M3 14c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" /><path d="M12 3v3M10.5 4.5h3" />
                </svg>
                Add salesperson
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                    Name <span style={{ color: C.bad, textTransform: 'none', fontWeight: 400, fontSize: 10 }}>required</span>
                  </label>
                  <input
                    value={salName}
                    onChange={e => setSalName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSalesperson(); if (e.key === 'Escape') setSalName(''); }}
                    placeholder="e.g. Asad"
                    autoComplete="off"
                    style={{
                      width: '100%', height: 34, padding: '0 10px', border: `1px solid ${C.line2}`,
                      borderRadius: 4, background: C.paper, color: C.ink,
                      fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: C.muted2, lineHeight: 1.4 }}>
                    Names appear on sales invoices. Cannot be edited once recorded against a sale.
                  </div>
                </div>
                {salErr && (
                  <div style={{ padding: '7px 10px', background: C.badBg, border: `1px solid var(--c-bad-border)`, borderRadius: 4, fontSize: 12, color: C.bad }}>
                    {salErr}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setSalName(''); setSalErr(''); }}
                    style={{ flex: 1, height: 32, border: `1px solid ${C.line2}`, background: 'transparent', color: C.ink2, fontFamily: 'inherit', fontSize: 12.5, borderRadius: 4, cursor: 'pointer' }}
                  >Reset</button>
                  <button
                    onClick={handleAddSalesperson}
                    disabled={salSaving || !salName.trim()}
                    style={{
                      flex: 2, height: 32, border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                      borderRadius: 4, cursor: salSaving || !salName.trim() ? 'not-allowed' : 'pointer',
                      background: salSaving || !salName.trim() ? C.line2 : C.accent,
                      color: salSaving || !salName.trim() ? C.muted : '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
                    {salSaving ? 'Adding…' : 'Add to list'}
                  </button>
                </div>
              </div>
              <div style={{ padding: '8px 16px', borderTop: `1px solid ${C.line}`, fontSize: 11, color: C.muted2, display: 'flex', gap: 12 }}>
                <span><kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '1px 4px', border: `1px solid ${C.line2}`, borderRadius: 3, background: C.paper }}>↵</kbd> add</span>
                <span><kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '1px 4px', border: `1px solid ${C.line2}`, borderRadius: 3, background: C.paper }}>Esc</kbd> clear</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Side panel ── */}
      <div
        onClick={closePanel}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'var(--c-overlay)',
          opacity: panelOpen ? 1 : 0,
          pointerEvents: panelOpen ? 'auto' : 'none',
          transition: 'opacity 180ms ease',
        }}
      />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 400, zIndex: 41,
        background: C.paper, borderLeft: `1px solid ${C.line}`,
        display: 'flex', flexDirection: 'column',
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: panelOpen ? '-8px 0 32px rgba(0,0,0,0.14)' : 'none',
      }}>
        {/* Panel header */}
        <header style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span>{panelKind === 'supplier' ? 'Supplier' : 'Customer'}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.muted2 }} />
            <span>{panelMode === 'new' ? 'New' : panelMode === 'edit' ? 'Edit' : panelKind === 'supplier' ? 'Payment' : 'Receipt'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>
              {panelMode === 'new' ? `New ${panelKind}` : fName}
            </h2>
            <button
              onClick={closePanel}
              style={{ width: 28, height: 28, border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 4, cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}
            >×</button>
          </div>
        </header>

        {/* Panel body — payment mode */}
        {panelMode === 'payment' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Outstanding balance */}
            <div style={{
              padding: '12px 16px', borderRadius: 6,
              background: C.warnBg, border: `1px solid var(--c-warn-border)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10.5, color: C.warn, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {panelKind === 'supplier' ? 'Outstanding payable' : 'Outstanding receivable'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.warn, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                  ₨ {fmt(editBalance)}
                </div>
              </div>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                <rect x="2" y="4" width="12" height="8" rx="1" /><circle cx="8" cy="8" r="2" />
              </svg>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Amount <span style={{ color: C.bad, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>required</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 10, fontSize: 13, color: C.muted, pointerEvents: 'none' }}>₨</span>
                <input
                  ref={payAmountRef}
                  type="number"
                  min="1"
                  max={editBalance}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  style={{
                    width: '100%', height: 38, paddingLeft: 26, paddingRight: 10, boxSizing: 'border-box',
                    border: `1px solid ${C.line2}`, borderRadius: 4,
                    background: C.paper, color: C.ink, fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 15, fontWeight: 600, outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginTop: 5, display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPayAmount(String(Math.round(editBalance)))}
                  style={{ fontSize: 11, padding: '2px 8px', border: `1px solid ${C.line2}`, borderRadius: 4, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}
                >Full amount</button>
              </div>
            </div>

            {/* Payment mode */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Pay via
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['cash', 'bank'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMode(m)}
                    style={{
                      flex: 1, height: 34, border: `1px solid ${payMode === m ? C.accent : C.line2}`,
                      borderRadius: 4, fontFamily: 'inherit', fontSize: 13, fontWeight: payMode === m ? 600 : 400,
                      background: payMode === m ? C.infoBg : 'transparent',
                      color: payMode === m ? C.accent : C.ink2, cursor: 'pointer',
                    }}
                  >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Date
              </label>
              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                style={{
                  width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
                  border: `1px solid ${C.line2}`, borderRadius: 4,
                  background: C.paper, color: C.ink, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {/* Note */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Note <span style={{ color: C.muted2, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>optional</span>
              </label>
              <input
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="e.g. Invoice #123"
                style={{
                  width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
                  border: `1px solid ${C.line2}`, borderRadius: 4,
                  background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {panelSaveErr && (
              <div style={{ padding: '8px 12px', background: C.badBg, border: `1px solid var(--c-bad-border)`, borderRadius: 4, fontSize: 12.5, color: C.bad }}>
                {panelSaveErr}
              </div>
            )}

            <LedgerSection ledger={ledger} ledgerState={ledgerState} ledgerErr={_ledgerErr} panelKind={panelKind} />
          </div>
        )}

        {/* Panel body — new/edit mode */}
        {panelMode !== 'payment' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Balance card — edit mode only */}
          {panelMode === 'edit' && (
            <div style={{
              padding: '10px 14px', borderRadius: 6,
              background: editBalance > 0 ? C.warnBg : C.okBg,
              border: `1px solid ${editBalance > 0 ? 'var(--c-warn-border)' : 'var(--c-ok-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: editBalance > 0 ? C.warn : C.ok, fontWeight: 500 }}>
                {panelKind === 'supplier' ? 'Payable balance' : 'Receivable balance'}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, color: editBalance > 0 ? C.warn : C.ok }}>
                ₨ {fmt(editBalance)}
              </span>
            </div>
          )}

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
              Name <span style={{ color: C.bad, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>required</span>
            </label>
            <input
              ref={nameInputRef}
              value={fName}
              onChange={e => { setFName(e.target.value); if (nameErr) setNameErr(false); }}
              autoComplete="off"
              style={{
                width: '100%', height: 36, padding: '0 10px', boxSizing: 'border-box',
                border: `1px solid ${nameErr ? C.bad : C.line2}`, borderRadius: 4,
                background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                boxShadow: nameErr ? `0 0 0 3px ${C.badBg}` : 'none',
              }}
            />
            {nameErr && <div style={{ marginTop: 4, fontSize: 11.5, color: C.bad }}>A name is required.</div>}
          </div>

          {/* Phone + Address row */}
          <div style={{ display: 'grid', gridTemplateColumns: panelKind === 'supplier' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Phone <span style={{ color: C.muted2, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>optional</span>
              </label>
              <input
                value={fPhone}
                onChange={e => setFPhone(e.target.value)}
                inputMode="tel"
                autoComplete="off"
                placeholder="+92 3xx xxx xxxx"
                style={{
                  width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
                  border: `1px solid ${C.line2}`, borderRadius: 4,
                  background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            {panelKind === 'supplier' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                  Address <span style={{ color: C.muted2, fontWeight: 400, textTransform: 'none', fontSize: 10 }}>optional</span>
                </label>
                <input
                  value={fAddr}
                  onChange={e => setFAddr(e.target.value)}
                  autoComplete="off"
                  placeholder="Street, area, city"
                  style={{
                    width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
                    border: `1px solid ${C.line2}`, borderRadius: 4,
                    background: C.paper, color: C.ink, fontFamily: 'inherit', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {panelSaveErr && (
            <div style={{ padding: '8px 12px', background: C.badBg, border: `1px solid var(--c-bad-border)`, borderRadius: 4, fontSize: 12.5, color: C.bad }}>
              {panelSaveErr}
            </div>
          )}

          {panelMode === 'edit' && (
            <LedgerSection ledger={ledger} ledgerState={ledgerState} ledgerErr={_ledgerErr} panelKind={panelKind} />
          )}
        </div>
        )}

        {/* Panel footer */}
        <footer style={{ padding: '12px 20px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, background: 'var(--c-sidebar)' }}>
          <button
            onClick={closePanel}
            style={{ height: 34, padding: '0 16px', border: `1px solid ${C.line2}`, background: 'transparent', color: C.ink2, fontFamily: 'inherit', fontSize: 13, borderRadius: 4, cursor: 'pointer' }}
          >Cancel</button>
          <button
            onClick={panelMode === 'payment' ? handlePaymentSave : handlePanelSave}
            disabled={panelSaving}
            style={{
              height: 34, padding: '0 16px', border: 'none',
              background: panelSaving ? C.line2 : C.accent,
              color: panelSaving ? C.muted : '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, borderRadius: 4,
              cursor: panelSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7l3 3 7-7" />
            </svg>
            {panelSaving
              ? (panelMode === 'payment' ? 'Recording…' : 'Saving…')
              : panelMode === 'payment'
                ? (panelKind === 'supplier' ? 'Record payment' : 'Record receipt')
                : `Save ${panelKind}`}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ── Ledger sub-component ──────────────────────────────────────────────────────

function LedgerSection({ ledger, ledgerState, ledgerErr: _err, panelKind }: {
  ledger: LedgerRow[];
  ledgerState: 'idle' | 'loading' | 'error' | 'success';
  ledgerErr: string;
  panelKind: PanelKind;
}) {
  if (ledgerState === 'idle') return null;

  const positiveColor = panelKind === 'supplier' ? C.warn : C.accent;
  const balanceColor = (b: number) => Math.abs(b) > 0.01 ? positiveColor : C.ok;

  const lTh: React.CSSProperties = {
    padding: '5px 8px', textAlign: 'left', color: C.muted,
    fontWeight: 600, fontSize: 10, letterSpacing: '0.06em',
    textTransform: 'uppercase', borderBottom: `1px solid ${C.line}`,
    background: 'var(--c-sidebar)', whiteSpace: 'nowrap',
  };
  const lTd: React.CSSProperties = {
    padding: '7px 8px', borderBottom: `1px solid ${C.line}`,
    verticalAlign: 'middle',
  };

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 4 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Transaction history
      </div>

      {ledgerState === 'loading' && (
        <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>Loading…</div>
      )}
      {ledgerState === 'error' && (
        <div style={{ fontSize: 12, color: C.bad, padding: '6px 0' }}>
          Failed to load history.
          {/* debug: uncomment to surface raw error message
          {_err && <span style={{ marginLeft: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, opacity: 0.8 }}>{_err}</span>}
          */}
        </div>
      )}
      {ledgerState === 'success' && ledger.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted2, padding: '6px 0' }}>No transactions recorded yet.</div>
      )}
      {ledgerState === 'success' && ledger.length > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 5, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...lTh, width: 82 }}>Date</th>
                <th style={lTh}>Reference</th>
                <th style={{ ...lTh, textAlign: 'right', width: 90 }}>Movement</th>
                <th style={{ ...lTh, textAlign: 'right', width: 84 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={row.journal_entry_id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--c-subtle)' }}>
                  <td style={{ ...lTd, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                    {row.date}
                  </td>
                  <td style={{ ...lTd }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>
                      {row.reference_no}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted2, marginTop: 1 }}>
                      {sourceLabel(row.source_type)}
                    </div>
                  </td>
                  <td style={{ ...lTd, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: row.movement > 0.005 ? positiveColor : C.ok }}>
                    {row.movement > 0.005 ? '+' : '−'}₨&nbsp;{fmt(Math.abs(row.movement))}
                  </td>
                  <td style={{ ...lTd, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: balanceColor(row.balance) }}>
                    ₨&nbsp;{fmt(Math.abs(row.balance))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Row sub-components (avoids re-render of entire list on hover) ─────────────

function SupplierRow({ supplier: s, tdBase, tabRowStyle, onEdit, onPay }: {
  supplier: Supplier;
  tdBase: React.CSSProperties;
  tabRowStyle: (h: boolean) => React.CSSProperties;
  onEdit: () => void;
  onPay: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr style={tabRowStyle(hovered)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={{ ...tdBase, fontWeight: 500, color: C.ink }}>{s.name}</td>
      <td style={{ ...tdBase, color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{s.phone ?? '—'}</td>
      <td style={{ ...tdBase, color: C.muted2, fontSize: 12 }}>{s.address ?? '—'}</td>
      <td style={{ ...tdBase, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: s.balance > 0 ? C.warn : C.muted }}>
        {s.balance > 0 ? `₨ ${fmt(s.balance)}` : '—'}
      </td>
      <td style={{ ...tdBase, textAlign: 'right', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{s.invoice_count}</td>
      <td style={{ ...tdBase, padding: '4px 10px' }}>
        {hovered && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); onPay(); }}
              title={`Pay ₨ ${fmt(s.balance)}`}
              style={{ height: 26, padding: '0 8px', border: `1px solid var(--c-warn-border)`, background: C.warnBg, color: C.warn, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Pay</button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{ height: 26, padding: '0 8px', border: `1px solid ${C.line2}`, background: C.paper, color: C.ink2, fontFamily: 'inherit', fontSize: 11.5, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Edit</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CustomerRow({ customer: c, tdBase, tabRowStyle, onEdit, onReceive }: {
  customer: Customer;
  tdBase: React.CSSProperties;
  tabRowStyle: (h: boolean) => React.CSSProperties;
  onEdit: () => void;
  onReceive: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr style={tabRowStyle(hovered)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={{ ...tdBase, fontWeight: 500, color: C.ink }}>{c.name}</td>
      <td style={{ ...tdBase, color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.phone ?? '—'}</td>
      <td style={{ ...tdBase, color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.last_activity ?? '—'}</td>
      <td style={{ ...tdBase, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: c.balance > 0 ? C.accent : C.muted }}>
        {c.balance > 0 ? `₨ ${fmt(c.balance)}` : '—'}
      </td>
      <td style={{ ...tdBase, textAlign: 'right', color: C.muted2, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{c.invoice_count}</td>
      <td style={{ ...tdBase, padding: '4px 10px' }}>
        {hovered && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); onReceive(); }}
              title={`Receive ₨ ${fmt(c.balance)}`}
              style={{ height: 26, padding: '0 8px', border: `1px solid var(--c-accent-border)`, background: C.infoBg, color: C.accent, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Receive</button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{ height: 26, padding: '0 8px', border: `1px solid ${C.line2}`, background: C.paper, color: C.ink2, fontFamily: 'inherit', fontSize: 11.5, borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Edit</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function SalespersonRow({ sp, idx, tdBase, tabRowStyle }: {
  sp: Salesperson;
  idx: number;
  tdBase: React.CSSProperties;
  tabRowStyle: (h: boolean) => React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr style={tabRowStyle(hovered)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={{ ...tdBase, textAlign: 'center', color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{idx + 1}</td>
      <td style={{ ...tdBase, fontWeight: 500, color: C.ink }}>{sp.name}</td>
      <td style={{ ...tdBase, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: sp.sales_count > 0 ? C.ink2 : C.muted }}>
        {sp.sales_count > 0 ? sp.sales_count : '—'}
      </td>
      <td style={{ ...tdBase, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.muted2 }}>{sp.last_sale ?? '—'}</td>
    </tr>
  );
}
