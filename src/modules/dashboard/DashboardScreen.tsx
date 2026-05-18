import { useState, useEffect, useCallback } from 'react';
import { getDashboardSummary } from '../../db/repositories/accounting';
import type { DashboardSummary, LowStockItem, RecentEntry } from '../accounting/types';
import type { Section } from '../../components/AppShell';

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dateLabel() {
  const now = new Date();
  const dayNum = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'short' });
  const rest = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${weekday} · ${rest} · day ${dayNum} of ${daysInMonth}`;
}

// ── static sparklines (decorative) ────────────────────────────────────────
const SPARKS = [
  {
    fill: 'M0,20 L8,18 L16,19 L24,15 L32,16 L40,12 L48,13 L56,9 L64,11 L72,7 L80,8 L88,5 L96,6 L100,4 L100,24 L0,24 Z',
    line: 'M0,20 L8,18 L16,19 L24,15 L32,16 L40,12 L48,13 L56,9 L64,11 L72,7 L80,8 L88,5 L96,6 L100,4',
  },
  {
    fill: 'M0,12 L10,14 L20,11 L30,16 L40,15 L50,9 L60,13 L70,10 L80,17 L90,14 L100,16 L100,24 L0,24 Z',
    line: 'M0,12 L10,14 L20,11 L30,16 L40,15 L50,9 L60,13 L70,10 L80,17 L90,14 L100,16',
  },
  {
    fill: 'M0,16 L10,14 L20,15 L30,12 L40,13 L50,11 L60,12 L70,9 L80,10 L90,8 L100,7 L100,24 L0,24 Z',
    line: 'M0,16 L10,14 L20,15 L30,12 L40,13 L50,11 L60,12 L70,9 L80,10 L90,8 L100,7',
  },
  {
    fill: 'M0,8 L12,10 L24,9 L36,12 L48,11 L60,14 L72,13 L84,15 L96,14 L100,15 L100,24 L0,24 Z',
    line: 'M0,8 L12,10 L24,9 L36,12 L48,11 L60,14 L72,13 L84,15 L96,14 L100,15',
  },
];

function Sparkline({ idx, accent }: { idx: number; accent?: boolean }) {
  const { fill, line } = SPARKS[idx];
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none"
      style={{ width: '100%', height: 24, opacity: 0.85, color: accent ? 'var(--c-accent)' : 'var(--c-ink2)' }}>
      <path d={fill} fill="currentColor" fillOpacity={accent ? 0.08 : 0.05} />
      <path d={line} fill="none"
        stroke="currentColor"
        strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── payment badge ─────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  cash:    { color: 'var(--c-ok)',     bg: 'var(--c-ok-bg)',     border: 'var(--c-ok-border)' },
  credit:  { color: 'var(--c-accent)', bg: 'var(--c-accent-bg)', border: 'var(--c-accent-border)' },
  partial: { color: 'var(--c-warn)',   bg: 'var(--c-warn-bg)',   border: 'var(--c-warn-border)' },
  card:    { color: 'var(--c-ink2)',   bg: 'var(--c-subtle)',    border: 'var(--c-line2)' },
  bank:    { color: 'var(--c-ink2)',   bg: 'var(--c-subtle)',    border: 'var(--c-line2)' },
  sale:    { color: 'var(--c-ok)',     bg: 'var(--c-ok-bg)',     border: 'var(--c-ok-border)' },
  purchase:{ color: 'var(--c-accent)', bg: 'var(--c-accent-bg)', border: 'var(--c-accent-border)' },
};

function Badge({ type, label }: { type: string; label: string }) {
  const s = BADGE_STYLES[type] ?? BADGE_STYLES.card;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 7px', borderRadius: 999,
      fontSize: 11, fontWeight: 500,
      border: `1px solid ${s.border}`,
      color: s.color, background: s.bg,
      fontVariantNumeric: 'tabular-nums', lineHeight: 1,
    }}>
      {type !== 'card' && type !== 'bank' && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      )}
      {label}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({
  label, icon, value, currency = '₨', sparkIdx, accent,
  metaLeft, metaRight, subRight,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | number;
  currency?: string;
  sparkIdx: number;
  accent?: boolean;
  metaLeft?: React.ReactNode;
  metaRight?: React.ReactNode;
  subRight?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--c-paper)',
        border: accent
          ? `1px solid var(--c-accent-border)`
          : `1px solid ${hov ? 'var(--c-line2)' : 'var(--c-line)'}`,
        borderRadius: 6,
        padding: accent ? '14px 16px 12px 18px' : '14px 16px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        position: 'relative',
        boxShadow: accent ? 'inset 2px 0 0 var(--c-accent)' : undefined,
        transition: 'border-color .12s',
      }}
    >
      <div style={{ fontSize: 11.5, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.01em' }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.7, flexShrink: 0 }}>
          {icon}
        </svg>
        {label}
      </div>

      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        fontSize: 24, fontWeight: 500, color: 'var(--c-ink)',
        letterSpacing: -0.4, lineHeight: 1.05,
      }}>
        <span style={{ fontSize: 13, color: 'var(--c-muted2)', marginRight: 4, fontWeight: 400 }}>{currency}</span>
        {typeof value === 'number' ? fmt(value) : value}
      </div>

      <Sparkline idx={sparkIdx} accent={accent} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, marginTop: 'auto' }}>
        {metaLeft}
        {metaRight && <span style={{ color: 'var(--c-muted2)' }}>{metaRight}</span>}
        {subRight && (
          <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--c-muted2)', letterSpacing: '0.02em' }}>
            {subRight}
          </span>
        )}
      </div>
    </div>
  );
}

// ── PeriodSeg ─────────────────────────────────────────────────────────────
function PeriodSeg({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      role="button"
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 3,
        color: active ? 'var(--c-ink)' : 'var(--c-muted2)',
        fontWeight: active ? 500 : undefined,
        background: active ? 'var(--c-subtle)' : undefined,
        cursor: 'pointer',
      }}
    >{label}</div>
  );
}

// ── StockRow ──────────────────────────────────────────────────────────────
function StockRow({ item }: { item: LowStockItem }) {
  const isCrit = item.quantity <= 2;
  const pct = Math.round((item.quantity / 5) * 100);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: '4px 12px', padding: '11px 14px',
      borderBottom: '1px solid var(--c-line)', alignItems: 'center',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-subtle)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      <div>
        <div style={{ fontSize: 13, color: 'var(--c-ink)', fontWeight: 500 }}>{item.name}</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--c-muted)', marginTop: 1 }}>
          accessory
        </div>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13, fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color: isCrit ? 'var(--c-bad)' : 'var(--c-warn)',
        whiteSpace: 'nowrap',
      }}>
        {item.quantity}
        <span style={{ color: 'var(--c-muted2)', fontWeight: 400 }}> units</span>
      </div>
      <div style={{ gridColumn: '1 / -1', height: 4, background: 'var(--c-subtle)', borderRadius: 2, overflow: 'hidden', position: 'relative', marginTop: 2 }}>
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          background: isCrit ? 'var(--c-bad)' : 'var(--c-warn)',
          borderRadius: 2,
          width: `${pct}%`,
        }} />
      </div>
    </div>
  );
}

// ── RecentRow ─────────────────────────────────────────────────────────────
function RecentRow({ entry, onNavigate }: { entry: RecentEntry; onNavigate: (s: Section, id?: number) => void }) {
  const isSale = entry.source_type === 'sale' || entry.source_type === 'sale_return';
  const dest = isSale ? 'sales-detail' : 'purchase-detail';
  return (
    <tr
      style={{ cursor: 'pointer' }}
      onClick={() => onNavigate(dest, entry.source_id)}
      onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = 'var(--c-subtle)'; }); }}
      onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = ''; }); }}
    >
      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-line)', color: 'var(--c-ink2)', verticalAlign: 'middle' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--c-ink2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSale ? 'var(--c-ok)' : 'var(--c-accent)', flexShrink: 0 }} />
          {entry.reference_no}
        </span>
      </td>
      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-line)', color: 'var(--c-ink)', verticalAlign: 'middle', maxWidth: 200 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {entry.narration}
        </span>
      </td>
      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-line)', verticalAlign: 'middle' }}>
        <Badge type={entry.source_type} label={isSale ? 'Sale' : 'Purchase'} />
      </td>
      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-line)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: 'var(--c-ink)', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>
        {fmt(entry.total_debit)}
      </td>
      <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-line)', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--c-muted)', fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>
        {entry.date}
      </td>
    </tr>
  );
}

// ── DashboardScreen ────────────────────────────────────────────────────────
export function DashboardScreen({ onNavigate }: { onNavigate: (s: Section, id?: number) => void }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [entryFilter, setEntryFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [greet] = useState(() => greeting());
  const [dateLbl] = useState(() => dateLabel());

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const d = await getDashboardSummary(period);
      setData(d);
      setLoadState('success');
    } catch (e) {
      console.error('Dashboard load failed:', e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, [period]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sales = data?.period_sales ?? 0;
  const purchases = data?.period_purchases ?? 0;
  const critCount = data?.low_stock.filter(i => i.quantity <= 2).length ?? 0;
  const lowCount = (data?.low_stock.length ?? 0) - critCount;
  const visibleEntries = data?.recent_entries.filter(e =>
    entryFilter === 'all' ? true :
    entryFilter === 'sale' ? (e.source_type === 'sale' || e.source_type === 'sale_return') :
    (e.source_type === 'purchase' || e.source_type === 'purchase_return')
  ) ?? [];

  return (
    <>
      {/* ── Greeting row ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '0 2px' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.2 }}>
          {greet}, Counter 1.
        </h2>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {dateLbl}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, padding: 2, background: 'var(--c-paper)', border: '1px solid var(--c-line)', borderRadius: 4, fontSize: 12 }}>
          {(['today', 'week', 'month'] as const).map((p, i) => (
            <PeriodSeg key={p} label={['Today', 'This week', 'This month'][i]} active={period === p} onClick={() => setPeriod(p)} />
          ))}
        </div>
      </div>

      {/* ── Load error banner ── */}
      {loadState === 'error' && (
        <div style={{ padding: '8px 14px', background: 'var(--c-bad-bg)', border: '1px solid var(--c-bad-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--c-bad)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>
            Failed to load dashboard data.
            {errorMsg && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 6, opacity: 0.8 }}>{errorMsg}</span>}
          </span>
          <span role="button" onClick={load}
            style={{ color: 'var(--c-accent)', cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' }}>
            ↻ Retry
          </span>
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard
          label={period === 'today' ? "Today's sales" : period === 'week' ? "This week's sales" : "This month's sales"}
          sparkIdx={0} accent
          icon={<><path d="M3 12l3-3 2 2 5-5"/><path d="M10 6h3v3"/></>}
          value={sales}
          metaLeft={<span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--c-muted)' }}>—</span>}
          metaRight={period === 'today' ? 'vs yesterday' : period === 'week' ? 'last 7 days' : 'month to date'}
          subRight={`${data?.recent_entries.filter(e => e.source_type === 'sale').length ?? 0} invoices`}
        />
        <KpiCard
          label={period === 'today' ? "Today's purchases" : period === 'week' ? "This week's purchases" : "This month's purchases"}
          sparkIdx={1}
          icon={<><path d="M3 4h10v8H3z"/><path d="M3 7h10"/></>}
          value={purchases}
          metaLeft={<span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--c-muted)' }}>—</span>}
          metaRight={period === 'today' ? 'vs yesterday' : period === 'week' ? 'last 7 days' : 'month to date'}
          subRight={`${data?.recent_entries.filter(e => e.source_type === 'purchase').length ?? 0} invoices`}
        />
        <KpiCard
          label="Cash in hand" sparkIdx={2}
          icon={<><rect x="2" y="5" width="12" height="7" rx="1"/><circle cx="8" cy="8.5" r="1.5"/></>}
          value={data?.cash_in_hand ?? 0}
          metaLeft={
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--c-muted)' }}>
              {data ? `+₨ ${fmt(Math.max(0, sales - purchases))}` : '—'}
            </span>
          }
          metaRight="today's net"
        />
        <KpiCard
          label="Receivables outstanding" sparkIdx={3}
          icon={<><path d="M2 4h12v8H2z"/><path d="M2 7l6 3 6-3"/></>}
          value={data?.total_receivables ?? 0}
          metaLeft={
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--c-muted)' }}>
              {data ? `${data.receivable_customers} customer${data.receivable_customers !== 1 ? 's' : ''}` : '—'}
            </span>
          }
          metaRight={data && data.receivable_customers > 0 ? 'outstanding' : undefined}
        />
      </div>

      {/* ── Lower grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>

        {/* Recent transactions */}
        <div style={{ background: 'var(--c-paper)', border: '1px solid var(--c-line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--c-line)' }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Recent transactions</h3>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--c-muted)', background: 'var(--c-subtle)', border: '1px solid var(--c-line)', padding: '1px 6px', borderRadius: 3 }}>
              {visibleEntries.length}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 1, background: 'var(--c-subtle)', border: '1px solid var(--c-line)', borderRadius: 4, padding: 2, fontSize: 11.5 }}>
                {(['all', 'sale', 'purchase'] as const).map((f, i) => {
                  const label = ['All', 'Sales', 'Purchases'][i];
                  const active = entryFilter === f;
                  return (
                    <span key={f} onClick={() => setEntryFilter(f)} style={{ padding: '2px 8px', borderRadius: 3, color: active ? 'var(--c-ink)' : 'var(--c-muted)', fontWeight: active ? 500 : undefined, background: active ? 'var(--c-paper)' : undefined, cursor: 'pointer', boxShadow: active ? '0 1px 0 rgba(0,0,0,0.03)' : undefined }}>{label}</span>
                  );
                })}
              </div>
              <span
                role="button"
                onClick={() => onNavigate('sales-list')}
                style={{ fontSize: 12, color: 'var(--c-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >View all <span style={{ fontSize: 10 }}>→</span></span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                {[['Invoice', 108], ['Party', undefined], ['Type', 120], ['Amount', 130], ['Date', 80]].map(([h, w]) => (
                  <th key={h as string} style={{
                    textAlign: h === 'Amount' ? 'right' : 'left',
                    fontSize: 10.5, fontWeight: 600, color: 'var(--c-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '8px 14px', background: 'var(--c-sidebar)',
                    borderBottom: '1px solid var(--c-line)',
                    width: w ? w : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data == null
                ? <tr><td colSpan={5} style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--c-muted2)' }}>Loading…</td></tr>
                : visibleEntries.length === 0
                  ? <tr><td colSpan={5} style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--c-muted2)' }}>No transactions</td></tr>
                  : visibleEntries.map(e => <RecentRow key={e.id} entry={e} onNavigate={onNavigate} />)
              }
            </tbody>
          </table>

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--c-line)', background: 'var(--c-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--c-muted)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {visibleEntries.length} entries · auto-refresh 60s
            </span>
            <span style={{ display: 'flex', gap: 14 }}>
              <span>Sales <b style={{ color: 'var(--c-ink2)', fontWeight: 500 }}>₨ {fmt(sales)}</b></span>
              <span>Purchases <b style={{ color: 'var(--c-ink2)', fontWeight: 500 }}>₨ {fmt(purchases)}</b></span>
            </span>
          </div>
        </div>

        {/* Low stock */}
        <div style={{ background: 'var(--c-paper)', border: '1px solid var(--c-line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--c-line)' }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Low stock alerts</h3>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--c-muted)', background: 'var(--c-subtle)', border: '1px solid var(--c-line)', padding: '1px 6px', borderRadius: 3 }}>
              {data?.low_stock.length ?? 0}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <span
                role="button"
                onClick={() => onNavigate('inventory-stock')}
                style={{ fontSize: 12, color: 'var(--c-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >Inventory <span style={{ fontSize: 10 }}>→</span></span>
            </div>
          </div>

          {data == null
            ? <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--c-muted2)', fontSize: 12 }}>Loading…</div>
            : data.low_stock.length === 0
              ? <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--c-muted2)', fontSize: 12 }}>All accessories well-stocked</div>
              : data.low_stock.map(item => <StockRow key={item.item_id} item={item} />)
          }

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--c-line)', background: 'var(--c-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--c-muted)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {critCount > 0 ? `${critCount} critical · ` : ''}{lowCount} low
            </span>
            <span>Mobiles tracked by IMEI</span>
          </div>
        </div>

      </div>
    </>
  );
}
