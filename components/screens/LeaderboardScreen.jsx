'use client';

import { useState, useEffect } from 'react';
import { fmtMoney, fmtNet, CURRENCY_SYMBOL } from '@/lib/currency';
import { NetWorthGraph } from '@/components/screens/BetsScreen';

const TABS = [
  { id: 'total', label: 'Rankings' },
  { id: 'wins', label: 'Top Payouts' },
  { id: 'losses', label: 'Biggest Losses' },
  { id: 'bettor', label: 'High Rollers' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return '';
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ago`;
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return `${m}m ago`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function MiniSparkline({ points, width = 80, height = 32, globalMin, globalMax }) {
  if (!points || points.length < 2) {
    return <svg width={width} height={height}><line x1={4} y1={height / 2} x2={width - 4} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" /></svg>;
  }
  const min = globalMin != null ? globalMin : Math.min(...points, 0);
  const max = globalMax != null ? globalMax : Math.max(...points, 0);
  const range = max - min || 1;
  const px = 4, py = 4;
  const chartW = width - px * 2, chartH = height - py * 2;
  const zeroY = py + (1 - (0 - min) / range) * chartH;
  const d = points.map((v, i) => {
    const x = px + (i / (points.length - 1)) * chartW;
    const y = py + (1 - (v - min) / range) * chartH;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  const last = points[points.length - 1];
  const color = last >= 0 ? '#4ade80' : '#f87171';
  return (
    <svg width={width} height={height}>
      <line x1={px} y1={zeroY} x2={width - px} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NetWorthCarousel({ rankings }) {
  const sorted = [...rankings].sort((a, b) => (b.realisedBalance || 0) - (a.realisedBalance || 0));
  if (!sorted.some(r => r.chartPoints?.length >= 2)) return null;
  // Shared scale across all charts
  const allValues = sorted.flatMap(r => r.chartPoints || []).concat(0);
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 16px 8px' }}>
        Net Worth
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 8px', scrollbarWidth: 'none' }}>
        {sorted.map(r => {
          const val = r.realisedBalance || 0;
          return (
            <div key={r.id} style={{
              minWidth: 120, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div className="lb-avatar" style={{
                  width: 20, height: 20, fontSize: 9,
                  ...(r.avatar_url ? { backgroundImage: `url(${r.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                }}>
                  {!r.avatar_url && (r.display_name || r.username || '?')[0]}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(r.display_name || r.username || '?').split(' ')[0]}
                </span>
              </div>
              <MiniSparkline points={r.chartPoints} width={96} height={28} globalMin={globalMin} globalMax={globalMax} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: val >= 0 ? 'var(--win)' : 'var(--loss)', marginTop: 4 }}>
                {val >= 0 ? '+' : ''}{fmtMoney(val)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubTabs({ active, onChange }) {
  return (
    <div className="material-tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={'material-tab' + (active === t.id ? ' active' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LeaderRow({ rank, user, entry, isMe, valueMain, valueSub, valueColor, onTap }) {
  return (
    <div
      onClick={() => onTap?.(entry)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', marginBottom: 6, borderRadius: 12,
        background: isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: isMe ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: rank <= 3 ? 'var(--gold)' : 'var(--ink-3)', width: 18, fontWeight: rank <= 3 ? 700 : 400 }}>
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <div className="lb-avatar" style={entry.avatar_url ? { backgroundImage: `url(${entry.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!entry.avatar_url && (entry.display_name || entry.username || '?')[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {entry.display_name || entry.username}
          {isMe && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', background: 'var(--gold)', color: '#0a0a0a', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
        </div>
        {valueSub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{valueSub}</div>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: valueColor || 'var(--ink)' }}>
        {valueMain}
      </div>
      <span style={{ fontSize: 14, opacity: 0.4, marginLeft: 4 }}>📈</span>
    </div>
  );
}

export function UserProfileModal({ entry, onClose }) {
  const [bets, setBets] = useState(null);

  useEffect(() => {
    if (!entry) return;
    fetch(`/api/bets?user_id=${entry.id}`)
      .then(r => r.json())
      .then(data => setBets(Array.isArray(data) ? data : []))
      .catch(() => setBets([]));
  }, [entry]);

  if (!entry) return null;

  const resolved = (bets || []).filter(b => b.match_id !== '_topup' && b.kind !== 'penalty' && (b.status === 'won' || b.status === 'lost'));
  const won = resolved.filter(b => b.status === 'won');
  const lost = resolved.filter(b => b.status === 'lost');
  const winRate = resolved.length ? Math.round(100 * won.length / resolved.length) : 0;
  const totalWagered = resolved.reduce((s, b) => s + b.amount, 0);
  const biggestWin = won.length ? Math.max(...won.map(b => (b.payout || 0) - b.amount)) : 0;
  const pendingCount = (bets || []).filter(b => b.status === 'pending' && b.kind !== 'penalty' && b.match_id !== '_topup').length;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflow: 'auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="lb-avatar" style={{
            width: 48, height: 48, fontSize: 20,
            ...(entry.avatar_url ? { backgroundImage: `url(${entry.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
          }}>
            {!entry.avatar_url && (entry.display_name || entry.username || '?')[0]}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{entry.display_name || entry.username}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>@{entry.username || entry.display_name?.toLowerCase().replace(/\s/g, '')}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{winRate}%</div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>Win Rate</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{resolved.length}</div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>Settled</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>{biggestWin > 0 ? fmtMoney(biggestWin) : '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>Best Win</div>
          </div>
        </div>

        {/* Graph */}
        {bets === null ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-3)', fontSize: 12 }}>Loading...</div>
        ) : (
          <NetWorthGraph bets={bets} />
        )}

        {/* Extra stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', marginTop: 8, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>Total Wagered</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{fmtMoney(totalWagered)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>Record</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
              <span style={{ color: 'var(--win)' }}>{won.length}W</span> / <span style={{ color: 'var(--loss)' }}>{lost.length}L</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>Open Bets</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{pendingCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettlementPlan({ user }) {
  const [resolved, setResolved] = useState([]);
  const [withPending, setWithPending] = useState([]);
  const [basis, setBasis] = useState('resolved');

  useEffect(() => {
    fetch('/api/settlement')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.resolved?.transactions)) setResolved(d.resolved.transactions);
        if (Array.isArray(d.withPending?.transactions)) setWithPending(d.withPending.transactions);
      })
      .catch(() => {});
  }, []);

  const txs = basis === 'resolved' ? resolved : withPending;

  return (
    <div style={{ margin: '16px 16px 12px', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Settlement plan
        </div>
        <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[['resolved', 'Resolved'], ['withPending', 'Incl. pending']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setBasis(id)}
              style={{
                padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: basis === id ? 'var(--gold-soft, rgba(255,215,0,0.12))' : 'transparent',
                color: basis === id ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {txs.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
          {basis === 'resolved'
            ? 'All square, no payments needed yet'
            : 'No matched debts yet. Once anyone has a payout, pending stakes pair with creditors'}
        </div>
      ) : (
        txs.map((tx, i) => {
          const meIn = user && (tx.from.id === user.id || tx.to.id === user.id);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: i < txs.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--loss)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {tx.from.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: meIn ? 700 : 600 }}>
                <span style={{ color: 'var(--loss)' }}>{tx.from.name}</span>
                <span style={{ color: 'var(--ink-3)' }}> pays </span>
                <span style={{ color: 'var(--win)' }}>{tx.to.name}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--gold)', flexShrink: 0 }}>
                {CURRENCY_SYMBOL}{tx.amount.toLocaleString('en-IN')}
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
        {basis === 'resolved'
          ? 'If WC ended now (pending bets refunded) · finalised at end of tournament'
          : 'Treats pending stakes as already spent. Early on most debts have no creditor yet'}
      </div>
    </div>
  );
}

export function TotalWinsTab({ rankings, user }) {
  const [profileUser, setProfileUser] = useState(null);
  const sorted = [...rankings].sort((a, b) => (b.realisedBalance || 0) - (a.realisedBalance || 0));
  const hasAnyResolved = sorted.some(r => r.realisedBalance !== 0);

  return (
    <div>
      <NetWorthCarousel rankings={rankings} />
      <div style={{ margin: '0 16px' }}>
      {!hasAnyResolved && (
        <div style={{ padding: '20px 16px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No matches settled yet — everyone starts at 0</div>
        </div>
      )}
      {sorted.map((f, i) => {
        const val = f.realisedBalance || 0;
        return (
          <LeaderRow
            key={f.id}
            rank={i + 1}
            user={user}
            entry={f}
            isMe={user && f.id === user.id}
            valueMain={fmtNet(val)}
            valueSub={null}
            valueColor={val > 0 ? 'var(--win)' : val < 0 ? 'var(--loss)' : 'var(--ink-3)'}
            onTap={setProfileUser}
          />
        );
      })}
      </div>
      <SettlementPlan user={user} />
      {profileUser && <UserProfileModal entry={profileUser} onClose={() => setProfileUser(null)} />}
    </div>
  );
}

export function BiggestWinsTab({ biggestWins }) {
  return (
    <div style={{ margin: '0 16px' }}>
      {biggestWins.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>No wins yet</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Individual winning bets show up here once matches settle</div>
        </div>
      ) : (
        biggestWins.slice(0, 15).map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', marginBottom: 6, borderRadius: 12,
            background: i < 3 ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.02)',
            border: i < 3 ? '1px solid rgba(255,215,0,0.12)' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--gold)' : 'var(--ink-3)', width: 18, fontWeight: i < 3 ? 700 : 400 }}>
              {i < 3 ? MEDALS[i] : i + 1}
            </span>
            <div className="lb-avatar" style={w.avatarUrl ? { backgroundImage: `url(${w.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!w.avatarUrl && (w.displayName || '?')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{w.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                {w.matchLabel || w.matchId} · picked {w.pickLabel || w.pick}
              </div>
              {w.resolvedAt && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{fmtMoney(w.stake)} → {fmtMoney(w.payout)} · {timeAgo(w.resolvedAt)}</div>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--win)' }}>
              +{fmtMoney(w.profit)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function BiggestLossesTab({ biggestLosses }) {
  return (
    <div style={{ margin: '0 16px' }}>
      {biggestLosses.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😅</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>No losses yet</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Lost bets show up here once matches settle</div>
        </div>
      ) : (
        biggestLosses.slice(0, 15).map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', marginBottom: 6, borderRadius: 12,
            background: i < 3 ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)',
            border: i < 3 ? '1px solid rgba(248,113,113,0.12)' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--loss)' : 'var(--ink-3)', width: 18, fontWeight: i < 3 ? 700 : 400 }}>
              {i < 3 ? MEDALS[i] : i + 1}
            </span>
            <div className="lb-avatar" style={w.avatarUrl ? { backgroundImage: `url(${w.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!w.avatarUrl && (w.displayName || '?')[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{w.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                {w.matchLabel || w.matchId} · picked {w.pickLabel || w.pick}
              </div>
              {w.resolvedAt && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>staked {fmtMoney(w.amount)} · {timeAgo(w.resolvedAt)}</div>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--loss)' }}>
              -{fmtMoney(w.amount)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BetDropdown({ topBets }) {
  if (!topBets?.length) return null;
  return (
    <div style={{ padding: '6px 12px 10px 48px' }}>
      {topBets.map((b, i) => {
        const profitColor = b.status === 'won' ? 'var(--win)' : b.status === 'lost' ? 'var(--loss)' : 'var(--ink-3)';
        const profitLabel = b.status === 'won' ? `+${fmtMoney(b.payout - b.amount)}`
          : b.status === 'lost' ? `-${fmtMoney(b.amount)}`
          : 'pending';
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 0',
            borderBottom: i < topBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 60 }}>{b.matchLabel}</span>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--ink-2)' }}>{b.pickLabel}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', minWidth: 50, textAlign: 'right' }}>{fmtMoney(b.amount)}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: profitColor, minWidth: 60, textAlign: 'right' }}>{profitLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BiggestBettorTab({ rankings, user }) {
  const [expandedId, setExpandedId] = useState(null);
  const sorted = [...rankings].sort((a, b) => (b.totalStaked || 0) - (a.totalStaked || 0));
  const groupTotal = rankings.reduce((s, r) => s + (r.totalStaked || 0), 0);

  return (
    <div style={{ margin: '0 16px' }}>
      <div style={{ padding: '8px 0 16px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{CURRENCY_SYMBOL}{groupTotal.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>total in play across {rankings.length} players</div>
      </div>
      {sorted.map((f, i) => {
        const isExpanded = expandedId === f.id;
        const isMe = user && f.id === user.id;
        return (
          <div key={f.id} style={{ marginBottom: 6 }}>
            <div
              onClick={() => setExpandedId(isExpanded ? null : f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                background: isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: isMe ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: i < 3 ? 'var(--gold)' : 'var(--ink-3)', width: 18, fontWeight: i < 3 ? 700 : 400 }}>
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <div className="lb-avatar" style={f.avatar_url ? { backgroundImage: `url(${f.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                {!f.avatar_url && (f.display_name || f.username || '?')[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {f.display_name || f.username}
                  {isMe && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', background: 'var(--gold)', color: '#0a0a0a', borderRadius: 4, fontWeight: 700 }}>YOU</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{f.betCount || 0} bet{f.betCount !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                {fmtMoney(f.totalStaked || 0)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
            </div>
            {isExpanded && (
              <div style={{
                borderRadius: '0 0 12px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderTop: 'none',
              }}>
                <BetDropdown topBets={f.topBets} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LeaderboardScreen({ user }) {
  const [subTab, setSubTab] = useState('total');
  const [rankings, setRankings] = useState([]);
  const [biggestWins, setBiggestWins] = useState([]);
  const [biggestLosses, setBiggestLosses] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRankings(data);
        } else if (data?.rankings) {
          setRankings(data.rankings);
          setBiggestWins(data.biggestWins || []);
          setBiggestLosses(data.biggestLosses || []);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <SubTabs active={subTab} onChange={setSubTab} />
      {subTab === 'total' && <TotalWinsTab rankings={rankings} user={user} />}
      {subTab === 'wins' && <BiggestWinsTab biggestWins={biggestWins} />}
      {subTab === 'losses' && <BiggestLossesTab biggestLosses={biggestLosses} />}
      {subTab === 'bettor' && <BiggestBettorTab rankings={rankings} user={user} />}
    </div>
  );
}
