import { useState, useEffect, useRef, useCallback } from 'react';
import type { AccountRow, InsertAccountInput } from '../types';
import { getAccounts, insertAccount, postGeneralEntry } from '../../../db/repositories/accounting';
import { C } from '../../../lib/theme';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

const TYPE_META: Record<AccountType, { label: string; color: string; bg: string; border: string; swatch: string }> = {
  asset:     { label: 'Asset',     color: 'var(--c-ok)',      bg: 'var(--c-ok-bg)',      border: 'var(--c-ok-border)',      swatch: 'var(--c-ok)' },
  liability: { label: 'Liability', color: 'var(--c-accent)',  bg: 'var(--c-accent-bg)',  border: 'var(--c-accent-border)',  swatch: 'var(--c-accent)' },
  equity:    { label: 'Equity',    color: 'var(--c-muted)',   bg: 'var(--c-subtle)',     border: 'var(--c-line2)',          swatch: 'var(--c-muted)' },
  revenue:   { label: 'Revenue',   color: 'var(--c-revenue)', bg: 'var(--c-revenue-bg)', border: 'var(--c-revenue-border)', swatch: 'var(--c-revenue)' },
  expense:   { label: 'Expense',   color: 'var(--c-warn)',    bg: 'var(--c-warn-bg)',    border: 'var(--c-warn-border)',    swatch: 'var(--c-warn)' },
};

const ALL_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

function TypePill({ type }: { type: string }) {
  const meta = TYPE_META[type as AccountType];
  if (!meta) return <span style={{ fontSize: 11, color: C.muted }}>{type}</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 18,
      padding: '0 8px', borderRadius: 999,
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
    }}>
      {meta.label}
    </span>
  );
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TreeRow = { account: AccountRow; isGroup: boolean; isLastChild: boolean };

function buildTree(accounts: AccountRow[], query: string): TreeRow[] {
  const q = query.trim().toLowerCase();
  const idMap = new Map(accounts.map(a => [a.id, a]));
  const topLevel = accounts.filter(a => a.parent_id === null);
  const childrenOf = (id: number) => accounts.filter(a => a.parent_id === id);

  function matches(a: AccountRow) {
    if (!q) return true;
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  }

  const result: TreeRow[] = [];
  for (const parent of topLevel) {
    const kids = childrenOf(parent.id);
    if (q && !matches(parent) && !kids.some(matches)) continue;
    result.push({ account: parent, isGroup: true, isLastChild: false });
    const visibleKids = q ? kids.filter(k => matches(k) || matches(parent)) : kids;
    visibleKids.forEach((kid, i) => {
      result.push({ account: kid, isGroup: false, isLastChild: i === visibleKids.length - 1 });
    });
  }
  // Accounts with no matching top-level parent (e.g. orphan sub-accounts not caught above)
  if (!q) {
    const rendered = new Set(result.map(r => r.account.id));
    accounts
      .filter(a => !rendered.has(a.id) && a.parent_id !== null && !idMap.has(a.parent_id!))
      .forEach(a => result.push({ account: a, isGroup: false, isLastChild: true }));
  }
  return result;
}

const CREDIT_NORMAL = new Set(['liability', 'equity', 'revenue']);

