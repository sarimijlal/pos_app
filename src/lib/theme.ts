import { useState, useEffect } from 'react';

// ── Shared color palette (CSS variable references) ─────────────────────────
// Used by all screens as `import { C } from '@/lib/theme'`
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
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d) };
}
