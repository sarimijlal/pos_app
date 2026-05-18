import { useState, useEffect, useRef } from 'react';
import {
  getInventoryMobiles,
  getInventoryAccessories,
  getItemImeis,
} from '../../../db/repositories/inventory';
import type { MobileInventoryRow, AccessoryInventoryRow, ItemImeiRow } from '../types';

import { C } from '../../../lib/theme';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
}

function ImeiStatusPill({ status }: { status: string }) {
  const cfg =
    status === 'in_stock' ? { label: 'In stock', color: C.info, bg: C.infoBg, border: 'rgba(31,58,138,0.22)' } :
    status === 'sold'     ? { label: 'Sold',      color: C.ok,   bg: C.okBg,   border: 'rgba(15,122,74,0.22)' } :
                            { label: 'Returned',  color: C.warn, bg: C.warnBg, border: 'rgba(138,106,0,0.28)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {cfg.label}
    </span>
  );
}

function TypeChip({ type }: { type: 'mobile' | 'accessory' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px',
      borderRadius: 3, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: type === 'mobile' ? C.infoBg : C.subtle,
      color: type === 'mobile' ? C.info : C.muted,
      border: `1px solid ${type === 'mobile' ? 'rgba(31,58,138,0.18)' : C.line}`,
      flexShrink: 0,
    }}>
      {type === 'mobile' ? 'Mobile' : 'Acc.'}
    </span>
  );
}

function StockBar({ inStock, sold, returned }: { inStock: number; sold: number; returned: number }) {
  const total = inStock + sold + returned;
  if (total === 0) return <span style={{ color: C.muted2, fontSize: 11 }}>No IMEIs</span>;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: C.line }}>
        {inStock > 0 && <div style={{ width: pct(inStock), background: C.info }} />}
        {sold > 0    && <div style={{ width: pct(sold),    background: C.ok   }} />}
        {returned > 0 && <div style={{ width: pct(returned), background: C.warn }} />}
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: C.muted }}>
        <span style={{ color: C.info }}>{inStock} in stock</span>
        <span style={{ color: C.ok }}>{sold} sold</span>
        {returned > 0 && <span style={{ color: C.warn }}>{returned} returned</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, sub, variant }: {
  label: string; value: string | number; unit?: string; sub?: string;
  variant?: 'warn' | 'bad' | 'info';
}) {
  const color = variant === 'bad' ? C.bad : variant === 'warn' ? C.warn : variant === 'info' ? C.info : C.ink;
  const bg = variant === 'bad' ? C.badBg : variant === 'warn' ? C.warnBg : C.paper;
  const border = variant === 'bad' ? 'rgba(138,28,28,0.22)' : variant === 'warn' ? 'rgba(138,106,0,0.22)' : C.line;
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 6,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: C.muted }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

