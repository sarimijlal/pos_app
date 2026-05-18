import { useState, useEffect } from 'react';
import { getSalesInvoiceById } from '../../../db/repositories/sales';
import type { SalesInvoiceDetail } from '../types';

const C = {
  ink: '#0f0f10', ink2: '#2a2a2c', ink3: '#6b6b70', muted: '#9a9aa0',
  paper: '#ffffff', bg: '#fafaf9', line: '#e5e5e3', line2: '#d6d6d2',
  accent: '#1f3a8a', ok: '#0f7a4a', warn: '#b08800', danger: '#8a1c1c',
  accentBg: '#e6ebf7', okBg: '#e6f3ec', warnBg: '#fbf2d9',
};

function fmt(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

const PAY_COLOR: Record<string, { color: string; bg: string; border: string }> = {
  cash:   { color: C.ok,     bg: C.okBg,    border: 'rgba(15,122,74,0.22)' },
  credit: { color: C.accent, bg: C.accentBg, border: 'rgba(31,58,138,0.22)' },
  card:   { color: C.ink2,   bg: '#f1f1ef',  border: C.line2 },
  bank:   { color: C.ink2,   bg: '#f1f1ef',  border: C.line2 },
};

function PayBadge({ type }: { type: string }) {
  const s = PAY_COLOR[type] ?? PAY_COLOR.credit;
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 20,
      padding: '0 7px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      border: `1px solid ${s.border}`, color: s.color, background: s.bg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span style={{
      height: 20, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center',
      background: active ? C.okBg : C.warnBg,
      color: active ? C.ok : C.warn,
      border: `1px solid ${active ? 'rgba(15,122,74,0.22)' : 'rgba(138,106,0,0.28)'}`,
    }}>{active ? 'Active' : 'Returned'}</span>
  );
}

export function SalesInvoiceDetailScreen({ invoiceId, onBack }: { invoiceId: number | null; onBack: () => void }) {
  const [inv, setInv] = useState<SalesInvoiceDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (invoiceId == null) { setLoadState('success'); return; }
    setLoadState('loading');
    getSalesInvoiceById(invoiceId)
      .then(d => { setInv(d); setLoadState('success'); })
      .catch(e => {
        console.error('Failed to load sales invoice:', e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadState('error');
      });
  }, [invoiceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            height: 32, padding: '0 12px', border: `1px solid ${C.line}`,
            background: C.paper, color: C.ink2, fontFamily: 'inherit', fontSize: 13,
            fontWeight: 500, borderRadius: 5, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        {inv && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.ink2, fontWeight: 500 }}>
              {inv.invoice_no}
            </span>
            <StatusChip status={inv.status} />
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Sales Invoice
        </span>
      </div>

      {loadState === 'loading' && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          Loading…
        </div>
      )}

      {loadState === 'error' && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40, color: C.danger, fontSize: 13 }}>
          Failed to load invoice.{errorMsg && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 8, opacity: 0.8 }}>{errorMsg}</span>}
        </div>
      )}

      {loadState === 'success' && !inv && (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40, color: C.muted, fontSize: 13 }}>
          Invoice not found.
        </div>
      )}

      {loadState === 'success' && inv && (
        <>
          {/* Meta grid */}
          <div style={{
            background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          }}>
            {[
              { label: 'Customer', value: inv.customer_name },
              { label: 'Salesperson', value: inv.salesperson_name ?? '—' },
              { label: 'Invoice date', value: inv.date },
              { label: 'Payment', value: <PayBadge type={inv.payment_mode} /> },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                padding: '12px 16px',
                borderRight: i < 3 ? `1px solid ${C.line}` : undefined,
              }}>
                <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 5 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
                  {typeof value === 'string' ? value : value}
                </div>
              </div>
            ))}
          </div>

          {/* Lines table */}
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  {[['#', 32], ['Item', undefined], ['Qty', 70], ['Price', 110], ['Disc', 80], ['Total', 110]].map(([h, w]) => (
                    <th key={h as string} style={{
                      padding: '9px 14px', background: '#fbfbf9',
                      borderBottom: `1px solid ${C.line}`,
                      textAlign: (h === 'Price' || h === 'Disc' || h === 'Total') ? 'right' : 'left',
                      fontSize: 10.5, fontWeight: 600, color: C.ink3,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      width: w ? w : undefined,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((line, idx) => {
                  const isMobile = line.imeis.length > 0;
                  return (
                    <>
                      <tr key={line.id}>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, color: C.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, verticalAlign: 'top' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 500, color: C.ink }}>{line.item_name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{isMobile ? 'Mobile' : 'Accessory'}</div>
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' }}>
                          {line.quantity}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', verticalAlign: 'top' }}>
                          {fmt(line.sale_price)}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', color: line.discount ? C.warn : C.muted, verticalAlign: 'top' }}>
                          {line.discount ? fmt(line.discount) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: isMobile ? undefined : `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500, verticalAlign: 'top' }}>
                          {fmt(line.total)}
                        </td>
                      </tr>
                      {isMobile && (
                        <tr key={`${line.id}-imeis`}>
                          <td />
                          <td colSpan={5} style={{ padding: '4px 14px 10px', borderBottom: `1px solid ${C.line}` }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {line.imeis.map(im => {
                                const col = im.status === 'in_stock' ? C.accent : im.status === 'sold' ? C.ok : C.warn;
                                const bg = im.status === 'in_stock' ? C.accentBg : im.status === 'sold' ? C.okBg : C.warnBg;
                                return (
                                  <span key={im.imei} style={{
                                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                                    padding: '2px 7px', borderRadius: 4,
                                    background: bg, color: col,
                                    border: `1px solid ${col}30`,
                                  }}>
                                    {im.imei}
                                    <span style={{ marginLeft: 5, opacity: 0.7, fontSize: 10 }}>{im.status.replace('_', ' ')}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>

            {/* Footer total */}
            <div style={{
              padding: '12px 14px', borderTop: `1px solid ${C.line}`, background: '#fbfbf9',
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 12, color: C.ink3 }}>Total</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600,
                color: C.ink, fontVariantNumeric: 'tabular-nums',
              }}>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginRight: 4 }}>₨</span>
                {fmt(inv.total_amount)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
