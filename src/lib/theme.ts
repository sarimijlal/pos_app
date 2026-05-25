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
  info:   'var(--c-accent)',
  infoBg: 'var(--c-accent-bg)',
  accent: 'var(--c-accent)',
  bad:      'var(--c-bad)',
  badBg:    'var(--c-bad-bg)',
  revenue:  'var(--c-revenue)',
  revenueBg:'var(--c-revenue-bg)',
  accentFg: '#ffffff',
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
