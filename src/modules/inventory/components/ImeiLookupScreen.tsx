import { Fragment, useState, useEffect, useRef } from 'react';
import { lookupImei } from '../../../db/repositories/inventory';
import type { ImeiLookupResult } from '../types';
import type { Section } from '../../../components/AppShell';

const C = {
  bg: '#fafaf9', paper: '#ffffff',
  ink: '#0f0f10', ink2: '#2a2a2c', muted: '#6b6b70', muted2: '#9a9aa0',
  line: '#e5e5e3', line2: '#d6d6d2',
  ok: '#0f7a4a', okBg: '#e6f3ec',
  warn: '#8a6a00', warnBg: '#fbf2d9',
  info: '#1f3a8a', infoBg: '#e6ebf7',
  bad: '#8a1c1c', badBg: '#f7e6e6',
  subtle: '#f7f7f5', accent: '#1f3a8a',
};

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function daysBetween(a: string, b: string) {
  return Math.abs(Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

function StatusPill({ status }: { status: string }) {
  const cfg =
    status === 'in_stock' ? { label: 'In stock',  color: C.info, bg: C.infoBg, border: 'rgba(31,58,138,0.22)' } :
    status === 'sold'     ? { label: 'Sold',       color: C.ok,   bg: C.okBg,   border: 'rgba(15,122,74,0.22)' } :
                            { label: 'Returned',   color: C.bad,  bg: C.badBg,  border: 'rgba(138,28,28,0.22)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 22, padding: '0 9px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {cfg.label}
    </span>
  );
}

function TlNode({ type }: { type: 'purchase' | 'sale' | 'return' | 'pending' }) {
  const color =
    type === 'purchase' ? C.info :
    type === 'sale'     ? C.ok :
    type === 'return'   ? C.bad : C.muted2;
  const dashed = type === 'pending';
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
      background: dashed ? C.subtle : color + '15',
      display: 'grid', placeItems: 'center',
    }}>
      {type === 'purchase' && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h10v8H3z"/><path d="M3 7h10"/>
        </svg>
      )}
      {type === 'sale' && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l3-3 2 2 5-5"/><path d="M10 6h3v3"/>
        </svg>
      )}
      {type === 'return' && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8l-2-2 2-2"/><path d="M2 6h8a4 4 0 0 1 0 8H6"/>
        </svg>
      )}
      {type === 'pending' && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1"/>
        </svg>
      )}
    </div>
  );
}

