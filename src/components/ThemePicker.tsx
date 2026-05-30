import { useState, useRef, useEffect } from 'react';
import { ACCENTS, type Scheme } from '../lib/theme';

const SCHEMES: { key: Scheme; label: string; lightBg: string; darkBg: string }[] = [
  { key: 'cool',    label: 'Cool',    lightBg: '#dde2e9', darkBg: '#0a0c11' },
  { key: 'neutral', label: 'Neutral', lightBg: '#e4e4e5', darkBg: '#0d0d0e' },
  { key: 'warm',    label: 'Warm',    lightBg: '#e7e3da', darkBg: '#100e0a' },
];

export function ThemePicker({
  isDark,
  scheme,
  accentKey,
  onToggleDark,
  onSetScheme,
  onSetAccent,
}: {
  isDark: boolean;
  scheme: Scheme;
  accentKey: string;
  onToggleDark: () => void;
  onSetScheme: (s: Scheme) => void;
  onSetAccent: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const currentScheme = SCHEMES.find(s => s.key === scheme) ?? SCHEMES[0];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>

      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Theme"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 32, padding: '0 10px', borderRadius: 4,
          border: '1px solid var(--c-line)',
          background: open ? 'var(--c-subtle2)' : 'var(--c-subtle)',
          cursor: 'pointer', color: 'var(--c-ink2)', fontFamily: 'inherit',
          transition: 'background .1s',
        }}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--c-muted)' }}>
          {isDark ? 'Dark' : 'Light'} · {currentScheme.label}
        </span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 228,
          background: 'var(--c-paper)',
          border: '1px solid var(--c-line2)',
          borderRadius: 8,
          boxShadow: 'var(--c-shadow-3)',
          zIndex: 300,
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {/* Mode */}
          <Section label="Mode">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['light', 'dark'] as const).map(mode => {
                const active = (mode === 'dark') === isDark;
                return (
                  <button
                    key={mode}
                    onClick={() => { if (!active) onToggleDark(); }}
                    style={{
                      flex: 1, height: 30, borderRadius: 4, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12.5,
                      border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-line)'}`,
                      background: active ? 'var(--c-accent-bg)' : 'var(--c-subtle)',
                      color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                      fontWeight: active ? 600 : 400,
                      transition: 'all .1s',
                    }}
                  >
                    {mode === 'light' ? '☀ Light' : '☾ Dark'}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Temperature */}
          <Section label="Temperature">
            <div style={{ display: 'flex', gap: 6 }}>
              {SCHEMES.map(s => {
                const active = scheme === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => onSetScheme(s.key)}
                    title={s.label}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '8px 4px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-line)'}`,
                      background: active ? 'var(--c-accent-bg)' : 'var(--c-subtle)',
                      transition: 'all .1s',
                    }}
                  >
                    <div style={{
                      width: 30, height: 18, borderRadius: 3,
                      background: isDark ? s.darkBg : s.lightBg,
                      border: '1px solid var(--c-line)',
                    }} />
                    <span style={{
                      fontSize: 11,
                      color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                      fontWeight: active ? 600 : 400,
                    }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Accent */}
          <Section label="Accent">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {Object.entries(ACCENTS).map(([key, val]) => {
                const active = accentKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSetAccent(key)}
                    title={val.label}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isDark ? val.dark : val.light,
                      border: `2px solid ${active ? 'var(--c-ink)' : 'transparent'}`,
                      outline: active ? `2px solid ${isDark ? val.dark : val.light}` : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer', padding: 0,
                      transition: 'outline .12s, border-color .12s',
                    }}
                  />
                );
              })}
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--c-muted2)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{label}</div>
      {children}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 10A6 6 0 016 2.5a6 6 0 000 11 6 6 0 007.5-3.5z"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M3 6l5 5 5-5"/>
    </svg>
  );
}