function BalanceCell({ balance, isGroup, type }: { balance: number; isGroup: boolean; type: string }) {
  // Credit-normal accounts (liability, equity, revenue) live on the credit side.
  // Their raw ledger balance is negative (credit > debit). Flip the sign so they
  // display as positive, matching how every financial report presents them.
  const displayBalance = CREDIT_NORMAL.has(type) ? -balance : balance;

  if (displayBalance === 0) {
    return (
      <td style={{ padding: '11px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: C.muted2 }}>
        —
      </td>
    );
  }

  // Positive display = balance is on the expected side = normal (dark ink).
  // Negative display = balance crossed to the unexpected side = unusual (muted).
  const isNormal = displayBalance > 0;

  return (
    <td style={{
      padding: '11px 14px', borderBottom: `1px solid ${C.line}`, textAlign: 'right',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
      color: isNormal ? C.ink : C.muted,
      fontWeight: isGroup ? 600 : 400,
    }}>
      <span style={{ color: C.muted2, marginRight: 3 }}>₨</span>
      {!isNormal ? '−' : ''}{fmt(displayBalance)}
    </td>
  );
}

function AccountTableRow({
  row,
  idx,
  idMap,
}: {
  row: TreeRow;
  idx: number;
  idMap: Map<number, AccountRow>;
}) {
  const [hovered, setHovered] = useState(false);
  const { account: a, isGroup } = row;
  const isInactive = a.is_active === 0;

  const parentName = a.parent_id != null
    ? (() => { const p = idMap.get(a.parent_id!); return p ? `${p.code} · ${p.name}` : `#${a.parent_id}`; })()
    : null;

  const rowBg = isGroup
    ? (hovered ? 'var(--c-subtle)' : 'var(--c-sidebar)')
    : (hovered ? 'var(--c-subtle)' : (idx % 2 === 0 ? C.paper : 'var(--c-sidebar))'));

  const cellBase: React.CSSProperties = {
    padding: '11px 14px', borderBottom: `1px solid ${C.line}`,
    background: rowBg, transition: 'background 80ms',
  };

  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Code */}
      <td style={{ ...cellBase, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, letterSpacing: '0.02em', color: isGroup ? C.ink : C.ink2, fontWeight: isGroup ? 600 : 400 }}>
        {a.code}
      </td>

      {/* Name */}
      <td style={{ ...cellBase, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isGroup && (
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 10, flexShrink: 0 }}>
              <span style={{
                display: 'inline-block',
                width: 1, height: 20, background: C.line2,
                marginRight: 0,
              }} />
              <span style={{ display: 'inline-block', width: 8, height: 1, background: C.line2 }} />
            </span>
          )}
          <span style={{ fontWeight: isGroup ? 600 : 400, color: isInactive ? C.muted : C.ink }}>
            {a.name}
          </span>
        </div>
      </td>

      {/* Type */}
      <td style={cellBase}>
        <TypePill type={a.type} />
      </td>

      {/* Parent */}
      <td style={{ ...cellBase, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.muted }}>
        {parentName ?? <span style={{ color: C.muted2 }}>— top-level —</span>}
      </td>

      {/* Balance */}
      <BalanceCell balance={a.balance} isGroup={isGroup} type={a.type} />

      {/* Status */}
      <td style={cellBase}>
        {isInactive && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 18, padding: '0 7px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 500,
            color: C.muted, background: 'var(--c-nav-active)', border: `1px solid ${C.line2}`,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.muted2, display: 'inline-block' }} />
            Inactive
          </span>
        )}
      </td>
    </tr>
  );
}

