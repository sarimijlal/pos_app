// ── Cellr mark (rounded square + header-bar knockout) ────────────────────────
function CellrMark({ size = 88 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      aria-label="Cellr" style={{ display: 'block' }}
    >
      <rect x="4" y="4" width="56" height="56" rx="13" fill="#0f0f10" />
      <rect x="14" y="15.5" width="36" height="4.5" rx="2.25" fill="#fafaf9" />
    </svg>
  );
}

// ── Animated three-dot loader ─────────────────────────────────────────────────
function ThreeDots() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {([0, 0.18, 0.36] as const).map((delay, i) => (
        <span
          key={i}
          className="cellr-dot"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
interface LoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

export function LoadingScreen({ error, onRetry }: LoadingScreenProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#fafaf9',
      display: 'grid', placeItems: 'center',
      fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased' as const,
      userSelect: 'none' as const,
    }}>

      {/* ── Main splash content ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 40, transform: 'translateY(-12px)',
      }}>

        {/* Logo stack: mark + wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <CellrMark size={88} />
          <span style={{
            fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
            fontWeight: 600, letterSpacing: '-0.038em',
            fontSize: 30, lineHeight: 1, color: '#0f0f10',
          }}>
            Cellr
          </span>
        </div>

        {/* Loading: dots */}
        {!error && <ThreeDots />}

        {/* Error: message + retry */}
        {error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            maxWidth: 440, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: '#8a1c1c', fontWeight: 600 }}>
              Database failed to load
            </div>
            <pre style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, color: '#6b6b70',
              background: '#f7f7f5', border: '1px solid #e5e5e3',
              borderRadius: 4, padding: '8px 12px',
              textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              margin: 0, maxWidth: '100%',
            }}>
              {error}
            </pre>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  height: 32, padding: '0 16px',
                  border: '1px solid #e5e5e3', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, color: '#2a2a2c',
                  marginTop: 2,
                }}
              >
                ↻ Retry
              </button>
            )}
          </div>
        )}

        {/* Caption (loading only) */}
        {!error && (
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11, color: '#6b6b70',
            textTransform: 'uppercase', letterSpacing: '0.14em',
            lineHeight: 1,
          }}>
            Opening local database
          </span>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        position: 'fixed', bottom: 28, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 12,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10, color: '#9a9aa0',
        textTransform: 'uppercase', letterSpacing: '0.14em',
      }}>
        <span>Cellr · 0.1.0</span>
        <span style={{ color: '#d6d6d2' }}>·</span>
        <span>local database</span>
        <span style={{ color: '#d6d6d2' }}>·</span>
        <span>offline</span>
      </div>
    </div>
  );
}
