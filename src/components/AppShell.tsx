import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react';

// ── Section type (all 13 screens) ──────────────────────────────────────────
export type Section =
  | 'dashboard'
  | 'sales-new'       | 'sales-list'    | 'sales-detail'   | 'sales-return'
  | 'purchase-new'    | 'purchase-list' | 'purchase-detail' | 'purchase-return'
  | 'inventory-stock' | 'inventory-imei'
  | 'accounts-ledger'
  | 'master-parties'  | 'master-items';

// ── Topbar breadcrumb + title map ──────────────────────────────────────────
const CRUMBS: Record<Section, { crumb: string; title: string }> = {
  'dashboard':          { crumb: '',          title: 'Dashboard' },
  'sales-new':          { crumb: 'Sales',     title: 'New invoice' },
  'sales-list':         { crumb: 'Sales',     title: 'Invoices' },
  'sales-detail':       { crumb: 'Sales',     title: 'Invoice detail' },
  'sales-return':       { crumb: 'Sales',     title: 'Process return' },
  'purchase-new':       { crumb: 'Purchase',  title: 'New invoice' },
  'purchase-list':      { crumb: 'Purchase',  title: 'Invoices' },
  'purchase-detail':    { crumb: 'Purchase',  title: 'Invoice detail' },
  'purchase-return':    { crumb: 'Purchase',  title: 'Process return' },
  'inventory-stock':    { crumb: 'Inventory', title: 'Stock' },
  'inventory-imei':     { crumb: 'Inventory', title: 'IMEI lookup' },
  'accounts-ledger':    { crumb: 'Accounts',  title: 'Ledger' },
  'master-parties':     { crumb: 'Masters',   title: 'Parties' },
  'master-items':       { crumb: 'Masters',   title: 'Items' },
};

// ── Inline SVG wrapper ─────────────────────────────────────────────────────
function Ic({ size = 16, children, style }: { size?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, opacity: 0.85, ...style }}
    >
      {children}
    </svg>
  );
}

// ── KBD badge ─────────────────────────────────────────────────────────────
function Kbd({ children }: { children: string }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 10, color: 'var(--c-muted2)',
      border: '1px solid var(--c-line)', borderRadius: 3,
      padding: '0 4px', background: 'var(--c-paper)',
    }}>{children}</span>
  );
}

// ── Live clock ────────────────────────────────────────────────────────────
function useClock() {
  const snap = () => {
    const now = new Date();
    return {
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      date: now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    };
  };
  const [val, setVal] = useState(snap);
  useEffect(() => {
    const id = setInterval(() => setVal(snap()), 30_000);
    return () => clearInterval(id);
  }, []);
  return val;
}

// ── NavItem ────────────────────────────────────────────────────────────────
function NavItem({
  icon, label, count, active, collapsed, tooltip, onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  active: boolean;
  collapsed: boolean;
  tooltip: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? 9 : '7px 10px',
        width: collapsed ? 38 : undefined,
        height: collapsed ? 38 : undefined,
        borderRadius: collapsed ? 8 : 4,
        justifyContent: collapsed ? 'center' : undefined,
        background: active ? 'var(--c-nav-active)' : hovered ? 'var(--c-nav-hover)' : undefined,
        color: active ? 'var(--c-accent)' : 'var(--c-ink2)',
        fontWeight: active ? 600 : undefined,
        border: active ? '1px solid var(--c-nav-active-border)' : '1px solid transparent',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background .1s',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Active accent bar */}
      {active && (
        <span style={{
          position: 'absolute',
          left: collapsed ? -4 : -8,
          top: 6, bottom: 6,
          width: 3, background: 'var(--c-accent)', borderRadius: 2,
        }} />
      )}

      <Ic style={{ opacity: 0.85 }}>{icon}</Ic>

      {!collapsed && (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', fontSize: 13.5 }}>{label}</span>
      )}

      {!collapsed && count !== undefined && (
        <span style={{
          fontSize: 10.5, color: 'var(--c-muted)',
          fontVariantNumeric: 'tabular-nums',
          background: active ? 'var(--c-line2)' : 'var(--c-nav-active)',
          padding: '1px 6px', borderRadius: 999, flexShrink: 0,
        }}>{count}</span>
      )}

      {/* Tooltip — only when collapsed + hovered */}
      {collapsed && hovered && (
        <span style={{
          position: 'absolute',
          left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 10,
          background: 'var(--c-ink)', color: 'var(--c-bg)',
          fontSize: 11.5, padding: '5px 9px', borderRadius: 4,
          whiteSpace: 'nowrap', zIndex: 100,
          pointerEvents: 'none',
        }}>
          <span style={{
            position: 'absolute', left: -3, top: '50%',
            transform: 'translateY(-50%) rotate(45deg)',
            width: 6, height: 6, background: 'var(--c-ink)',
          }} />
          {tooltip}
        </span>
      )}
    </div>
  );
}

