import { useState, useEffect } from 'react';

export type Scheme = 'cool' | 'neutral' | 'warm';

export const ACCENTS: Record<string, { light: string; dark: string; label: string }> = {
  slate:  { light: '#1f3a8a', dark: '#4d72d4', label: 'Slate' },
  ink:    { light: '#0f0f10', dark: '#737373', label: 'Ink' },
  forest: { light: '#1f6b3a', dark: '#3daa68', label: 'Forest' },
  plum:   { light: '#5a1f6b', dark: '#9a4db4', label: 'Plum' },
  burnt:  { light: '#8a3a1f', dark: '#c4714a', label: 'Burnt' },
};

function applyAccent(key: string) {
  const acc = ACCENTS[key] ?? ACCENTS.slate;
  document.documentElement.style.setProperty('--c-accent-light', acc.light);
  document.documentElement.style.setProperty('--c-accent-dark', acc.dark);
}

// ── Shared color palette (CSS variable references) ─────────────────────────
export const C = {
  ink:    'var(--c-ink)',
  ink2:   'var(--c-ink2)',
  muted:  'var(--c-muted)',
  muted2: 'var(--c-muted2)',
  line:   'var(--c-line)',
  line2:  'var(--c-line2)',
  paper:  'var(--c-paper)',
  bg:     'var(--c-bg)',
  subtle: 'var(--c-subtle)',
  ok:     'var(--c-ok)',
  okBg:   'var(--c-ok-bg)',
  warn:   'var(--c-warn)',
  warnBg: 'var(--c-warn-bg)',
  accent: 'var(--c-accent)',
  bad:      'var(--c-bad)',
  badBg:    'var(--c-bad-bg)',
  revenue:  'var(--c-revenue)',
  revenueBg:'var(--c-revenue-bg)',
  accentFg: '#ffffff',

  subtle2:      'var(--c-subtle2)',
  line3:        'var(--c-line3)',
  info:         'var(--c-info)',
  infoBg:       'var(--c-info-bg)',
  infoBorder:   'var(--c-info-border)',
  okBorder:     'var(--c-ok-border)',
  warnBorder:   'var(--c-warn-border)',
  badBorder:    'var(--c-bad-border)',
  accentBorder: 'var(--c-accent-border)',
  shadow1:      'var(--c-shadow-1)',
  shadow2:      'var(--c-shadow-2)',
  shadow3:      'var(--c-shadow-3)',
} as const;

// ── Theme hook ─────────────────────────────────────────────────────────────
export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pos_theme');
      return saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });

  const [scheme, setSchemeState] = useState<Scheme>(() => {
    try { return (localStorage.getItem('pos_scheme') as Scheme) ?? 'cool'; } catch { return 'cool'; }
  });

  const [accentKey, setAccentKeyState] = useState<string>(() => {
    try { return localStorage.getItem('pos_accent') ?? 'slate'; } catch { return 'slate'; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('pos_theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  useEffect(() => {
    document.documentElement.dataset.scheme = scheme;
    try { localStorage.setItem('pos_scheme', scheme); } catch {}
  }, [scheme]);

  useEffect(() => {
    applyAccent(accentKey);
    try { localStorage.setItem('pos_accent', accentKey); } catch {}
  }, [accentKey]);

  const setScheme = (s: Scheme) => setSchemeState(s);
  const setAccent = (key: string) => setAccentKeyState(key);

  return {
    isDark,
    toggle: () => setIsDark(d => !d),
    scheme,
    setScheme,
    accentKey,
    setAccent,
  };
}