// ── IMEI sub-table ────────────────────────────────────────────────────────────
function ImeiTable({ imeis, loading, onViewImei }: {
  imeis: ItemImeiRow[];
  loading: boolean;
  onViewImei: (imei: string) => void;
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: '14px 48px', background: C.subtle, borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontSize: 12, color: C.muted2 }}>Loading IMEIs…</span>
        </td>
      </tr>
    );
  }
  if (imeis.length === 0) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: '14px 48px', background: C.subtle, borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontSize: 12, color: C.muted2 }}>No IMEIs recorded</span>
        </td>
      </tr>
    );
  }
  return (
    <>
      {/* IMEI column headers */}
      <tr>
        <td colSpan={7} style={{ padding: 0, background: C.subtle, borderBottom: `1px solid ${C.line}` }}>
          <table style={{ width: 'calc(100% - 48px)', borderCollapse: 'separate', borderSpacing: 0, marginLeft: 48 }}>
            <thead>
              <tr>
                {[['IMEI', undefined], ['Status', 130], ['Date added', 200], ['', 80]].map(([h, w], i) => (
                  <th key={i} style={{
                    padding: '6px 12px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, color: C.muted2,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: `1px solid ${C.line2}`,
                    width: w ? (w as number) : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {imeis.map(im => (
                <tr key={im.imei}
                  onMouseEnter={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = '#f0f0ee'; })}
                  onMouseLeave={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = ''; })}
                >
                  <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.line2}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink2, letterSpacing: '0.04em' }}>
                    {im.imei}
                  </td>
                  <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.line2}` }}>
                    <ImeiStatusPill status={im.status} />
                  </td>
                  <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.line2}`, fontSize: 12, color: C.muted }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{im.created_at.slice(0, 10)}</span>
                    <span style={{ marginLeft: 8, color: C.muted2 }}>{relativeTime(im.created_at)}</span>
                  </td>
                  <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.line2}` }}>
                    <button
                      onClick={e => { e.stopPropagation(); onViewImei(im.imei); }}
                      style={{ fontSize: 11.5, color: C.info, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 500 }}
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </td>
      </tr>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function InventoryListScreen({ onViewImei }: { onViewImei: (imei: string) => void }) {
  const [tab, setTab] = useState<'mobile' | 'accessory'>('mobile');
  const [mobiles, setMobiles] = useState<MobileInventoryRow[]>([]);
  const [accessories, setAccessories] = useState<AccessoryInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileSearch, setMobileSearch] = useState('');
  const [accessorySearch, setAccessorySearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [imeiCache, setImeiCache] = useState<Record<number, ItemImeiRow[]>>({});
  const [loadingImeis, setLoadingImeis] = useState<Set<number>>(new Set());
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const accSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getInventoryMobiles(), getInventoryAccessories()])
      .then(([m, a]) => { setMobiles(m); setAccessories(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setTab(t => t === 'mobile' ? 'accessory' : 'mobile');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleExpand = (id: number) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!(id in imeiCache)) {
        setLoadingImeis(prev => { const s = new Set(prev); s.add(id); return s; });
        getItemImeis(id)
          .then(imeis => setImeiCache(prev => ({ ...prev, [id]: imeis })))
          .catch(console.error)
          .finally(() => setLoadingImeis(prev => { const s = new Set(prev); s.delete(id); return s; }));
      }
    }
    setExpandedIds(next);
  };

  // KPIs
  const mobileInStock  = mobiles.reduce((s, m) => s + m.in_stock, 0);
  const mobileSold     = mobiles.reduce((s, m) => s + m.sold, 0);
  const mobileReturned = mobiles.reduce((s, m) => s + m.returned, 0);
  const accQty         = accessories.reduce((s, a) => s + a.quantity, 0);
  const lowStockCount  = accessories.filter(a => a.quantity > 0 && a.quantity < 5).length;
  const outOfStockCount = accessories.filter(a => a.quantity === 0).length;

  // Filtered lists
  const q = mobileSearch.trim().toLowerCase();
  const aq = accessorySearch.trim().toLowerCase();
  const filteredMobiles     = q  ? mobiles.filter(m => m.name.toLowerCase().includes(q))  : mobiles;
  const filteredAccessories = aq ? accessories.filter(a => a.name.toLowerCase().includes(aq)) : accessories;

  const thStyle = (right = false): React.CSSProperties => ({
    padding: '8px 14px', background: '#fbfbf9',
    borderBottom: `1px solid ${C.line}`,
    textAlign: right ? 'right' : 'left',
    fontSize: 10.5, fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.2, color: C.ink }}>Inventory</h2>
        <p style={{ margin: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
          Read-only view of on-hand stock. Mobiles are tracked per IMEI; accessories by quantity.
          Adjustments happen through purchase, sale and return forms.
        </p>
      </div>

      {/* ── KPI strip ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 88, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, animation: 'pulse 1.5s ease infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          <KpiCard label="Mobile models" value={mobiles.length} sub={`${mobileInStock + mobileSold + mobileReturned} IMEIs tracked`} />
          <KpiCard label="Mobiles · in stock" value={mobileInStock} variant="info"
            sub={`${mobileSold} sold · ${mobileReturned} returned`} />
          <KpiCard label="Accessories · in stock" value={Math.round(accQty)} unit="pcs"
            sub={`${accessories.length} SKUs`} />
          <KpiCard label="Low stock" value={lowStockCount} unit="SKUs" variant={lowStockCount > 0 ? 'warn' : undefined}
            sub="below 5 pcs threshold" />
          <KpiCard label="Out of stock" value={outOfStockCount} unit="SKUs" variant={outOfStockCount > 0 ? 'bad' : undefined}
            sub={outOfStockCount > 0 ? 're-order required' : 'all stocked'} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.line}` }}>
        {([
          { key: 'mobile' as const, label: 'Mobiles', count: mobiles.length,
            icon: <path d="M8 2H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2H8zM8 2v2M7 11h2" /> },
          { key: 'accessory' as const, label: 'Accessories', count: accessories.length,
            icon: <><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2"/></> },
        ] as const).map(({ key, label, count, icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '10px 18px', border: 'none', borderBottom: active ? `2px solid ${C.info}` : '2px solid transparent',
              background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 13.5, fontWeight: active ? 600 : 400, color: active ? C.info : C.muted,
              marginBottom: -1, fontFamily: 'inherit', transition: 'color .12s',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
              {label}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '1px 5px',
                borderRadius: 999, background: active ? C.infoBg : C.subtle,
                color: active ? C.info : C.muted2,
                border: `1px solid ${active ? 'rgba(31,58,138,0.2)' : C.line}`,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── MOBILES TAB ── */}
      {tab === 'mobile' && (
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, background: '#fbfbf9' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="6.5" cy="6.5" r="4" /><path d="M11 11l2.5 2.5" />
              </svg>
              <input ref={mobileSearchRef} value={mobileSearch} onChange={e => setMobileSearch(e.target.value)}
                placeholder="Filter by name, model…"
                style={{
                  height: 30, paddingLeft: 30, paddingRight: mobileSearch ? 28 : 10,
                  border: `1px solid ${C.line}`, borderRadius: 5, background: C.paper,
                  fontFamily: 'inherit', fontSize: 12.5, color: C.ink, outline: 'none', width: 220,
                }} />
              {mobileSearch && (
                <button onClick={() => { setMobileSearch(''); mobileSearchRef.current?.focus(); }}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              )}
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>
              Showing <b style={{ color: C.ink2 }}>{filteredMobiles.length}</b> of <b style={{ color: C.ink2 }}>{mobiles.length}</b> models
              {' '}· <b style={{ color: C.info }}>{mobileInStock}</b> in stock
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.muted2 }}>Click row to view IMEIs</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle(), width: 32 }} />
                <th style={thStyle()}>Item</th>
                <th style={{ ...thStyle(), width: 200 }}>Stock distribution</th>
                <th style={{ ...thStyle(true), width: 90 }}>In stock</th>
                <th style={{ ...thStyle(true), width: 80 }}>Sold</th>
                <th style={{ ...thStyle(true), width: 90 }}>Returned</th>
                <th style={{ ...thStyle(true), width: 70 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: C.muted2, fontSize: 13 }}>Loading…</td></tr>
              ) : filteredMobiles.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: C.muted2, fontSize: 13 }}>No mobile items found</td></tr>
              ) : filteredMobiles.map(m => {
                const expanded = expandedIds.has(m.id);
                return (
                  <>
                    <tr key={m.id}
                      onClick={() => toggleExpand(m.id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { if (!expanded) Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = '#f9f9f7'; }); }}
                      onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = expanded ? C.subtle : ''; }); }}
                    >
                      <td style={{ padding: '11px 8px 11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', verticalAlign: 'middle' }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          style={{ display: 'block', transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <TypeChip type="mobile" />
                          <span style={{ fontWeight: 500, color: C.ink }}>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', verticalAlign: 'middle' }}>
                        <StockBar inStock={m.in_stock} sold={m.sold} returned={m.returned} />
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: m.in_stock > 0 ? C.info : C.muted2, verticalAlign: 'middle' }}>
                        {m.in_stock}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.muted, verticalAlign: 'middle' }}>
                        {m.sold}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.muted, verticalAlign: 'middle' }}>
                        {m.returned}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: expanded ? 'none' : `1px solid ${C.line}`, background: expanded ? C.subtle : '', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: C.ink2, verticalAlign: 'middle' }}>
                        {m.total}
                      </td>
                    </tr>
                    {expanded && (
                      <ImeiTable
                        imeis={imeiCache[m.id] ?? []}
                        loading={loadingImeis.has(m.id)}
                        onViewImei={onViewImei}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.line}`, background: '#fbfbf9', fontSize: 11.5, color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{mobiles.length} models · {mobileInStock + mobileSold + mobileReturned} total IMEIs</span>
            <span>Mobiles tracked individually by IMEI</span>
          </div>
        </div>
      )}

      {/* ── ACCESSORIES TAB ── */}
      {tab === 'accessory' && (
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, background: '#fbfbf9' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="6.5" cy="6.5" r="4" /><path d="M11 11l2.5 2.5" />
              </svg>
              <input ref={accSearchRef} value={accessorySearch} onChange={e => setAccessorySearch(e.target.value)}
                placeholder="Filter by name, SKU…"
                style={{
                  height: 30, paddingLeft: 30, paddingRight: accessorySearch ? 28 : 10,
                  border: `1px solid ${C.line}`, borderRadius: 5, background: C.paper,
                  fontFamily: 'inherit', fontSize: 12.5, color: C.ink, outline: 'none', width: 220,
                }} />
              {accessorySearch && (
                <button onClick={() => { setAccessorySearch(''); accSearchRef.current?.focus(); }}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              )}
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>
              Showing <b style={{ color: C.ink2 }}>{filteredAccessories.length}</b> of <b style={{ color: C.ink2 }}>{accessories.length}</b> SKUs
              {' '}· <b style={{ color: C.ink2 }}>{Math.round(accQty)}</b> pcs total
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11.5, color: C.muted }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.warn }} />
                low &lt;5 pcs
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.bad }} />
                out of stock
              </span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle()}>Item</th>
                <th style={{ ...thStyle(), width: 170 }}>Status</th>
                <th style={{ ...thStyle(true), width: 140 }}>Qty in stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: C.muted2 }}>Loading…</td></tr>
              ) : filteredAccessories.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: C.muted2 }}>No accessories found</td></tr>
              ) : filteredAccessories.map(a => {
                const isOut = a.quantity === 0;
                const isLow = !isOut && a.quantity < 5;
                const statusCfg = isOut
                  ? { label: 'Out of stock', color: C.bad,  bg: C.badBg,  border: 'rgba(138,28,28,0.22)' }
                  : isLow
                  ? { label: 'Low stock',    color: C.warn, bg: C.warnBg, border: 'rgba(138,106,0,0.28)' }
                  : { label: 'In stock',     color: C.ok,   bg: C.okBg,   border: 'rgba(15,122,74,0.22)' };
                return (
                  <tr key={a.id}
                    onMouseEnter={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = '#f9f9f7'; })}
                    onMouseLeave={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => { c.style.background = ''; })}
                  >
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <TypeChip type="accessory" />
                        <span style={{ fontWeight: 500, color: isOut ? C.bad : isLow ? C.warn : C.ink }}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                        color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', verticalAlign: 'middle' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: isOut ? C.bad : isLow ? C.warn : C.ink,
                      }}>{Math.round(a.quantity)}</span>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>pcs</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.line}`, background: '#fbfbf9', fontSize: 11.5, color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{accessories.length} SKUs · {Math.round(accQty)} pcs total</span>
            <span>{lowStockCount > 0 ? `${lowStockCount} low · ` : ''}{outOfStockCount > 0 ? `${outOfStockCount} out of stock` : 'all stocked'}</span>
          </div>
        </div>
      )}

    </div>
  );
}
