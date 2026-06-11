import { useState, useEffect, useRef, useCallback } from 'react';
import { getSalesInvoices } from '@/db/repositories/sales';
import { getCustomers } from '@/db/repositories/accounting';
import { getSalespersons } from '@/db/repositories/sales';
import type { SalesInvoiceRow } from '../types';
import type { Customer, Salesperson } from '../../../../interfaces';

import { C } from '../../../lib/theme';

type PayMode = 'all' | 'cash' | 'credit' | 'bank' | 'partial';
type SortCol = 'date' | 'no' | 'total';
type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'month';

interface Filters {
  customerId: number | null;
  payment: PayMode;
  salespersonId: number | null;
  search: string;
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  return '₨ ' + n.toLocaleString('en-PK');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  const today = todayStr();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') { const y = offsetDate(-1); return { from: y, to: y }; }
  if (preset === '7d') return { from: offsetDate(-6), to: today };
  if (preset === '30d') return { from: offsetDate(-29), to: today };
  if (preset === 'month') return { from: startOfMonth(), to: today };
  return null;
}

function presetLabel(preset: DatePreset, from: string, to: string): string {
  if (preset === 'today') return 'Today';
  if (preset === 'yesterday') return 'Yesterday';
  if (preset === '7d') return `Last 7 days`;
  if (preset === '30d') return `Last 30 days`;
  if (preset === 'month') return 'This month';
  if (from && to) return `${from} – ${to}`;
  return 'Any date';
}

const PAY_LABEL: Record<PayMode, string> = {
  all: 'All', cash: 'Cash', credit: 'Credit', bank: 'Bank', partial: 'Partial',
};

function PayIcon({ mode }: { mode: Exclude<PayMode, 'all'> }) {
  const s: React.CSSProperties = {
    width: 14, height: 14, borderRadius: 3,
    display: 'inline-grid', placeItems: 'center',
    border: '1px solid',
  };
  const map: Record<string, React.CSSProperties> = {
    cash:    { background: C.okBg,   borderColor: 'var(--c-ok-border)',                                    color: C.ok },
    credit:  { background: C.warnBg, borderColor: `color-mix(in oklab, ${C.warn} 24%, transparent)`,       color: C.warn },
    bank:    { background: C.subtle, borderColor: C.line2,                                                  color: C.ink2 },
    partial: { background: C.warnBg, borderColor: `color-mix(in oklab, ${C.warn} 28%, transparent)`,       color: C.warn },
  };
  const svgMap: Record<string, React.ReactNode> = {
    cash:    <><rect x="2" y="4" width="12" height="8" rx="1"/><circle cx="8" cy="8" r="2"/></>,
    credit:  <><path d="M3 13V3M3 8h7l-2-2M3 8l2 2"/></>,
    bank:    <><path d="M2 6l6-3 6 3"/><path d="M3 7v5M8 7v5M13 7v5"/><path d="M2 13h12"/></>,
    partial: <><path d="M8 3v4M5 10l3 3 3-3M5 7l3-3 3 3"/></>,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.ink2, fontFamily: 'inherit' }}>
      <span style={{ ...s, ...map[mode] }}>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {svgMap[mode]}
        </svg>
      </span>
      {PAY_LABEL[mode]}
    </span>
  );
}

function StatusBadge({ status }: { status: 'active' | 'returned' }) {
  const active = status === 'active';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 9px 0 7px',
      borderRadius: 999, fontSize: 11, fontWeight: 600,
      border: '1px solid',
      background: active ? C.okBg : C.warnBg,
      color: active ? C.ok : C.warn,
      borderColor: active
        ? `color-mix(in oklab, ${C.ok} 22%, transparent)`
        : `color-mix(in oklab, ${C.warn} 28%, transparent)`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? C.ok : C.warn,
        boxShadow: active ? `0 0 0 2px color-mix(in oklab, ${C.ok} 18%, transparent)` : undefined,
      }} />
      {active ? 'Active' : 'Returned'}
    </span>
  );
}

const PAGE_SIZES = [25, 50, 100];

