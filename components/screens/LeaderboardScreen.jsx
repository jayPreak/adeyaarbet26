'use client';

import { useState, useEffect } from 'react';
import { fmtCompact, getMatch, getTeam } from '@/lib/data';
import { fmtNet, CURRENCY_SYMBOL } from '@/lib/currency';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatActivity(a) {
  const match = a.payload?.match_id ? getMatch(a.payload.match_id) : null;
  const matchLabel = match
    ? `${getTeam(match.home).name} vs ${getTeam(match.away).name}`
    : a.payload?.match_id || '';

  if (a.type === 'bet_placed' && a.payload) {
    const pickTeam = match
      ? (a.payload.pick === 'home' ? getTeam(match.home).name : a.payload.pick === 'away' ? getTeam(match.away).name : 'Draw')
      : a.payload.pick;
    return `${a.profiles?.display_name || 'Someone'} bet ${CURRENCY_SYMBOL}${a.payload.amount} on ${pickTeam} · ${matchLabel}`;
  }
  if (a.type === 'bet_cancelled' && a.payload) {
    if (a.payload.reason === 'side_switch') {
      return `${a.profiles?.display_name || 'Someone'} switched sides · ${matchLabel}`;
    }
    return `${a.profiles?.display_name || 'Someone'} cancelled bet · ${matchLabel}`;
  }
  if (a.type === 'bet_won' && a.payload) {
    return `${a.profiles?.display_name || 'Someone'} won ${CURRENCY_SYMBOL}${a.payload.payout} · ${matchLabel}`;
  }
  return `${a.profiles?.display_name || 'Someone'} · ${a.type}`;
}

export default function LeaderboardScreen({ user }) {
  const [rankings, setRankings] = useState([]);
  const [settlementResolved, setSettlementResolved] = useState([]);
  const [settlementWithPending, setSettlementWithPending] = useState([]);
  const [settlementBasis, setSettlementBasis] = useState('resolved'); // 'resolved' | 'withPending'
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRankings(data); })
      .catch(() => {});
    fetch('/api/settlement')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.resolved?.transactions)) setSettlementResolved(data.resolved.transactions);
        if (Array.isArray(data.withPending?.transactions)) setSettlementWithPending(data.withPending.transactions);
      })
      .catch(() => {});
    fetch('/api/activity?limit=20')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setActivity(data); })
      .catch(() => {});
  }, []);

  const sorted = [...rankings].sort((a, b) => b.balance - a.balance);
  const top3 = sorted.slice(0, 3);
  const podium = top3.length >= 3 ? [
    { ...top3[1], rank: 2 },
    { ...top3[0], rank: 1 },
    { ...top3[2], rank: 3 },
  ] : [];

  const displayVal = (f) => fmtNet(f.balance);
  const displayColor = (f) => (f.balance >= 0 ? 'var(--win)' : 'var(--loss)');

  return (
    <div>
      {/* Podium */}
      {podium.length > 0 && (
        <div className="podium">
          {podium.map(f => (
            <div key={f.id} className={'podium-block rank' + f.rank}>
              <div className="podium-avatar" style={f.avatar_url ? { backgroundImage: `url(${f.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                {!f.avatar_url && (f.display_name || f.username)[0]}
              </div>
              <div className="podium-name">{f.display_name || f.username}</div>
              <div className="podium-amt" style={{ color: displayColor(f) }}>{displayVal(f)}</div>
              <div className="podium-bar">{f.rank}</div>
            </div>
          ))}
        </div>
      )}

      {/* Full list */}
      <div className="card" style={{ padding: 0, margin: '0 16px 24px' }}>
        {sorted.map((f, i) => {
          const isMe = user && f.id === user.id;
          return (
            <div key={f.id} className={'lb-row ' + (isMe ? 'me' : '')}>
              <span className="lb-rank">{i + 1}</span>
              <div className="lb-avatar" style={f.avatar_url ? { backgroundImage: `url(${f.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                {!f.avatar_url && (f.display_name || f.username)[0]}
              </div>
              <div className="lb-name">
                {f.display_name || f.username}
                {isMe && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, padding: '2px 6px',
                    background: 'var(--gold)', color: '#0a0a0a',
                    borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em',
                  }}>YOU</span>
                )}
              </div>
              <span className="lb-amt" style={{ color: displayColor(f) }}>
                {displayVal(f)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Settlement plan */}
      <div className="section-head" style={{ marginTop: 8 }}>
        <div className="section-head__title display">Settlement plan</div>
      </div>

      <div className="material-tabs" style={{ margin: '0 16px 8px' }}>
        <button
          className={'material-tab' + (settlementBasis === 'resolved' ? ' active' : '')}
          onClick={() => setSettlementBasis('resolved')}
        >
          Resolved only
        </button>
        <button
          className={'material-tab' + (settlementBasis === 'withPending' ? ' active' : '')}
          onClick={() => setSettlementBasis('withPending')}
        >
          Including pending
        </button>
      </div>

      {(() => {
        const txs = settlementBasis === 'resolved' ? settlementResolved : settlementWithPending;
        return (
          <div className="card" style={{ margin: '0 16px 8px', padding: '4px 0' }}>
            {txs.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                {settlementBasis === 'resolved'
                  ? 'All square — no payments needed yet'
                  : 'No matched debts yet — once anyone has a payout, pending stakes will pair with creditors'}
              </div>
            ) : (
              txs.map((tx, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px',
                  borderBottom: i < txs.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--loss)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {tx.from.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: 'var(--loss)' }}>{tx.from.name}</span>
                      {' pays '}
                      <span style={{ color: 'var(--win)' }}>{tx.to.name}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--gold)', flexShrink: 0 }}>
                    {CURRENCY_SYMBOL}{tx.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      <div style={{
        textAlign: 'center', fontSize: 11, color: 'var(--ink-3)',
        paddingBottom: 8, padding: '0 32px 16px',
      }}>
        {settlementBasis === 'resolved'
          ? 'If WC ended now (pending bets refunded) · finalised at end of tournament'
          : 'Treats pending stakes as already spent — early in the tournament most debts have no creditor yet'}
      </div>

      {/* Activity feed */}
      {activity.length > 0 && (
        <div style={{ margin: '16px 16px 24px' }}>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div className="section-head__title" style={{ fontSize: 16 }}>Recent Activity</div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {activity.map((item, i) => (
              <div key={item.id || i} style={{
                padding: '10px 14px',
                borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--ink-1)' }}>
                  {formatActivity(item)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {item.created_at ? timeAgo(item.created_at) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