function TimelineEvent({ type, label, date, relTime, isCurrent, invoiceNo, party, partyRole, amount, amountLabel, extras }: {
  type: 'purchase' | 'sale' | 'return' | 'pending';
  label: string; date?: string; relTime?: string; isCurrent?: boolean;
  invoiceNo?: string; party?: string; partyRole?: string;
  amount?: number; amountLabel?: string;
  extras?: Array<{ key: string; val: string }>;
}) {
  const color =
    type === 'purchase' ? C.info :
    type === 'sale'     ? C.ok :
    type === 'return'   ? C.bad : C.muted2;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <TlNode type={type} />
      </div>
      <div style={{
        flex: 1, background: type === 'pending' ? C.subtle : C.paper,
        border: `1px solid ${type === 'pending' ? C.line2 : color + '30'}`,
        borderRadius: 6, padding: '12px 14px',
        borderLeft: type !== 'pending' ? `3px solid ${color}` : undefined,
        borderStyle: type === 'pending' ? 'dashed' : undefined,
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: type === 'pending' ? 6 : 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{label}</span>
          {date && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted }}>{date}</span>
          )}
          {relTime && <span style={{ fontSize: 11, color: C.muted2 }}>· {relTime}</span>}
          {isCurrent && (
            <span style={{
              marginLeft: 'auto', height: 18, padding: '0 7px', borderRadius: 999,
              background: C.okBg, color: C.ok, fontSize: 10.5, fontWeight: 600,
              border: 'rgba(15,122,74,0.22)', display: 'inline-flex', alignItems: 'center',
            }}>Current</span>
          )}
        </div>
        {type === 'pending' ? (
          <p style={{ margin: 0, fontSize: 12, color: C.muted2 }}>Unit currently in stock — no sales invoice yet.</p>
        ) : (
          <>
            {invoiceNo && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, color: C.info }}>{invoiceNo}</span>
                {partyRole && <span style={{ fontSize: 11.5, color: C.muted }}>{partyRole}</span>}
                {party && <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink2 }}>{party}</span>}
              </div>
            )}
            {amount !== undefined && amountLabel && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: extras?.length ? 8 : 0 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: C.ink }}>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginRight: 2 }}>₨</span>
                  {fmt(amount)}
                </span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{amountLabel}</span>
              </div>
            )}
            {extras && extras.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', paddingTop: 6, borderTop: `1px dashed ${C.line}` }}>
                {extras.map(({ key, val }) => (
                  <span key={key} style={{ fontSize: 11.5, color: C.muted }}>
                    {key} <span style={{ color: C.ink2, fontWeight: 500 }}>{val}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export function ImeiLookupScreen({
  initialImei,
  onNavigate,
}: {
  initialImei?: string | null;
  onNavigate: (s: Section, id?: number) => void;
}) {
  const [input, setInput] = useState(initialImei ?? '');
  const [cycles, setCycles] = useState<ImeiLookupResult[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = async (imei: string) => {
    const clean = imei.trim();
    if (!clean) return;
    setState('loading');
    setCycles([]);
    try {
      const r = await lookupImei(clean);
      if (r.length > 0) { setCycles(r); setState('found'); }
      else { setState('not_found'); }
    } catch {
      setState('not_found');
    }
  };

  useEffect(() => {
    if (initialImei) doSearch(initialImei);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && state !== 'idle') {
        setInput(''); setCycles([]); setState('idle');
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state]);

  const copyImei = () => {
    if (cycles.length === 0) return;
    navigator.clipboard.writeText(cycles[0].imei).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const clear = () => {
    setInput(''); setCycles([]); setState('idle');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ── */}
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: -0.2, color: C.ink }}>IMEI Lookup</h2>
        <p style={{ margin: 0, fontSize: 12.5, color: C.muted }}>
          Trace the full lifecycle of any mobile unit — purchase, sale, returns.
        </p>
      </div>

      {/* ── Search bar ── */}
      <div style={{
        background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8,
        padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontSize: 11, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Enter IMEI
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11.5 11.5l2.5 2.5"/>
            </svg>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value.replace(/\D/g, '').slice(0, 15))}
              onKeyDown={e => e.key === 'Enter' && doSearch(input)}
              inputMode="numeric"
              placeholder="Enter IMEI number…"
              autoFocus={!initialImei}
              style={{
                width: '100%', height: 42, paddingLeft: 40, paddingRight: 40,
                border: `1.5px solid ${state === 'not_found' ? C.bad : C.line2}`,
                borderRadius: 6, background: C.paper, fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14, color: C.ink, outline: 'none', boxSizing: 'border-box',
                letterSpacing: '0.06em',
              }}
            />
            {input && (
              <button onClick={clear} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: 2, lineHeight: 1,
              }}>×</button>
            )}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.muted2, whiteSpace: 'nowrap' }}>
            {input.length} / 15
          </span>
          <button
            onClick={() => doSearch(input)}
            disabled={!input.trim() || state === 'loading'}
            style={{
              height: 42, padding: '0 20px', borderRadius: 6, border: 'none',
              background: !input.trim() ? C.line : C.accent, color: !input.trim() ? C.muted : '#fff',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: !input.trim() ? 'default' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'background .12s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11.5 11.5l2.5 2.5"/>
            </svg>
            {state === 'loading' ? 'Tracing…' : 'Trace'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted2 }}>
          Press <kbd style={{ fontFamily: "'JetBrains Mono', monospace", background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> to search ·
          {' '}<kbd style={{ fontFamily: "'JetBrains Mono', monospace", background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Ctrl I</kbd> to focus ·
          {' '}<kbd style={{ fontFamily: "'JetBrains Mono', monospace", background: C.subtle, border: `1px solid ${C.line}`, borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Esc</kbd> to clear
        </div>
      </div>

      {/* ── Loading ── */}
      {state === 'loading' && (
        <div style={{ padding: '32px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          Tracing IMEI…
        </div>
      )}

      {/* ── Not found ── */}
      {state === 'not_found' && (
        <div style={{
          background: C.paper, border: `1px solid rgba(138,28,28,0.22)`, borderRadius: 8,
          padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.badBg, border: `1px solid rgba(138,28,28,0.22)`, display: 'grid', placeItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.bad} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.bad, marginBottom: 4 }}>No unit matches that IMEI</div>
            <div style={{ fontSize: 13, color: C.muted }}>This IMEI doesn't exist in any purchase invoice in the system.</div>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '3px 10px', background: C.badBg, border: `1px solid rgba(138,28,28,0.18)`, borderRadius: 4, color: C.bad }}>
            {input}
          </span>
          <button onClick={clear} style={{
            height: 32, padding: '0 14px', border: `1px solid ${C.line2}`, background: C.paper,
            color: C.ink2, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500, borderRadius: 5, cursor: 'pointer',
          }}>← Back to search</button>
        </div>
      )}

      {/* ── Found ── */}
      {state === 'found' && cycles.length > 0 && (() => {
        const lastCycle  = cycles[cycles.length - 1];
        const isLastSold = lastCycle.status === 'sold';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Result header */}
            <div style={{
              background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>IMEI</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: '0.05em' }}>
                    {lastCycle.imei}
                  </span>
                  <button onClick={copyImei} title="Copy IMEI" style={{
                    height: 24, padding: '0 8px', border: `1px solid ${C.line}`, background: copied ? C.okBg : C.subtle,
                    color: copied ? C.ok : C.muted, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
                  }}>{copied ? '✓ Copied' : 'Copy'}</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Item</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.ink2 }}>{cycles[0].item_name}</span>
              </div>
              {cycles.length > 1 && (
                <span style={{
                  height: 22, padding: '0 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
                  background: C.infoBg, color: C.info, border: '1px solid rgba(31,58,138,0.22)',
                  display: 'inline-flex', alignItems: 'center',
                }}>
                  {cycles.length} ownership cycles
                </span>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <StatusPill status={lastCycle.status} />
              </div>
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, alignItems: 'start' }}>

              {/* ── Timeline ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ fontSize: 11, color: C.muted2, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
                  Trace · Lifecycle {cycles.length > 1 ? `(${cycles.length} cycles)` : ''}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cycles.map((c, i) => {
                    const isLastCycle = i === cycles.length - 1;
                    const hasSale     = (c.status === 'sold' || c.status === 'returned') && !!c.sale_invoice_no;
                    const isInStock   = c.status === 'in_stock';
                    const isReturned  = c.status === 'returned';

                    return (
                      <Fragment key={c.purchase_invoice_id}>
                        {/* Cycle separator after first */}
                        {i > 0 && (
                          <div style={{ marginLeft: 13, width: 2, height: 18, background: C.line2 }} />
                        )}

                        {/* Purchase */}
                        <TimelineEvent
                          type="purchase"
                          label={i === 0 ? 'Purchased' : `Purchased again · #${i + 1}`}
                          date={c.purchase_date}
                          relTime={relativeTime(c.purchase_date)}
                          isCurrent={isInStock && isLastCycle}
                          invoiceNo={c.purchase_invoice_no}
                          partyRole="from supplier"
                          party={c.supplier_name}
                          amount={c.cost_price}
                          amountLabel="cost price"
                          extras={[{ key: 'Supplier', val: c.supplier_name }]}
                        />

                        <div style={{ marginLeft: 13, width: 2, height: 10, background: C.line2 }} />

                        {/* Sale or awaiting */}
                        {hasSale ? (
                          <TimelineEvent
                            type="sale"
                            label="Sold"
                            date={c.sale_date ?? undefined}
                            relTime={c.sale_date ? relativeTime(c.sale_date) : undefined}
                            isCurrent={c.status === 'sold' && isLastCycle}
                            invoiceNo={c.sale_invoice_no!}
                            partyRole="to customer"
                            party={c.customer_name ?? undefined}
                            amount={c.sale_price ?? undefined}
                            amountLabel="sale price"
                            extras={c.customer_name ? [{ key: 'Customer', val: c.customer_name }] : undefined}
                          />
                        ) : (
                          <TimelineEvent type="pending" label="Awaiting sale" isCurrent={isInStock && isLastCycle} />
                        )}

                        {/* Return */}
                        {isReturned && (
                          <>
                            <div style={{ marginLeft: 13, width: 2, height: 10, background: C.line2 }} />
                            <TimelineEvent
                              type="return"
                              label="Returned"
                              isCurrent={isLastCycle}
                              extras={[{ key: 'Status', val: 'Returned (see return invoice)' }]}
                            />
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              {/* ── Financials + Links ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Financials card — shows most recent cycle */}
                <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, background: C.subtle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Financials {cycles.length > 1 ? '· current cycle' : ''}
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Cost price', value: `₨ ${fmt(lastCycle.cost_price)}`, color: C.ink2 },
                      { label: 'Sale price', value: lastCycle.sale_price ? `₨ ${fmt(lastCycle.sale_price)}` : '— not sold —', color: lastCycle.sale_price ? C.ink2 : C.muted2 },
                      {
                        label: isLastSold ? 'Profit' : lastCycle.status === 'in_stock' ? 'Unrealized cost' : 'Net impact',
                        value: lastCycle.profit != null ? `₨ ${fmt(Math.abs(lastCycle.profit))}` : `₨ ${fmt(lastCycle.cost_price)}`,
                        color: lastCycle.profit != null ? (lastCycle.profit >= 0 ? C.ok : C.bad) : C.muted,
                        prefix: lastCycle.profit != null ? (lastCycle.profit >= 0 ? '+' : '−') : undefined,
                      },
                    ].map(({ label, value, color, prefix }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                        <span style={{ color: C.muted }}>{label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
                          {prefix && <span style={{ fontSize: 11 }}>{prefix} </span>}{value}
                        </span>
                      </div>
                    ))}
                    {isLastSold && lastCycle.sale_price && lastCycle.profit != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, paddingTop: 6, borderTop: `1px dashed ${C.line}` }}>
                        <span style={{ color: C.muted }}>Margin</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: lastCycle.profit >= 0 ? C.ok : C.bad }}>
                          {((lastCycle.profit / lastCycle.sale_price) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, paddingTop: 6, borderTop: `1px dashed ${C.line}` }}>
                      <span style={{ color: C.muted }}>{isLastSold ? 'Time on shelf' : 'Days in stock'}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.ink2 }}>
                        {isLastSold && lastCycle.sale_date
                          ? daysBetween(lastCycle.purchase_date, lastCycle.sale_date)
                          : daysBetween(lastCycle.purchase_date, today)}d
                      </span>
                    </div>
                  </div>
                </div>

                {/* Links card — all invoices across all cycles */}
                <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.line}`, background: C.subtle }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open invoices</span>
                  </div>
                  <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {cycles.map((c, i) => (
                      <Fragment key={`links-${c.purchase_invoice_id}`}>
                        <button
                          onClick={() => onNavigate('purchase-detail', c.purchase_invoice_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.subtle; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.info, flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: C.ink2 }}>Purchase{cycles.length > 1 ? ` #${i + 1}` : ''}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.info, marginLeft: 'auto' }}>
                            {c.purchase_invoice_no} →
                          </span>
                        </button>
                        {c.sale_invoice_id && c.sale_invoice_no && (
                          <button
                            onClick={() => onNavigate('sales-detail', c.sale_invoice_id!)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.subtle; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ok, flexShrink: 0 }} />
                            <span style={{ fontSize: 12.5, color: C.ink2 }}>Sale{cycles.length > 1 ? ` #${i + 1}` : ''}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ok, marginLeft: 'auto' }}>
                              {c.sale_invoice_no} →
                            </span>
                          </button>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