interface Props {
  onNew: () => void;
  onViewDetail: (id: number) => void;
  onReturn: (id: number) => void;
}

export function SalesListScreen({ onNew, onViewDetail, onReturn }: Props) {
  const [rows, setRows] = useState<SalesInvoiceRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [filters, setFilters] = useState<Filters>({
    customerId: null, payment: 'all', salespersonId: null,
    search: '', datePreset: 'all', dateFrom: '', dateTo: '',
  });
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [datePop, setDatePop] = useState(false);
  const [custPop, setCustPop] = useState(false);
  const [spPop, setSpPop] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const custSearchRef = useRef<HTMLInputElement>(null);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const custFieldRef = useRef<HTMLDivElement>(null);
  const spFieldRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    async function load() {
      setLoadState('loading');
      try {
        const [inv, cust, sp] = await Promise.all([
          getSalesInvoices(), getCustomers(), getSalespersons(),
        ]);
        setRows(inv);
        setCustomers(cust);
        setSalespersons(sp);
        setLoadState('success');
      } catch (e) {
        console.error('Sales list load failed:', e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadState('error');
      }
    }
    load();
  }, []);

  const closeAllPops = useCallback(() => {
    setDatePop(false);
    setCustPop(false);
    setSpPop(false);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (dateFieldRef.current && !dateFieldRef.current.contains(t)) setDatePop(false);
      if (custFieldRef.current && !custFieldRef.current.contains(t)) setCustPop(false);
      if (spFieldRef.current && !spFieldRef.current.contains(t)) setSpPop(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') { closeAllPops(); return; }
      if (e.key === '/' && !inInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !inInput) {
        e.preventDefault();
        const filtered = applyFilters();
        const paginated = paginate(filtered);
        if (!paginated.length) return;
        const curIdx = selectedId ? paginated.findIndex(r => r.id === selectedId) : -1;
        let next = e.key === 'ArrowDown'
          ? Math.min(paginated.length - 1, curIdx + 1)
          : Math.max(0, curIdx === -1 ? 0 : curIdx - 1);
        setSelectedId(paginated[next].id);
        const row = tbodyRef.current?.querySelector(`[data-id="${paginated[next].id}"]`);
        row?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter' && !inInput && selectedId) {
        onViewDetail(selectedId);
        return;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, filters, sortCol, sortDir, page, pageSize]);

  function setPreset(p: DatePreset) {
    const range = getPresetRange(p);
    setFilters(f => ({
      ...f, datePreset: p,
      dateFrom: range?.from ?? '',
      dateTo: range?.to ?? '',
    }));
    setCustomDateFrom(range?.from ?? '');
    setCustomDateTo(range?.to ?? '');
    setPage(1);
  }

  function applyFilters(): SalesInvoiceRow[] {
    const q = filters.search.trim().toLowerCase();
    const from = filters.dateFrom;
    const to = filters.dateTo;
    return rows.filter(r => {
      if (filters.customerId !== null && r.customer_id !== filters.customerId) return false;
      if (filters.payment !== 'all' && r.payment_mode !== filters.payment) return false;
      if (filters.salespersonId !== null && r.salesperson_id !== filters.salespersonId) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (q) {
        const hay = (r.invoice_no + ' ' + r.customer_name + ' ' + (r.salesperson_name ?? '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'date') cmp = a.date.localeCompare(b.date) || a.invoice_no.localeCompare(b.invoice_no);
      else if (sortCol === 'no') cmp = a.invoice_no.localeCompare(b.invoice_no);
      else if (sortCol === 'total') cmp = a.total_amount - b.total_amount;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  function paginate(filtered: SalesInvoiceRow[]) {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
    setPage(1);
  }

  function clearAllFilters() {
    setFilters({ customerId: null, payment: 'all', salespersonId: null, search: '', datePreset: 'all', dateFrom: '', dateTo: '' });
    setCustomDateFrom(''); setCustomDateTo('');
    if (searchRef.current) searchRef.current.value = '';
    setPage(1);
    closeAllPops();
  }

  const filtered = applyFilters();
  const paginated = paginate(filtered);
  const activeRows = filtered.filter(r => r.status === 'active');
  const returnedRows = filtered.filter(r => r.status === 'returned');
  const filteredTotal = activeRows.reduce((s, r) => s + r.total_amount, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const activeFilterCount = [
    filters.datePreset !== 'all' || (filters.dateFrom || filters.dateTo),
    filters.customerId !== null,
    filters.payment !== 'all',
    filters.salespersonId !== null,
    !!filters.search,
  ].filter(Boolean).length;

  const selectedCustomer = customers.find(c => c.id === filters.customerId);
  const selectedSp = salespersons.find(s => s.id === filters.salespersonId);
  const filteredCusts = custSearch
    ? customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()))
    : customers;

  const sortIcon = (col: SortCol) => {
    if (sortCol !== col) return '↕';
    return sortDir === 'desc' ? '↓' : '↑';
  };

  const thStyle = (sortable = false, active = false): React.CSSProperties => ({
    textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: active ? C.ink2 : C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '9px 12px', borderBottom: `1.5px solid ${C.line3}`,
    background: C.subtle, whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 2,
    cursor: sortable ? 'pointer' : 'default', userSelect: 'none' as const,
  });

  const filterCtrlStyle = (active = false): React.CSSProperties => ({
    height: 32, padding: '0 10px',
    background: C.paper, border: `1px solid ${active ? C.accent : C.line2}`,
    borderRadius: 4, fontFamily: 'inherit', fontSize: 13, color: C.ink,
    display: 'flex', alignItems: 'center', gap: 8,
    cursor: 'pointer', userSelect: 'none', width: '100%',
    boxShadow: active ? `0 0 0 3px color-mix(in oklab, ${C.accent} 16%, transparent)` : undefined,
  });

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '20px 22px 22px', gap: 14, minWidth: 1080,
      background: C.bg, minHeight: 0, overflowY: 'auto',
    }}>

      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.1 }}>
            Sales list
          </h1>
          <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>
            All sales invoices. Click any row to view detail, or use the actions on the right.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setLoadState('loading');
              getSalesInvoices()
                .then(r => { setRows(r); setLoadState('success'); })
                .catch(e => { setErrorMsg(e instanceof Error ? e.message : String(e)); setLoadState('error'); });
            }}
            style={{ width: 32, height: 32, border: `1px solid ${C.line2}`, background: C.paper, color: C.ink2, cursor: 'pointer', borderRadius: 4, display: 'grid', placeItems: 'center' }}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4v3h-3"/><path d="M3 12V9h3"/>
              <path d="M13 7a5 5 0 00-9-1M3 9a5 5 0 009 1"/>
            </svg>
          </button>
          <button
            onClick={onNew}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 34, padding: '0 14px', borderRadius: 4,
              background: C.accent, color: '#fff', border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            New invoice
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, opacity: 0.7, border: '1px solid currentColor', borderRadius: 2, padding: '0 3px' }}>
              Ctrl+N
            </span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadState === 'error' && (
        <div style={{ padding: '8px 14px', background: C.badBg, border: '1px solid var(--c-bad-border)', borderRadius: 6, fontSize: 12.5, color: C.bad, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            Failed to load invoices.
            {errorMsg && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 6, opacity: 0.8 }}>{errorMsg}</span>}
          </span>
          <span
            role="button"
            onClick={() => {
              setLoadState('loading');
              Promise.all([getSalesInvoices(), getCustomers(), getSalespersons()])
                .then(([inv, cust, sp]) => { setRows(inv); setCustomers(cust); setSalespersons(sp); setLoadState('success'); })
                .catch(e => { setErrorMsg(e instanceof Error ? e.message : String(e)); setLoadState('error'); });
            }}
            style={{ color: '#1f3a8a', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}
          >
            ↻ Retry
          </span>
        </div>
      )}

      {/* Filter card */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6 }}>
        {/* Card head */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderBottom: `1px solid ${C.line}`,
          fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          <span>Filters</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.ink2,
            background: C.subtle, border: `1px solid ${C.line}`,
            borderRadius: 999, padding: '1px 7px', letterSpacing: 0,
          }}>
            {activeFilterCount} active
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', letterSpacing: 0, color: C.muted, fontSize: 11.5 }}>
            <span
              onClick={clearAllFilters}
              style={{
                color: C.muted, cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 6px', borderRadius: 3,
                opacity: activeFilterCount === 0 ? 0.4 : 1,
                pointerEvents: activeFilterCount === 0 ? 'none' : 'auto',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
              Clear all
            </span>
          </span>
        </div>

        {/* Filter grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.2fr) 1fr 1fr 1fr 1.2fr', gap: 0 }}>

          {/* DATE RANGE */}
          <div ref={dateFieldRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '12px 14px', borderRight: `1px solid ${C.line}`, position: 'relative' }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date range</label>
            <button
              style={filterCtrlStyle(filters.datePreset !== 'all' || !!(filters.dateFrom || filters.dateTo))}
              onClick={() => { setDatePop(v => !v); setCustPop(false); setSpPop(false); }}
              type="button"
            >
              <span style={{ color: C.muted, fontSize: 11.5, flexShrink: 0 }}>📅</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: (filters.datePreset === 'all' && !filters.dateFrom) ? C.muted2 : C.ink }}>
                {filters.datePreset === 'all' && !filters.dateFrom
                  ? 'Any date'
                  : presetLabel(filters.datePreset, filters.dateFrom, filters.dateTo)}
              </span>
              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            {/* Preset chips */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {(['today', 'yesterday', '7d', '30d', 'month'] as DatePreset[]).map(p => (
                <span
                  key={p}
                  onClick={() => setPreset(p)}
                  style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${filters.datePreset === p ? `color-mix(in oklab, ${C.info} 20%, transparent)` : 'transparent'}`,
                    background: filters.datePreset === p ? C.infoBg : 'transparent',
                    color: filters.datePreset === p ? C.info : C.muted,
                    fontWeight: filters.datePreset === p ? 500 : 400,
                  }}
                >
                  {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === '7d' ? 'Last 7d' : p === '30d' ? '30d' : 'This month'}
                </span>
              ))}
            </div>
            {/* Date popover */}
            {datePop && (
              <div style={{
                position: 'absolute', left: 14, right: 14, top: 'calc(100% - 4px)',
                zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`,
                borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden',
              }}>
                <div style={{ padding: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(['From', 'To'] as const).map((lbl, i) => (
                      <div key={lbl}>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{lbl}</label>
                        <input
                          type="date"
                          value={i === 0 ? customDateFrom : customDateTo}
                          onChange={e => i === 0 ? setCustomDateFrom(e.target.value) : setCustomDateTo(e.target.value)}
                          style={{ height: 32, padding: '0 10px', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.ink, width: '100%', outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle, fontSize: 11.5, color: C.muted }}>
                  <span style={{ marginLeft: 'auto', color: C.accent, cursor: 'pointer', fontWeight: 500 }}
                    onClick={() => {
                      setFilters(f => ({ ...f, datePreset: 'all', dateFrom: customDateFrom, dateTo: customDateTo }));
                      setDatePop(false); setPage(1);
                    }}
                  >
                    Apply
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* CUSTOMER */}
          <div ref={custFieldRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '12px 14px', borderRight: `1px solid ${C.line}`, position: 'relative' }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer</label>
            <button
              style={filterCtrlStyle(filters.customerId !== null)}
              onClick={() => { setCustPop(v => !v); setDatePop(false); setSpPop(false); if (!custPop) setTimeout(() => custSearchRef.current?.focus(), 30); }}
              type="button"
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: selectedCustomer ? C.ink : C.muted2 }}>
                {selectedCustomer ? selectedCustomer.name : 'All customers'}
              </span>
              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            <div style={{ fontSize: 11, color: C.muted2 }}>Type to search</div>
            {custPop && (
              <div style={{
                position: 'absolute', left: 14, right: 14, top: 'calc(100% - 4px)',
                zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`,
                borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden',
              }}>
                <div style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, background: C.subtle }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.muted }}>
                    <circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>
                  </svg>
                  <input
                    ref={custSearchRef}
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder="Search customer…"
                    style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: C.ink, flex: 1, minWidth: 0 }}
                  />
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                  <div
                    onClick={() => { setFilters(f => ({ ...f, customerId: null })); setCustPop(false); setCustSearch(''); setPage(1); }}
                    style={{
                      padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                      background: filters.customerId === null ? C.infoBg : 'transparent',
                      color: filters.customerId === null ? C.info : C.ink2,
                    }}
                  >
                    <div style={{ flex: 1 }}>All customers</div>
                    {filters.customerId === null && <span style={{ color: C.info }}>✓</span>}
                  </div>
                  {filteredCusts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => { setFilters(f => ({ ...f, customerId: c.id })); setCustPop(false); setCustSearch(''); setPage(1); }}
                      style={{
                        padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                        background: filters.customerId === c.id ? C.infoBg : 'transparent',
                        color: filters.customerId === c.id ? C.info : C.ink2,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>{c.name}</div>
                      {filters.customerId === c.id && <span style={{ color: C.info }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PAYMENT SEGMENTED */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '12px 14px', borderRight: `1px solid ${C.line}` }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payment</label>
            <div style={{
              display: 'inline-flex', alignItems: 'stretch',
              border: `1px solid ${C.line2}`, borderRadius: 4,
              background: C.subtle, padding: 2, gap: 2,
              height: 32, width: '100%', overflow: 'hidden',
            }}>
              {(['all', 'cash', 'credit', 'bank', 'partial'] as PayMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setFilters(f => ({ ...f, payment: m })); setPage(1); }}
                  style={{
                    appearance: 'none', border: filters.payment === m ? `1px solid ${C.line2}` : 0,
                    background: filters.payment === m ? C.paper : 'transparent',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                    color: filters.payment === m ? C.ink : C.muted,
                    padding: '0 8px', borderRadius: 3, cursor: 'pointer',
                    flex: 1, whiteSpace: 'nowrap', minWidth: 0,
                    boxShadow: filters.payment === m ? `0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px ${C.line2}` : undefined,
                  }}
                >
                  {PAY_LABEL[m]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted2 }}>Tap to filter</div>
          </div>

          {/* SALESPERSON */}
          <div ref={spFieldRef} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '12px 14px', borderRight: `1px solid ${C.line}`, position: 'relative' }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Salesperson</label>
            <button
              style={filterCtrlStyle(filters.salespersonId !== null)}
              onClick={() => { setSpPop(v => !v); setDatePop(false); setCustPop(false); }}
              type="button"
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: selectedSp ? C.ink : C.muted2 }}>
                {selectedSp ? selectedSp.name : 'All salespeople'}
              </span>
              <span style={{ color: C.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            <div style={{ fontSize: 11, color: C.muted2 }}>Optional</div>
            {spPop && (
              <div style={{
                position: 'absolute', left: 14, right: 14, top: 'calc(100% - 4px)',
                zIndex: 50, background: C.paper, border: `1px solid ${C.line2}`,
                borderRadius: 6, boxShadow: '0 12px 30px rgba(15,15,16,0.12)', overflow: 'hidden',
              }}>
                <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                  <div
                    onClick={() => { setFilters(f => ({ ...f, salespersonId: null })); setSpPop(false); setPage(1); }}
                    style={{
                      padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                      background: filters.salespersonId === null ? C.infoBg : 'transparent',
                      color: filters.salespersonId === null ? C.info : C.ink2,
                    }}
                  >
                    <div style={{ flex: 1 }}>All salespeople</div>
                    {filters.salespersonId === null && <span style={{ color: C.info }}>✓</span>}
                  </div>
                  {salespersons.map(s => (
                    <div
                      key={s.id}
                      onClick={() => { setFilters(f => ({ ...f, salespersonId: s.id })); setSpPop(false); setPage(1); }}
                      style={{
                        padding: '7px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                        background: filters.salespersonId === s.id ? C.infoBg : 'transparent',
                        color: filters.salespersonId === s.id ? C.info : C.ink2,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>{s.name}</div>
                      {filters.salespersonId === s.id && <span style={{ color: C.info }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SEARCH */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '12px 14px' }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Search</label>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }}>
                <circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Invoice no., customer or IMEI…"
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                style={{
                  height: 32, padding: '0 32px 0 32px',
                  background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4,
                  fontFamily: 'inherit', fontSize: 13, color: C.ink,
                  width: '100%', outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 3, pointerEvents: 'none' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 3, padding: '1px 5px', background: C.subtle }}>/</span>
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted2 }}>Matches invoice no., customer or IMEI</div>
          </div>
        </div>

        {/* Result summary strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '9px 14px', borderTop: `1px dashed ${C.line}`,
          background: 'var(--c-sidebar)', fontSize: 11.5, color: C.muted,
          borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
          flexWrap: 'wrap',
        }}>
          <span>Showing <b style={{ color: C.ink2, fontWeight: 600 }}>{filtered.length}</b> of <b style={{ color: C.ink2, fontWeight: 600 }}>{rows.length}</b></span>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', flexShrink: 0 }} />
          <span><b style={{ color: C.ink2, fontWeight: 600 }}>{activeRows.length}</b> active</span>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', flexShrink: 0 }} />
          <span><b style={{ color: C.ink2, fontWeight: 600 }}>{returnedRows.length}</b> returned</span>

          {/* Applied filter tags */}
          {(filters.datePreset !== 'all' || filters.dateFrom) && (
            <AppliedTag label={presetLabel(filters.datePreset, filters.dateFrom, filters.dateTo)} onRemove={() => { setFilters(f => ({ ...f, datePreset: 'all', dateFrom: '', dateTo: '' })); setCustomDateFrom(''); setCustomDateTo(''); setPage(1); }} />
          )}
          {filters.customerId !== null && selectedCustomer && (
            <AppliedTag label={`Customer: ${selectedCustomer.name}`} onRemove={() => { setFilters(f => ({ ...f, customerId: null })); setPage(1); }} />
          )}
          {filters.payment !== 'all' && (
            <AppliedTag label={`Payment: ${PAY_LABEL[filters.payment]}`} onRemove={() => { setFilters(f => ({ ...f, payment: 'all' })); setPage(1); }} />
          )}
          {filters.salespersonId !== null && selectedSp && (
            <AppliedTag label={`Salesperson: ${selectedSp.name}`} onRemove={() => { setFilters(f => ({ ...f, salespersonId: null })); setPage(1); }} />
          )}
          {filters.search && (
            <AppliedTag label={`Search: "${filters.search}"`} onRemove={() => { setFilters(f => ({ ...f, search: '' })); if (searchRef.current) searchRef.current.value = ''; setPage(1); }} />
          )}

          <div style={{ marginLeft: 'auto', fontSize: 11.5, color: C.muted }}>
            Filtered total <b style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: C.ink }}>{fmtShort(filteredTotal)}</b>
          </div>
        </div>
      </div>

      {/* Invoices table card */}
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {/* Card head */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderBottom: `1px solid ${C.line}`,
          fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
        }}>
          <span>Invoices</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.ink2, background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 999, padding: '1px 7px', letterSpacing: 0 }}>
            {filtered.length} rows
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'none', letterSpacing: 0, color: C.muted, fontSize: 11.5 }}>
            Sorted by <b style={{ color: C.ink2, fontWeight: 500, textTransform: 'none' }}>
              {sortCol === 'date' ? 'Date' : sortCol === 'no' ? 'Invoice no.' : 'Total'}
            </b>
            <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '↓ newest first' : '↑ oldest first'}</span>
          </span>
        </div>

        {/* Table scroll */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loadState === 'loading' ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 150 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 200 }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={thStyle(true, sortCol === 'no')}
                    onClick={() => toggleSort('no')}
                  >
                    Invoice no. <span style={{ display: 'inline-block', marginLeft: 4, opacity: sortCol === 'no' ? 1 : 0.45 }}>{sortIcon('no')}</span>
                  </th>
                  <th
                    style={thStyle(true, sortCol === 'date')}
                    onClick={() => toggleSort('date')}
                  >
                    Date <span style={{ display: 'inline-block', marginLeft: 4, opacity: sortCol === 'date' ? 1 : 0.45 }}>{sortIcon('date')}</span>
                  </th>
                  <th style={thStyle()}>Customer</th>
                  <th style={{ ...thStyle(true, sortCol === 'total'), textAlign: 'right' }} onClick={() => toggleSort('total')}>
                    Total <span style={{ display: 'inline-block', marginLeft: 4, opacity: sortCol === 'total' ? 1 : 0.45 }}>{sortIcon('total')}</span>
                  </th>
                  <th style={thStyle()}>Payment</th>
                  <th style={thStyle()}>Salesperson</th>
                  <th style={thStyle()}>Status</th>
                  <th style={{ ...thStyle(), textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 12px', textAlign: 'center', color: C.muted, fontSize: 13, borderBottom: 'none' }}>
                      No invoices match the current filters.
                    </td>
                  </tr>
                ) : paginated.map(inv => {
                  const returned = inv.status === 'returned';
                  const selected = inv.id === selectedId;
                  const rowStyle: React.CSSProperties = {
                    cursor: 'pointer',
                    background: selected
                      ? `color-mix(in oklab, ${C.accent} 5%, ${C.paper})`
                      : undefined,
                  };
                  const tdStyle: React.CSSProperties = {
                    padding: '11px 12px', borderBottom: `1px solid ${C.line}`,
                    verticalAlign: 'middle', color: returned ? C.muted : C.ink2,
                  };
                  return (
                    <tr
                      key={inv.id}
                      data-id={inv.id}
                      style={rowStyle}
                      onClick={() => setSelectedId(inv.id)}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--c-subtle)'; }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                    >
                      {/* Invoice no */}
                      <td style={{ ...tdStyle, color: C.ink, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                        {inv.invoice_no}
                      </td>
                      {/* Date */}
                      <td style={tdStyle}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", color: C.ink2, fontSize: 12.5 }}>{inv.date}</div>
                        <div style={{ color: C.muted, fontSize: 11.5, marginTop: 1 }}>{inv.created_at ? new Date(inv.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </td>
                      {/* Customer */}
                      <td style={tdStyle}>
                        <div style={{ color: C.ink }}>{inv.customer_name || 'Walk-in'}</div>
                        {inv.salesperson_name && (
                          <div style={{ color: C.muted, fontSize: 11.5, marginTop: 1 }}>{inv.salesperson_name}</div>
                        )}
                      </td>
                      {/* Total */}
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.ink, fontWeight: 600, fontSize: 13.5,
                        textDecoration: returned ? 'line-through' : undefined,
                        textDecorationColor: C.muted2,
                      }}>
                        ₨ {fmt(inv.total_amount)}
                      </td>
                      {/* Payment */}
                      <td style={tdStyle}>
                        <PayIcon mode={inv.payment_mode as Exclude<PayMode, 'all'>} />
                      </td>
                      {/* Salesperson */}
                      <td style={tdStyle}>
                        {inv.salesperson_name ?? <span style={{ color: C.muted2, fontStyle: 'italic' }}>—</span>}
                      </td>
                      {/* Status */}
                      <td style={tdStyle}>
                        <StatusBadge status={inv.status} />
                      </td>
                      {/* Actions */}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); onViewDetail(inv.id); }}
                            style={{
                              height: 26, padding: '0 9px', border: `1px solid ${C.line2}`,
                              background: C.paper, color: C.ink2, fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                              borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                            </svg>
                            View
                          </button>
                          <button
                            disabled={returned}
                            onClick={e => { e.stopPropagation(); onReturn(inv.id); }}
                            title={returned ? 'Already returned' : undefined}
                            style={{
                              height: 26, padding: '0 9px',
                              border: `1px solid ${returned ? C.line : `color-mix(in oklab, ${C.warn} 30%, transparent)`}`,
                              background: C.paper,
                              color: returned ? C.muted2 : C.warn,
                              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                              borderRadius: 4, cursor: returned ? 'not-allowed' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              opacity: returned ? 0.6 : 1,
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 3l-3 3 3 3"/><path d="M5 6h6a3 3 0 010 6h-3"/>
                            </svg>
                            Return
                          </button>
                          <button style={{
                            width: 26, height: 26, border: '1px solid transparent', background: 'transparent',
                            color: C.muted, borderRadius: 4, cursor: 'pointer', display: 'grid', placeItems: 'center',
                          }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                              <circle cx="4" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12" cy="8" r="1"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {paginated.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding: '11px 12px', background: 'var(--c-sidebar)', borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Filtered total{' '}
                      <span style={{ color: C.muted2, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                        ({activeRows.length} invoice{activeRows.length === 1 ? '' : 's'})
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', background: 'var(--c-sidebar)', borderTop: `1px solid ${C.line}`, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.ink, fontSize: 14, fontWeight: 700, textAlign: 'right' }}>
                      ₨ {fmt(filteredTotal)}
                    </td>
                    <td colSpan={4} style={{ padding: '11px 12px', background: 'var(--c-sidebar)', borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      excludes returned invoices
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Pagination footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 14px', borderTop: `1px solid ${C.line}`,
          fontSize: 11.5, color: C.muted, background: 'var(--c-sidebar)', flexShrink: 0,
        }}>
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{
              appearance: 'none', height: 24, padding: '0 22px 0 8px',
              border: `1px solid ${C.line}`, borderRadius: 3,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.ink2,
              background: `${C.paper} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%236b6b70' stroke-width='1.6'><path d='M4 6l4 4 4-4'/></svg>") no-repeat right 5px center`,
              backgroundSize: 10, cursor: 'pointer',
            }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ width: 3, height: 3, background: C.muted2, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
            {filtered.length === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`} of {filtered.length}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
            {[
              { label: '«', disabled: page === 1, action: () => setPage(1) },
              { label: '‹', disabled: page === 1, action: () => setPage(p => p - 1) },
              ...(totalPages <= 7
                ? Array.from({ length: totalPages }, (_, i) => ({ label: String(i + 1), disabled: false, action: () => setPage(i + 1), current: page === i + 1 }))
                : [
                  { label: String(page), disabled: false, action: () => {}, current: true },
                ]),
              { label: '›', disabled: page === totalPages, action: () => setPage(p => p + 1) },
              { label: '»', disabled: page === totalPages, action: () => setPage(totalPages) },
            ].map((btn, i) => (
              <button
                key={i}
                disabled={btn.disabled}
                onClick={btn.action}
                style={{
                  height: 26, minWidth: 26, padding: '0 8px',
                  border: `1px solid ${(btn as any).current ? C.ink : C.line}`,
                  background: (btn as any).current ? C.ink : C.paper,
                  color: (btn as any).current ? '#fff' : btn.disabled ? C.muted2 : C.ink2,
                  cursor: btn.disabled ? 'not-allowed' : 'pointer',
                  borderRadius: 4,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                  display: 'inline-grid', placeItems: 'center',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppliedTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '1px 4px 1px 7px',
      background: C.infoBg, color: C.info,
      borderRadius: 3, border: `1px solid color-mix(in oklab, ${C.info} 22%, transparent)`,
      fontSize: 11, fontWeight: 500,
    }}>
      {label}
      <span
        onClick={onRemove}
        style={{
          width: 14, height: 14, borderRadius: 2,
          display: 'inline-grid', placeItems: 'center',
          cursor: 'pointer', color: `color-mix(in oklab, ${C.info} 60%, ${C.muted})`,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4l8 8M12 4l-8 8"/>
        </svg>
      </span>
    </span>
  );
}