export function ChartOfAccountsScreen() {
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState('');

  // Add Account panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<AccountType>('asset');
  const [fParentId, setFParentId] = useState<number | ''>('');
  const [codeErr, setCodeErr] = useState('');
  const [nameErr, setNameErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Post Journal Entry panel state
  const [jePanelOpen, setJePanelOpen] = useState(false);
  const [jeDate, setJeDate] = useState('');
  const [jeNarration, setJeNarration] = useState('');
  const [jeDebitId, setJeDebitId] = useState<number | ''>('');
  const [jeCreditId, setJeCreditId] = useState<number | ''>('');
  const [jeAmount, setJeAmount] = useState('');
  const [jeAmountErr, setJeAmountErr] = useState('');
  const [jeSaving, setJeSaving] = useState(false);
  const [jeSaveErr, setJeSaveErr] = useState('');
  const jeAmountRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoadState('loading');
    try {
      const data = await getAccounts();
      setAccounts(data);
      setLoadState('success');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Roll up child balances into parent rows — handles 3-level hierarchy
  // (e.g. Assets → Accounts Receivable → CUS-001). A simple one-pass approach
  // only catches top-level parents; recursive memoisation handles any depth.
  const accountsWithRollup: AccountRow[] = (() => {
    const childrenOf = new Map<number, number[]>();
    accounts.forEach(a => {
      if (a.parent_id !== null) {
        const kids = childrenOf.get(a.parent_id) ?? [];
        kids.push(a.id);
        childrenOf.set(a.parent_id, kids);
      }
    });
    const ownBalance = new Map<number, number>(accounts.map(a => [a.id, a.balance]));
    const memo = new Map<number, number>();
    function rolled(id: number): number {
      if (memo.has(id)) return memo.get(id)!;
      const kids = childrenOf.get(id);
      const val = kids && kids.length > 0
        ? kids.reduce((s, kid) => s + rolled(kid), 0)
        : (ownBalance.get(id) ?? 0);
      memo.set(id, val);
      return val;
    }
    return accounts.map(a => ({ ...a, balance: rolled(a.id) }));
  })();

  const idMap = new Map(accountsWithRollup.map(a => [a.id, a]));
  const treeRows = buildTree(accountsWithRollup, search);

  const topLevelCount = accounts.filter(a => a.parent_id === null).length;
  const subCount = accounts.filter(a => a.parent_id !== null).length;
  const activeCount = accounts.filter(a => a.is_active === 1).length;

  // Footer totals — use leaf accounts only to avoid double-counting rolled-up parent rows.
  // Apply same sign-flip as BalanceCell so totals match what's displayed.
  const leafAccounts = accounts.filter(a => !accounts.some(c => c.parent_id === a.id));
  const displayBal = (a: AccountRow) => CREDIT_NORMAL.has(a.type) ? -a.balance : a.balance;
  const totalAssets  = leafAccounts.filter(a => a.type === 'asset').reduce((s, a) => s + Math.max(0, displayBal(a)), 0);
  const totalLiab    = leafAccounts.filter(a => a.type === 'liability').reduce((s, a) => s + Math.max(0, displayBal(a)), 0);
  const totalRevenue = leafAccounts.filter(a => a.type === 'revenue').reduce((s, a) => s + Math.max(0, displayBal(a)), 0);

  // Code uniqueness check
  const codeSet = new Set(accounts.map(a => a.code.toLowerCase()));
  function validateCode(code: string): string {
    if (!code.trim()) return '';
    if (codeSet.has(code.trim().toLowerCase())) {
      const existing = accounts.find(a => a.code.toLowerCase() === code.trim().toLowerCase());
      return `Code ${code.trim()} already exists${existing ? ` (${existing.name})` : ''}.`;
    }
    return '';
  }

  function openPanel() {
    setFCode(''); setFName(''); setFType('asset'); setFParentId('');
    setCodeErr(''); setNameErr(false); setSaveErr('');
    setPanelOpen(true);
    setTimeout(() => codeRef.current?.focus(), 200);
  }

  async function handleSave() {
    const code = fCode.trim();
    const name = fName.trim();
    let ok = true;
    const ce = validateCode(code);
    if (!code || ce) { setCodeErr(ce || 'Code is required.'); ok = false; }
    if (!name) { setNameErr(true); ok = false; }
    if (!ok) {
      if (!code) { codeRef.current?.focus(); } else if (!name) { nameRef.current?.focus(); }
      return;
    }
    setSaving(true); setSaveErr('');
    try {
      const input: InsertAccountInput = {
        code,
        name,
        account_type: fType,
        parent_id: fParentId !== '' ? (fParentId as number) : undefined,
      };
      await insertAccount(input);
      setPanelOpen(false);
      await loadAll();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function openJePanel() {
    const today = new Date().toISOString().split('T')[0];
    const cashAcct = accounts.find(a => a.code === '1001');
    const equityAcct = accounts.find(a => a.code === '3001');
    setJeDate(today);
    setJeNarration('Opening balance');
    setJeDebitId(cashAcct?.id ?? '');
    setJeCreditId(equityAcct?.id ?? '');
    setJeAmount('');
    setJeAmountErr(''); setJeSaveErr('');
    setJePanelOpen(true);
    setTimeout(() => jeAmountRef.current?.focus(), 200);
  }

  async function handlePostEntry() {
    const amount = parseFloat(jeAmount);
    if (!jeAmount || isNaN(amount) || amount <= 0) {
      setJeAmountErr('Enter a valid amount greater than zero.');
      jeAmountRef.current?.focus();
      return;
    }
    if (jeDebitId === '' || jeCreditId === '') {
      setJeSaveErr('Both debit and credit accounts are required.');
      return;
    }
    if (jeDebitId === jeCreditId) {
      setJeSaveErr('Debit and credit accounts must be different.');
      return;
    }
    setJeSaving(true); setJeSaveErr('');
    try {
      await postGeneralEntry({
        date: jeDate,
        narration: jeNarration.trim() || 'General entry',
        lines: [
          { account_id: jeDebitId as number,  debit: amount, credit: 0 },
          { account_id: jeCreditId as number, debit: 0,      credit: amount },
        ],
      });
      setJePanelOpen(false);
      await loadAll();
    } catch (e) {
      setJeSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setJeSaving(false);
    }
  }

  // Live preview values
  const pvCode = fCode.trim() || '----';
  const pvName = fName.trim() || 'New account';
  const pvParent = fParentId !== ''
    ? (() => { const p = idMap.get(fParentId as number); return p ? `Under ${p.code} · ${p.name}` : 'Unknown'; })()
    : 'Top-level';

  const th: React.CSSProperties = {
    padding: '10px 14px', background: 'var(--c-subtle)',
    borderBottom: `1px solid ${C.line}`,
    fontSize: 10.5, fontWeight: 600, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    whiteSpace: 'nowrap', textAlign: 'left',
  };

  if (loadState === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
        Loading accounts…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ color: C.bad, fontSize: 13 }}>{errorMsg || 'Failed to load accounts.'}</span>
        <button onClick={loadAll} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 5, border: `1px solid ${C.line}`, background: 'var(--c-subtle)', color: C.ink, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 14, padding: '2px 0' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: C.ink, lineHeight: 1.1 }}>
              Chart of accounts
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: C.muted, maxWidth: '64ch' }}>
              All financial accounts. Business logic resolves accounts by{' '}
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, background: 'var(--c-subtle)', border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 4px', color: C.ink2 }}>
                code
              </code>
              {' '}. Codes must be unique and stable. Supplier and customer accounts are auto-created on insert.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.muted, flexShrink: 0 }}>
            <span>FY <strong style={{ color: C.ink2, fontWeight: 500 }}>2026</strong></span>
          </div>
        </div>

        {/* Toolbar + table */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 14px',
            background: C.paper,
            border: `1px solid ${C.line}`, borderBottom: 0,
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
          }}>
            {/* Count badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.ink2 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink,
                background: 'var(--c-subtle)', border: `1px solid ${C.line}`,
                borderRadius: 3, padding: '1px 7px', fontWeight: 500,
              }}>
                {search ? treeRows.length : accounts.length}
              </span>
              <span>accounts</span>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={C.muted2} strokeWidth="1.7" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5"/><path d="M10 10l3 3"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by code or name…"
                style={{
                  width: '100%', height: 30, padding: '0 10px 0 28px',
                  background: 'var(--c-subtle)', border: `1px solid ${C.line}`,
                  borderRadius: 4, fontSize: 13, color: C.ink, outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms, box-shadow 120ms, background 120ms',
                }}
                className="sf-input"
              />
            </div>

            <span style={{ fontSize: 12, color: C.muted }}>
              <strong style={{ color: C.ink2, fontWeight: 500 }}>{activeCount}</strong> active
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={openJePanel}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  height: 30, padding: '0 12px', borderRadius: 4,
                  border: `1px solid ${C.line2}`, background: C.paper, color: C.ink2,
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12M2 8h8M2 12h5"/><path d="M12 10v4M10 12h4"/>
                </svg>
                Post entry
              </button>
              <button
                onClick={openPanel}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  height: 30, padding: '0 12px', borderRadius: 4, border: 'none',
                  background: C.accent, color: C.accentFg,
                  fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 1v10M1 6h10"/>
                </svg>
                Add account
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={th}>Code</th>
                  <th style={th}>Name</th>
                  <th style={th}>Type</th>
                  <th style={th}>Parent</th>
                  <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {treeRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '30px 14px', textAlign: 'center', color: C.muted2, fontSize: 12.5 }}>
                      No accounts match your filter.
                    </td>
                  </tr>
                ) : treeRows.map((row, i) => (
                  <AccountTableRow key={row.account.id} row={row} idx={i} idMap={idMap} />
                ))}
              </tbody>
            </table>

            {/* Table footer */}
            <div style={{
              padding: '9px 14px',
              borderTop: `1px solid ${C.line}`,
              background: 'var(--c-sidebar)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11.5, color: C.muted,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {topLevelCount} top-level · {subCount} sub-accounts
              </span>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 3, background: 'var(--c-ok)', borderRadius: 1 }} />
                  Assets
                  <strong style={{ color: C.ink2, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                    ₨ {totalAssets.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </strong>
                </span>
                <span style={{ width: 1, height: 12, background: C.line }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 3, background: 'var(--c-accent)', borderRadius: 1 }} />
                  Liabilities
                  <strong style={{ color: C.ink2, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                    ₨ {totalLiab.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </strong>
                </span>
                <span style={{ width: 1, height: 12, background: C.line }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 3, background: 'var(--c-revenue)', borderRadius: 1 }} />
                  Revenue
                  <strong style={{ color: C.ink2, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                    ₨ {totalRevenue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {panelOpen && (
        <div
          onClick={() => !saving && setPanelOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--c-overlay)', zIndex: 40 }}
        />
      )}

      {/* Add Account side panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
        background: C.paper, borderLeft: `1px solid ${C.line2}`,
        boxShadow: '-8px 0 24px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', zIndex: 50,
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms cubic-bezier(0.2,0.7,0.2,1)',
      }}>
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Add account</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>Create a new ledger account.</div>
          </div>
          <button
            onClick={() => !saving && setPanelOpen(false)}
            style={{
              width: 26, height: 26, borderRadius: 4, border: 'none',
              background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
              color: C.muted,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Code */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2, display: 'flex', alignItems: 'center', gap: 4 }}>
              Code <span style={{ color: C.bad, fontWeight: 600 }}>*</span>
            </label>
            <input
              ref={codeRef}
              value={fCode}
              onChange={e => {
                setFCode(e.target.value);
                setCodeErr(validateCode(e.target.value));
              }}
              onKeyDown={e => { if (e.key === 'Enter') nameRef.current?.focus(); }}
              placeholder="e.g. 1005"
              inputMode="numeric"
              autoComplete="off"
              style={{
                height: 34, padding: '0 11px', background: C.paper,
                border: `1px solid ${codeErr ? C.bad : C.line2}`, borderRadius: 4,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
                color: C.ink, outline: 'none', letterSpacing: '0.02em',
                boxShadow: codeErr ? '0 0 0 3px var(--c-bad-bg)' : undefined,
                transition: 'border-color 120ms, box-shadow 120ms',
              }}
            />
            {codeErr ? (
              <div style={{ fontSize: 11.5, color: C.bad, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-grid', placeItems: 'center', width: 12, height: 12, borderRadius: '50%', background: C.bad, color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>!</span>
                {codeErr}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.muted }}>4-digit code. Used as the stable reference in business logic.</div>
            )}
          </div>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2, display: 'flex', alignItems: 'center', gap: 4 }}>
              Name <span style={{ color: C.bad, fontWeight: 600 }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={fName}
              onChange={e => { setFName(e.target.value); if (nameErr) setNameErr(false); }}
              placeholder="e.g. Petty Cash"
              autoComplete="off"
              style={{
                height: 34, padding: '0 11px', background: C.paper,
                border: `1px solid ${nameErr ? C.bad : C.line2}`, borderRadius: 4,
                fontSize: 13, color: C.ink, outline: 'none',
                boxShadow: nameErr ? '0 0 0 3px var(--c-bad-bg)' : undefined,
                transition: 'border-color 120ms, box-shadow 120ms',
              }}
            />
            {nameErr && <div style={{ fontSize: 11.5, color: C.bad }}>Name is required.</div>}
          </div>

          {/* Type picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2 }}>
              Type <span style={{ color: C.bad, fontWeight: 600 }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {ALL_TYPES.map(t => {
                const meta = TYPE_META[t];
                const active = fType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setFType(t)}
                    style={{
                      border: active ? `1px solid ${C.accent}` : `1px solid ${C.line2}`,
                      borderRadius: 4,
                      background: active ? `color-mix(in srgb, var(--c-accent) 5%, ${C.paper})` : C.paper,
                      padding: '7px 4px 6px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      boxShadow: active ? `inset 0 0 0 1px ${C.accent}` : 'none',
                      transition: 'border-color 120ms, background 120ms',
                    }}
                  >
                    <span style={{ width: 18, height: 4, borderRadius: 2, background: meta.swatch, display: 'block' }} />
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: active ? C.ink : C.ink2 }}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              Determines whether positive balances are debit-normal (asset, expense) or credit-normal (liability, equity, revenue).
            </div>
          </div>

          {/* Parent account */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2, display: 'flex', alignItems: 'center', gap: 4 }}>
              Parent account
              <span style={{ color: C.muted2, fontWeight: 400, fontSize: 11, marginLeft: 4 }}>· optional</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={fParentId}
                onChange={e => setFParentId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{
                  width: '100%', height: 34, padding: '0 26px 0 11px',
                  appearance: 'none', background: C.paper,
                  border: `1px solid ${C.line2}`, borderRadius: 4,
                  fontSize: 13, color: C.ink, outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">— none (top-level) —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: C.muted, pointerEvents: 'none' }}>▾</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>Leave empty to create a top-level group.</div>
          </div>

          {/* Preview */}
          <div style={{
            border: `1px dashed ${C.line2}`, borderRadius: 4, padding: '10px 12px',
            background: 'var(--c-subtle)', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: C.ink }}>{pvCode}</span>
              <span style={{ flex: 1, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pvName}</span>
              <TypePill type={fType} />
            </div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{pvParent}</div>
          </div>

          {saveErr && (
            <div style={{ padding: '8px 12px', borderRadius: 4, background: 'var(--c-bad-bg)', color: C.bad, fontSize: 12 }}>
              {saveErr}
            </div>
          )}
        </div>

        {/* Panel footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${C.line}`,
          background: 'var(--c-sidebar)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ border: `1px solid ${C.line2}`, borderRadius: 3, padding: '0 4px', background: C.paper, marginRight: 2 }}>Ctrl</span>
            <span style={{ border: `1px solid ${C.line2}`, borderRadius: 3, padding: '0 4px', background: C.paper, marginRight: 3 }}>↵</span>
            save
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => !saving && setPanelOpen(false)}
            style={{
              height: 30, padding: '0 12px', borderRadius: 4,
              border: `1px solid ${C.line2}`, background: C.paper, color: C.ink,
              fontSize: 12.5, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 30, padding: '0 14px', borderRadius: 4, border: 'none',
              background: C.accent, color: C.accentFg,
              fontSize: 12.5, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save account'}
          </button>
        </div>
      </aside>

      {/* Journal Entry overlay */}
      {jePanelOpen && (
        <div
          onClick={() => !jeSaving && setJePanelOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--c-overlay)', zIndex: 40 }}
        />
      )}

      {/* Post Journal Entry panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: C.paper, borderLeft: `1px solid ${C.line2}`,
        boxShadow: '-8px 0 24px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', zIndex: 50,
        transform: jePanelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 220ms cubic-bezier(0.2,0.7,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Post Journal Entry</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>One debit, one credit — must balance.</div>
          </div>
          <button
            onClick={() => !jeSaving && setJePanelOpen(false)}
            style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: C.muted }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Helper callout */}
          <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--c-accent-bg)', border: `1px solid var(--c-accent-border)`, fontSize: 12, color: C.accent, lineHeight: 1.5 }}>
            <strong>Opening balance tip:</strong> To add opening cash, DR <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>1001 Cash</code> and CR <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>3001 Owner's Equity</code> for the amount you started with.
          </div>

          {/* Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2 }}>
              Date <span style={{ color: C.bad, fontWeight: 600 }}>*</span>
            </label>
            <input
              type="date"
              value={jeDate}
              onChange={e => setJeDate(e.target.value)}
              style={{
                height: 34, padding: '0 11px', background: C.paper,
                border: `1px solid ${C.line2}`, borderRadius: 4,
                fontSize: 13, color: C.ink, outline: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          {/* Narration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2 }}>Narration</label>
            <input
              value={jeNarration}
              onChange={e => setJeNarration(e.target.value)}
              placeholder="e.g. Opening balance"
              style={{
                height: 34, padding: '0 11px', background: C.paper,
                border: `1px solid ${C.line2}`, borderRadius: 4,
                fontSize: 13, color: C.ink, outline: 'none',
              }}
            />
          </div>

          {/* Amount */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2 }}>
              Amount <span style={{ color: C.bad, fontWeight: 600 }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.muted, pointerEvents: 'none' }}>₨</span>
              <input
                ref={jeAmountRef}
                type="number"
                min="0"
                step="0.01"
                value={jeAmount}
                onChange={e => { setJeAmount(e.target.value); if (jeAmountErr) setJeAmountErr(''); }}
                placeholder="0.00"
                style={{
                  width: '100%', height: 34, padding: '0 11px 0 26px', background: C.paper,
                  border: `1px solid ${jeAmountErr ? C.bad : C.line2}`, borderRadius: 4,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.ink, outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: jeAmountErr ? '0 0 0 3px var(--c-bad-bg)' : undefined,
                }}
              />
            </div>
            {jeAmountErr && <div style={{ fontSize: 11.5, color: C.bad }}>{jeAmountErr}</div>}
          </div>

          {/* Debit / Credit accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Debit row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 28, padding: '1px 6px', borderRadius: 3, background: 'var(--c-ok-bg)', color: 'var(--c-ok)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>DR</span>
                Debit account
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={jeDebitId}
                  onChange={e => setJeDebitId(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{
                    width: '100%', height: 34, padding: '0 26px 0 11px', appearance: 'none',
                    background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4,
                    fontSize: 13, color: jeDebitId === '' ? C.muted2 : C.ink, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">— select account —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: C.muted, pointerEvents: 'none' }}>▾</span>
              </div>
            </div>

            {/* Visual connector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontSize: 10.5, color: C.muted2, fontFamily: "'JetBrains Mono', monospace" }}>balanced</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>

            {/* Credit row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11.5, fontWeight: 500, color: C.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 28, padding: '1px 6px', borderRadius: 3, background: 'var(--c-accent-bg)', color: 'var(--c-accent)', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>CR</span>
                Credit account
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={jeCreditId}
                  onChange={e => setJeCreditId(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{
                    width: '100%', height: 34, padding: '0 26px 0 11px', appearance: 'none',
                    background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4,
                    fontSize: 13, color: jeCreditId === '' ? C.muted2 : C.ink, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">— select account —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: C.muted, pointerEvents: 'none' }}>▾</span>
              </div>
            </div>
          </div>

          {/* Balance preview */}
          {jeAmount && !isNaN(parseFloat(jeAmount)) && jeDebitId !== '' && jeCreditId !== '' && (
            <div style={{
              padding: '10px 12px', borderRadius: 6,
              border: `1px solid ${C.line}`, background: 'var(--c-subtle)',
              fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Preview</div>
              {[
                { label: 'DR', account: accounts.find(a => a.id === jeDebitId), color: 'var(--c-ok)', bg: 'var(--c-ok-bg)' },
                { label: 'CR', account: accounts.find(a => a.id === jeCreditId), color: 'var(--c-accent)', bg: 'var(--c-accent-bg)' },
              ].map(({ label, account, color, bg }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, padding: '1px 0', borderRadius: 3, background: bg, color, fontSize: 10, fontWeight: 700, textAlign: 'center', flexShrink: 0 }}>{label}</span>
                  <span style={{ flex: 1, color: C.ink2, fontSize: 12 }}>{account ? `${account.code} · ${account.name}` : '—'}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.ink }}>
                    ₨ {parseFloat(jeAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {jeSaveErr && (
            <div style={{ padding: '8px 12px', borderRadius: 4, background: 'var(--c-bad-bg)', color: C.bad, fontSize: 12 }}>
              {jeSaveErr}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${C.line}`,
          background: 'var(--c-sidebar)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => !jeSaving && setJePanelOpen(false)}
            style={{ height: 30, padding: '0 12px', borderRadius: 4, border: `1px solid ${C.line2}`, background: C.paper, color: C.ink, fontSize: 12.5, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handlePostEntry}
            disabled={jeSaving}
            style={{
              height: 30, padding: '0 14px', borderRadius: 4, border: 'none',
              background: C.accent, color: C.accentFg,
              fontSize: 12.5, fontWeight: 500, cursor: jeSaving ? 'not-allowed' : 'pointer',
              opacity: jeSaving ? 0.7 : 1,
            }}
          >
            {jeSaving ? 'Posting…' : 'Post entry'}
          </button>
        </div>
      </aside>
    </>
  );
}
