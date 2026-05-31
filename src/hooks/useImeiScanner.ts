import { useEffect, useRef } from 'react';

// Detects barcode scanner input (fast burst of digits + Enter) on document,
// but only when no input/textarea has focus (those handle it natively via Pattern A).
export function useImeiScanner(onScan: (imei: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buf = '';
    let lastKeyTime = 0;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const now = Date.now();
      if (now - lastKeyTime > 100) buf = '';
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (/^\d{15}$/.test(buf)) cb.current(buf);
        buf = '';
        return;
      }

      if (e.key.length === 1 && /\d/.test(e.key)) buf += e.key;
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}