// ── NavGroup label ─────────────────────────────────────────────────────────
function NavLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 600, color: 'var(--c-muted2)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '4px 10px', whiteSpace: 'nowrap',
    }}>{children}</div>
  );
}

// ── Quick action button ────────────────────────────────────────────────────
function QuickAction({
  icon, label, kbd, onClick,
}: {
  icon: ReactNode;
  label: string;
  kbd?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 4,
        color: 'var(--c-ink2)', cursor: 'pointer',
        whiteSpace: 'nowrap', flexShrink: 0,
        background: hovered ? 'var(--c-subtle)' : undefined,
        transition: 'background .1s',
      }}
    >
      <Ic size={12} style={{ opacity: 0.7 }}>{icon}</Ic>
      {label}
      {kbd && <Kbd>{kbd}</Kbd>}
    </span>
  );
}

// ── CmdResultItem ──────────────────────────────────────────────────────────
function CmdResultItem({
  icon, label, kind, onClick,
}: {
  icon: ReactNode;
  label: string;
  kind: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 4,
        color: 'var(--c-ink2)', cursor: 'pointer', fontSize: 13.5,
        background: hovered ? 'var(--c-subtle)' : undefined,
        transition: 'background .1s',
      }}
    >
      <Ic size={14} style={{ opacity: 1, color: 'var(--c-muted)' }}>{icon}</Ic>
      {label}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--c-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{kind}</span>
    </div>
  );
}

