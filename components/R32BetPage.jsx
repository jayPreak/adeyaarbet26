'use client';

import { useState, useEffect } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { getTeam } from '@/lib/data';

const DEADLINE = new Date('2026-07-03T12:30:00Z').getTime();
const MIN_BET = 50;

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

export default function R32BetPage({ variant = 'flop' }) {
  const { user, refreshData, matches, allUsers } = useBetting();
  const isFlop = variant === 'flop';
  const title = isFlop ? '🫠 KO Flop' : '💸 KO Bagholder';
  const subtitle = isFlop
    ? 'Pick who loses the most in R32 + R16.'
    : 'Pick who wins the most in R32 + R16.';
  const matchId = isFlop ? 'R32_BIGGEST_LOSER' : 'R32_BIGGEST_WINNER';
  const kind = isFlop ? 'r32_loser' : 'r32_winner';

  const [standings, setStandings] = useState([]);
  const [poolData, setPoolData] = useState(null);
  const [picks, setPicks] = useState([]);
  const [myBet, setMyBet] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [amount, setAmount] = useState(MIN_BET);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const countdown = useCountdown(DEADLINE);
  const closed = Date.now() >= DEADLINE;

  useEffect(() => {
    fetch('/api/r32-standings')
      .then(r => r.json())
      .then(d => setStandings(d.standings || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/special-bet?match_id=${matchId}&kind=${kind}&user_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setPoolData(d.pool || null);
        setPicks(d.picks || []);
        setMyBet(d.myBets?.[0] || null);
      })
      .catch(() => {});
  }, [user, matchId, kind]);

  async function handlePlace() {
    if (!selectedUser || submitting || closed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId, kind, pick: selectedUser, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyBet({ pick: selectedUser, amount });
      setSelectedUser(null);
      refreshData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!myBet || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId, kind, pick: myBet.pick }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyBet(null);
      refreshData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalPool = poolData?.total || 0;
  const byOption = poolData?.byOption || {};

  // Sort: flop = biggest loser first (ascending net), bagholder = biggest winner first (descending)
  const sortedStandings = isFlop
    ? [...standings]
    : [...standings].reverse();

  return (
    <div style={{ padding: '16px', maxWidth: 480 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => window.history.back()}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}
            >
              ←
            </button>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
          </div>
          {countdown && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.1)', color: 'var(--win)' }}>
              {countdown}
            </span>
          )}
          {closed && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(248,113,113,0.12)', color: 'var(--loss)' }}>
              Closed
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
          {subtitle} Min {CURRENCY_SYMBOL}{MIN_BET}.
        </div>
      </div>

      {/* Pool info */}
      {totalPool > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>POOL</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(totalPool)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600 }}>BETS</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{poolData?.bettorCount || 0}</div>
          </div>
        </div>
      )}

      {/* My bet */}
      {myBet && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 2 }}>YOUR PICK</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{standings.find(s => s.userId === myBet.pick)?.displayName || myBet.pick}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>{fmtMoney(myBet.amount)}</div>
            </div>
            {!closed && (
              <button
                onClick={handleCancel}
                disabled={submitting}
                style={{ background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '6px 12px', color: 'var(--loss)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Who bet on whom */}
      {picks.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.04em' }}>
            WHO'S BETTING ON WHOM
          </div>
          {picks.map((p, i) => {
            const pickTarget = standings.find(s => s.userId === p.pick) || allUsers.find(u => u.id === p.pick);
            const pickName = pickTarget?.displayName || pickTarget?.display_name || p.pick;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 4, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'var(--ink-3)',
                }}>
                  {!p.avatarUrl && (p.displayName?.[0] || '?')}
                </div>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{p.displayName}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>→</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{pickName}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(p.amount)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Standings */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.04em' }}>
        R32 + R16 P&L STANDINGS
      </div>

      {sortedStandings.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 20, textAlign: 'center' }}>
          No knockout bets resolved yet
        </div>
      )}

      {sortedStandings.map((s, i) => {
        const isSelected = selectedUser === s.userId;
        const isExpanded = expandedUser === s.userId;
        const poolOnUser = byOption[s.userId] || 0;
        const isMyPick = myBet?.pick === s.userId;

        return (
          <div key={s.userId} style={{ marginBottom: 4 }}>
            <div
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                background: isSelected ? 'rgba(255,215,0,0.08)' : isMyPick ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '1px solid rgba(255,215,0,0.3)' : isMyPick ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.06)',
                borderBottom: isExpanded ? 'none' : undefined,
                textAlign: 'left',
              }}
            >
              <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textAlign: 'center' }}>
                {i + 1}
              </div>
              <div
                onClick={() => setExpandedUser(isExpanded ? null : s.userId)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  background: s.avatarUrl ? `url(${s.avatarUrl}) center/cover` : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
                }}
              >
                {!s.avatarUrl && (s.displayName?.[0] || '?')}
              </div>
              <div
                style={{ flex: 1, cursor: 'pointer' }}
                onClick={() => setExpandedUser(isExpanded ? null : s.userId)}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {s.displayName}
                  <span style={{ fontSize: 9, color: 'var(--ink-3)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                  {s.bets} bets · {fmtMoney(s.staked)} staked
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                  {s.net >= 0 ? '+' : ''}{fmtMoney(s.net)}
                </div>
                {s.pending > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{fmtMoney(s.pending)} pending</div>
                )}
              </div>
              {!myBet && !closed && (
                <button
                  onClick={() => setSelectedUser(isSelected ? null : s.userId)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: isSelected ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
                    color: isSelected ? '#000' : 'var(--ink-3)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {isSelected ? '✓' : 'Pick'}
                </button>
              )}
              {poolOnUser > 0 && (
                <div style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                  {fmtMoney(poolOnUser)}
                </div>
              )}
            </div>

            {isExpanded && s.history && (
              <div style={{
                padding: '8px 12px 10px', borderRadius: '0 0 10px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: isSelected ? '1px solid rgba(255,215,0,0.3)' : isMyPick ? '1px solid rgba(74,222,128,0.15)' : '1px solid rgba(255,255,255,0.06)',
                borderTop: 'none',
              }}>
                {s.history.map((h, j) => {
                  const m = matches.find(x => x.id === h.matchId);
                  const pickTeam = m && h.pick !== 'draw'
                    ? getTeam(m[h.pick === 'home' ? 'home' : 'away'])
                    : null;
                  const matchLabel = m && m.home && m.away
                    ? `${getTeam(m.home)?.code || '?'} v ${getTeam(m.away)?.code || '?'}`
                    : h.matchId;
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: j < s.history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, width: 40, textAlign: 'center', borderRadius: 4, padding: '2px 4px',
                        background: h.status === 'won' ? 'rgba(74,222,128,0.1)' : h.status === 'lost' ? 'rgba(248,113,113,0.1)' : 'rgba(255,215,0,0.08)',
                        color: h.status === 'won' ? 'var(--win)' : h.status === 'lost' ? 'var(--loss)' : 'var(--gold)',
                      }}>
                        {h.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', flex: 1 }}>
                        {matchLabel} · {pickTeam?.name || h.pick}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
                        {fmtMoney(h.amount)}
                      </span>
                      {h.status === 'won' && h.payout && (
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>
                          +{fmtMoney(h.payout - h.amount)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bet placement */}
      {!myBet && !closed && selectedUser && (
        <div style={{ marginTop: 16, padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
            Betting <strong style={{ color: 'var(--ink)' }}>{standings.find(s => s.userId === selectedUser)?.displayName || selectedUser}</strong> {isFlop ? 'loses' : 'wins'} the most in R32 + R16
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[50, 100, 200, 500].map(v => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: amount === v ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: amount === v ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: amount === v ? 'var(--gold)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {CURRENCY_SYMBOL}{v}
              </button>
            ))}
          </div>
          <button
            onClick={handlePlace}
            disabled={submitting}
            style={{
              width: '100%', padding: '12px', borderRadius: 10,
              background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Placing...' : `Place ${CURRENCY_SYMBOL}${amount} on ${standings.find(s => s.userId === selectedUser)?.displayName || '?'}`}
          </button>
          {error && <div style={{ color: 'var(--loss)', fontSize: 11, marginTop: 6 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