// ── Stage wrapper ─────────────────────────────────────────────────────────
function Stage({ section, children }: { section: Section; children: ReactNode }) {
  const fullBleed = ['sales-new', 'purchase-new', 'sales-return', 'purchase-return'].includes(section);
  return (
    <div style={{
      flex: 1, minHeight: 0,
      padding: section === 'dashboard' ? '18px 22px 28px' : fullBleed ? 0 : 22,
      gap: section === 'dashboard' ? 18 : fullBleed ? 0 : 14,
      background: (section === 'dashboard' || fullBleed)
        ? 'var(--c-bg)'
        : `repeating-linear-gradient(45deg, transparent 0 22px, var(--c-hatch) 22px 23px)`,
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────
export function AppShell({
  section,
  onNavigate,
  canGoBack = false,
  onGoBack,
  isDark = false,
  onToggleTheme,
  children,
}: {
  section: Section;
  onNavigate: (s: Section, id?: number) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('pos_sidebar') === '1'; } catch { return false; }
  });
  const [mastersOpen, setMastersOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const clock = useClock();

  const toggleSidebar = () => {
    setExpanded(v => {
      const next = !v;
      try { localStorage.setItem('pos_sidebar', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(true); }
      if (meta && e.key === '\\') { e.preventDefault(); toggleSidebar(); }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (cmdOpen) setTimeout(() => cmdInputRef.current?.focus(), 30);
  }, [cmdOpen]);

  const collapsed = !expanded;
  const nav = (s: Section) => () => onNavigate(s);
  const { crumb, title } = CRUMBS[section];

  // ── Rail toggle hover ──────────────────────────────────────────────────
  const [railHovered, setRailHovered] = useState(false);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: expanded ? '240px 1fr' : '60px 1fr',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--c-bg)',
      color: 'var(--c-ink)',
      fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      fontSize: 14,
      lineHeight: 1.45,
      WebkitFontSmoothing: 'antialiased',
      transition: 'grid-template-columns .18s ease',
    }}>

      {/* ═══ SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside style={{
        background: 'var(--c-sidebar)',
        borderRight: '1px solid var(--c-line)',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 13.5,
        overflow: 'hidden',
      }}>

        {/* Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? '14px 8px' : '14px',
          borderBottom: '1px solid var(--c-line)',
          height: 60, flexShrink: 0,
          justifyContent: collapsed ? 'center' : undefined,
        }}>
          <svg
            width={collapsed ? 30 : 26} height={collapsed ? 30 : 26}
            viewBox="0 0 64 64" aria-label="Cellr"
            style={{ display: 'block', flexShrink: 0 }}
          >
            <rect x="4" y="4" width="56" height="56" rx="13" fill="var(--c-ink)" />
            <rect x="14" y="15.5" width="36" height="4.5" rx="2.25" fill="var(--c-sidebar)" />
          </svg>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.035em', whiteSpace: 'nowrap' }}>Cellr</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div
          className="pos-nav-scroll"
          style={{
            flex: 1, overflowY: 'auto',
            padding: collapsed ? '10px 4px' : '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 14,
            alignItems: collapsed ? 'center' : undefined,
          }}
        >
          {/* ── Dashboard ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavItem
              icon={<><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></>}
              label="Dashboard"
              active={section === 'dashboard'}
              collapsed={collapsed}
              tooltip="Dashboard"
              onClick={nav('dashboard')}
            />
          </div>

          {/* ── Sales ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavLabel collapsed={collapsed}>Sales</NavLabel>
            <NavItem
              icon={<><path d="M3 3h10v10H3z"/><path d="M3 6h10M6 3v10"/></>}
              label="New invoice"
              active={section === 'sales-new'}
              collapsed={collapsed}
              tooltip="New sale  Ctrl+N"
              onClick={nav('sales-new')}
            />
            <NavItem
              icon={<path d="M2 4h12M2 8h12M2 12h12"/>}
              label="Sales list"
              active={section === 'sales-list' || section === 'sales-detail'}
              collapsed={collapsed}
              tooltip="Sales list"
              onClick={nav('sales-list')}
            />
            <NavItem
              icon={<><path d="M3 3h10v10H3z"/><path d="M6 8l2 2 4-4"/></>}
              label="Returns"
              active={section === 'sales-return'}
              collapsed={collapsed}
              tooltip="Sales returns"
              onClick={nav('sales-return')}
            />
          </div>

          {/* ── Purchase ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavLabel collapsed={collapsed}>Purchase</NavLabel>
            <NavItem
              icon={<><path d="M3 3h10v10H3z"/><path d="M3 6h10"/></>}
              label="New invoice"
              active={section === 'purchase-new'}
              collapsed={collapsed}
              tooltip="New purchase  Ctrl+Shift+N"
              onClick={nav('purchase-new')}
            />
            <NavItem
              icon={<path d="M2 4h12M2 8h12M2 12h12"/>}
              label="Purchase list"
              active={section === 'purchase-list' || section === 'purchase-detail'}
              collapsed={collapsed}
              tooltip="Purchase list"
              onClick={nav('purchase-list')}
            />
            <NavItem
              icon={<><path d="M3 3h10v10H3z"/><path d="M5 8l2 2 4-4"/></>}
              label="Returns"
              active={section === 'purchase-return'}
              collapsed={collapsed}
              tooltip="Purchase returns"
              onClick={nav('purchase-return')}
            />
          </div>

          {/* ── Inventory ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavLabel collapsed={collapsed}>Inventory</NavLabel>
            <NavItem
              icon={<><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 7h12"/></>}
              label="Stock"
              active={section === 'inventory-stock'}
              collapsed={collapsed}
              tooltip="Stock"
              onClick={nav('inventory-stock')}
            />
            <NavItem
              icon={<><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></>}
              label="IMEI lookup"
              active={section === 'inventory-imei'}
              collapsed={collapsed}
              tooltip="IMEI lookup  Ctrl+I"
              onClick={nav('inventory-imei')}
            />
          </div>

          {/* ── Accounts ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavLabel collapsed={collapsed}>Accounts</NavLabel>
            <NavItem
              icon={<><path d="M3 3v10h10"/><path d="M5 11l3-3 2 2 3-4"/></>}
              label="Ledger"
              active={section === 'accounts-ledger'}
              collapsed={collapsed}
              tooltip="Ledger"
              onClick={nav('accounts-ledger')}
            />
          </div>

          {/* ── Masters ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: collapsed ? undefined : '100%' }}>
            <NavLabel collapsed={collapsed}>Masters</NavLabel>

            {/* Masters toggle item */}
            <MastersToggle
              open={mastersOpen}
              collapsed={collapsed}
              active={section === 'master-parties' || section === 'master-items'}
              onToggle={() => !collapsed && setMastersOpen(v => !v)}
              onCollapsedClick={nav('master-parties')}
            />

            {/* Sub-items */}
            {!collapsed && (
              <div style={{
                marginLeft: 14,
                borderLeft: '1px solid var(--c-line)',
                paddingLeft: 8,
                marginTop: 2,
                overflow: 'hidden',
                maxHeight: mastersOpen ? 160 : 0,
                transition: 'max-height .18s ease',
              }}>
                {[
                  { label: 'Suppliers & Customers', section: 'master-parties' as Section },
                  { label: 'Items', section: 'master-items' as Section },
                  { label: 'Chart of accounts', section: 'accounts-ledger' as Section },
                ].map(item => (
                  <ChildNavItem
                    key={item.section}
                    label={item.label}
                    active={section === item.section}
                    onClick={nav(item.section)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rail toggle */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleSidebar}
          onMouseEnter={() => setRailHovered(true)}
          onMouseLeave={() => setRailHovered(false)}
          style={{
            borderTop: '1px solid var(--c-line)',
            height: 36, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: railHovered ? 'var(--c-ink2)' : 'var(--c-muted)',
            background: railHovered ? 'var(--c-subtle)' : undefined,
            cursor: 'pointer', fontSize: 12, gap: 8,
            transition: 'background .1s, color .1s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform .18s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <path d="M5 3l5 5-5 5"/>
          </svg>
          {!collapsed && (
            <>
              <span>Collapse</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--c-muted)',
                border: '1px solid var(--c-line)', borderRadius: 3, padding: '0 4px', background: 'var(--c-paper)',
              }}>Ctrl\</span>
            </>
          )}
        </div>

        {/* User footer */}
        <div style={{
          borderTop: '1px solid var(--c-line)',
          padding: collapsed ? '10px 0' : '10px 12px',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: 'var(--c-muted)',
          justifyContent: collapsed ? 'center' : undefined,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--c-line2)', display: 'grid', placeItems: 'center',
            fontSize: 11, fontWeight: 600, color: 'var(--c-ink2)', flexShrink: 0,
          }}>A1</div>
          {!collapsed && (
            <>
              <div style={{ color: 'var(--c-ink2)', fontWeight: 500, lineHeight: 1.15, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                Counter 1
                <small style={{ color: 'var(--c-muted)', fontWeight: 400, display: 'block', fontSize: 11 }}>Signed in 09:14</small>
              </div>
              <div title="Sign out" style={{ color: 'var(--c-muted2)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'grid', placeItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2H3v12h3"/>
                  <path d="M9 5l3 3-3 3M12 8H6"/>
                </svg>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

        {/* Topbar */}
        <div style={{
          height: 60, flexShrink: 0,
          borderBottom: '1px solid var(--c-line)',
          display: 'flex', alignItems: 'center', padding: '0 20px',
          background: 'var(--c-paper)', gap: 16,
        }}>
          {canGoBack && (
            <button onClick={onGoBack} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 28, padding: '0 10px', borderRadius: 4,
              border: '1px solid var(--c-line)', background: 'var(--c-subtle)',
              cursor: 'pointer', fontSize: 12, color: 'var(--c-muted)',
              fontFamily: 'inherit', flexShrink: 0,
            }}>
              ← Back
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 140 }}>
            {crumb && (
              <span style={{
                fontSize: 11, color: 'var(--c-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontFamily: "'JetBrains Mono', monospace",
              }}>{crumb}</span>
            )}
            <div style={{ marginTop: crumb ? 1 : 0, fontSize: 16, fontWeight: 600, letterSpacing: -0.1 }}>{title}</div>
          </div>

          {/* Command search */}
          <CmdSearchBar onClick={() => setCmdOpen(true)} />

          {/* Theme toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                border: '1px solid var(--c-line)', background: 'var(--c-subtle)',
                cursor: 'pointer', color: 'var(--c-muted)',
              }}
            >
              {isDark ? (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3"/>
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 10A6 6 0 016 2.5a6 6 0 000 11 6 6 0 007.5-3.5z"/>
                </svg>
              )}
            </button>
          )}

          {/* Clock */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, color: 'var(--c-ink2)',
            fontVariantNumeric: 'tabular-nums',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            border: '1px solid var(--c-line)', borderRadius: 4,
            background: 'var(--c-subtle)', flexShrink: 0,
          }}>
            <span className="pos-pulse" />
            <span style={{ color: 'var(--c-muted)' }}>{clock.date}</span>
            <span style={{ fontWeight: 500 }}>{clock.time}</span>
          </div>
        </div>

        {/* Quick actions strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 14px',
          borderBottom: '1px solid var(--c-line)',
          background: 'var(--c-paper)', fontSize: 12.5, flexShrink: 0,
          overflowX: 'auto',
        }}>
          <QuickAction
            icon={<path d="M8 3v10M3 8h10"/>}
            label="New sale" kbd="Ctrl+N"
            onClick={nav('sales-new')}
          />
          <QuickAction
            icon={<><path d="M3 3h10v10H3z"/><path d="M3 6h10"/></>}
            label="New purchase" kbd="Ctrl+Shift+N"
            onClick={nav('purchase-new')}
          />
          <span style={{ width: 1, height: 14, background: 'var(--c-line)', margin: '0 4px', flexShrink: 0 }} />
          <QuickAction
            icon={<><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></>}
            label="Find IMEI" kbd="Ctrl+I"
            onClick={nav('inventory-imei')}
          />
          <QuickAction
            icon={<path d="M2 4h12M2 8h12M2 12h12"/>}
            label="Recent invoices" kbd="Ctrl+L"
            onClick={nav('sales-list')}
          />
          <span style={{ width: 1, height: 14, background: 'var(--c-line)', margin: '0 4px', flexShrink: 0 }} />
          <QuickAction
            icon={<><path d="M3 3h10v10H3z"/><path d="M6 8l2 2 4-4"/></>}
            label="Today's totals" kbd="Ctrl+T"
            onClick={nav('dashboard')}
          />
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '5px 8px' }}>
            Press <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, border: '1px solid var(--c-line2)', borderRadius: 3, padding: '0 4px', background: 'var(--c-paper)', color: 'var(--c-ink2)' }}>?</span> for all shortcuts
          </span>
        </div>

        {/* Stage — screen content renders here */}
        <Stage section={section}>{children}</Stage>
      </div>

      {/* ═══ COMMAND PALETTE ══════════════════════════════════════════════ */}
      {cmdOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCmdOpen(false); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'var(--c-overlay)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '14vh', zIndex: 200,
          }}
        >
          <div style={{
            width: 'min(620px, 92vw)',
            background: 'var(--c-paper)',
            border: '1px solid var(--c-line2)',
            borderRadius: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            overflow: 'hidden',
          }}>
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--c-line)' }}>
              <Ic size={15} style={{ opacity: 1, color: 'var(--c-muted)' }}>
                <circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>
              </Ic>
              <input
                ref={cmdInputRef}
                placeholder="Search items, IMEIs, customers, invoices… or type a command"
                style={{
                  flex: 1, border: 0, outline: 'none',
                  fontFamily: "'Inter Variable', 'Inter', sans-serif",
                  fontSize: 15, background: 'transparent', color: 'var(--c-ink)',
                }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--c-muted)', border: '1px solid var(--c-line)', borderRadius: 3, padding: '1px 5px', background: 'var(--c-subtle)' }}>Esc</span>
            </div>

            {/* Results */}
            <div style={{ padding: 6, maxHeight: 360, overflowY: 'auto' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--c-muted2)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 10px 4px' }}>Actions</div>
              <CmdResultItem icon={<path d="M8 3v10M3 8h10"/>} label="New sales invoice" kind="Ctrl+N" onClick={() => { onNavigate('sales-new'); setCmdOpen(false); }} />
              <CmdResultItem icon={<><path d="M3 3h10v10H3z"/><path d="M3 6h10"/></>} label="New purchase invoice" kind="Ctrl+Shift+N" onClick={() => { onNavigate('purchase-new'); setCmdOpen(false); }} />
              <CmdResultItem icon={<><path d="M3 3h10v10H3z"/><path d="M6 8l2 2 4-4"/></>} label="Record sales return" kind="action" onClick={() => { onNavigate('sales-return'); setCmdOpen(false); }} />

              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--c-muted2)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 10px 4px' }}>Jump to</div>
              <CmdResultItem icon={<><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></>} label="Dashboard" kind="G D" onClick={() => { onNavigate('dashboard'); setCmdOpen(false); }} />
              <CmdResultItem icon={<><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 7h12"/></>} label="Inventory · Stock" kind="G S" onClick={() => { onNavigate('inventory-stock'); setCmdOpen(false); }} />
              <CmdResultItem icon={<><path d="M3 3v10h10"/><path d="M5 11l3-3 2 2 3-4"/></>} label="Accounts · Ledger" kind="G L" onClick={() => { onNavigate('accounts-ledger'); setCmdOpen(false); }} />
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--c-line)', fontSize: 11, color: 'var(--c-muted)', background: 'var(--c-subtle)' }}>
              {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([k, l]) => (
                <span key={k}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, border: '1px solid var(--c-line2)', borderRadius: 3, padding: '0 4px', background: 'var(--c-paper)', color: 'var(--c-ink2)', marginRight: 4 }}>{k}</span>
                  {l}
                </span>
              ))}
              <span style={{ marginLeft: 'auto' }}>
                Tip: type <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>imei:</code>, <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>cust:</code>, <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>si-</code> to filter
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CmdSearchBar (extracted to avoid inline hover state pollution) ──────────
function CmdSearchBar({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, maxWidth: 620, height: 36,
        border: `1px solid ${hovered ? 'var(--c-line2)' : 'var(--c-line)'}`,
        borderRadius: 4,
        background: 'var(--c-subtle)', padding: '0 12px',
        fontSize: 13, color: 'var(--c-muted)',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'text',
        transition: 'border-color .12s',
      }}
    >
      <Ic size={13}><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></Ic>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Search items, IMEIs, customers, invoices… or type a command
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, flexShrink: 0 }}>
        {['Ctrl', 'K'].map(k => (
          <span key={k} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--c-ink2)', border: '1px solid var(--c-line2)', borderRadius: 3, padding: '1px 5px', background: 'var(--c-paper)' }}>{k}</span>
        ))}
      </div>
    </div>
  );
}

// ── MastersToggle ──────────────────────────────────────────────────────────
function MastersToggle({
  open, collapsed, active, onToggle, onCollapsedClick,
}: {
  open: boolean;
  collapsed: boolean;
  active: boolean;
  onToggle: () => void;
  onCollapsedClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={collapsed ? onCollapsedClick : onToggle}
      onKeyDown={e => e.key === 'Enter' && (collapsed ? onCollapsedClick() : onToggle())}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
        padding: collapsed ? 9 : '7px 10px',
        width: collapsed ? 38 : undefined,
        height: collapsed ? 38 : undefined,
        borderRadius: collapsed ? 8 : 4,
        justifyContent: collapsed ? 'center' : undefined,
        background: active ? 'var(--c-nav-active)' : hovered ? 'var(--c-nav-hover)' : undefined,
        color: active ? 'var(--c-accent)' : 'var(--c-ink2)',
        fontWeight: active ? 600 : undefined,
        border: active ? '1px solid var(--c-nav-active-border)' : '1px solid transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background .1s',
        whiteSpace: 'nowrap',
      }}
    >
      {active && (
        <span style={{
          position: 'absolute',
          left: collapsed ? -4 : -8,
          top: 6, bottom: 6,
          width: 3, background: 'var(--c-accent)', borderRadius: 2,
        }} />
      )}
      <Ic style={{ opacity: 0.85 }}>
        <path d="M2 12V4l6-2 6 2v8l-6 2-6-2z"/>
        <path d="M2 4l6 2 6-2M8 6v8"/>
      </Ic>
      {!collapsed && (
        <>
          <span style={{ flex: 1, fontSize: 13.5 }}>Master data</span>
          <span style={{
            fontSize: 9, color: 'var(--c-muted)', flexShrink: 0,
            display: 'inline-block',
            transition: 'transform .15s',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}>▾</span>
        </>
      )}
      {/* Tooltip when collapsed */}
      {collapsed && hovered && (
        <span style={{
          position: 'absolute',
          left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 10,
          background: 'var(--c-ink)', color: 'var(--c-bg)',
          fontSize: 11.5, padding: '5px 9px', borderRadius: 4,
          whiteSpace: 'nowrap', zIndex: 100,
          pointerEvents: 'none',
        }}>
          <span style={{ position: 'absolute', left: -3, top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: 6, height: 6, background: 'var(--c-ink)' }} />
          Master data
        </span>
      )}
    </div>
  );
}

// ── ChildNavItem ────────────────────────────────────────────────────────────
function ChildNavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer', userSelect: 'none',
        borderRadius: 4, padding: '5px 8px',
        fontSize: 13,
        color: active ? 'var(--c-ink)' : hovered ? 'var(--c-ink2)' : 'var(--c-muted)',
        fontWeight: active ? 500 : undefined,
        transition: 'color .1s',
      }}
    >{label}</div>
  );
}
