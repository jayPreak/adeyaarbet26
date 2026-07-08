'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { computeAliveTeams } from '@/components/FinalFourBetModal';

const DEADLINE = new Date('2026-07-09T19:30:00Z').getTime();

function fmtCountdown(ms) {
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
}

export default function KOCupWinnerPage() {
  const { user, matches, refreshData, allUsers } = useBetting();
  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const closed = now >= DEADLINE;
  const remaining = DEADLINE - now;

  const alive = useMemo(() => computeAliveTeams(matches), [matches]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/special-bet?match_id=KO_CUP_WINNER&kind=ko_cup_winner&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        const mine = data.myBets?.[0] || null;
        setMyBet(mine);
        setPool(data.pool || null);
        setPicks(data.picks || []);
        if (mine) { setPick(mine.pick); setAmount(mine.amount); }
      })
      .catch(() => {});
  }, [user]);

  const byOption = pool?.byOption || {};
  const totalPool = pool?.total || 0;
  const bettorCount = pool?.bettorCount || 0;

  const myPotentialWin = myBet && totalPool > 0 && byOption[myBet.pick]
    ? Math.floor((myBet.amount / byOption[myBet.pick]) * totalPool)
    : 0;

  async function handleSubmit() {
    if (!user || !pick || closed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: 'KO_CUP_WINNER', kind: 'ko_cup_winner', pick, amount }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to place bet'); return; }
      refreshData?.();
      setMyBet({ pick, amount, status: 'pending' });
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!myBet || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betId: myBet.id }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Cancel failed'); return; }
      setMyBet(null); setPick(null);
      refreshData?.();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🏆 Cup Winner Last 8</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Pick the World Cup winner from the remaining 8 teams
          </div>
        </div>
      </div>

      {/* Deadline countdown */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: 10, marginBottom: 16,
        background: closed ? 'rgba(255,61,127,0.06)' : 'rgba(0,255,133,0.04)',
        border: `1px solid ${closed ? 'rgba(255,61,127,0.2)' : 'rgba(0,255,133,0.15)'}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: closed ? 'var(--loss)' : 'var(--ink-2)' }}>
          {closed ? 'Betting closed' : 'Closes in'}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: closed ? 'var(--loss)' : 'var(--gold)' }}>
          {fmtCountdown(remaining)}
        </span>
      </div>

      {/* Pool info */}
      {totalPool > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 12, color: 'var(--ink-3)' }}>
          Pool: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmtMoney(totalPool)}</span> · {bettorCount} player{bettorCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Rules */}
      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Separate pool from the group-stage cup winner. Pick any team still alive in the knockout bracket. Winner takes all (ties split). Closes before quarterfinals.
        </div>
      </div>

      {/* My bet */}
      {myBet && (
        <div style={{
          marginBottom: 16, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>YOUR BET</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{getTeam(myBet.pick)?.flag || ''}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{getTeam(myBet.pick)?.name || myBet.pick}</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{fmtMoney(myBet.amount)}</span>
            </div>
            {!closed && (
              <button onClick={handleCancel} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
          {myPotentialWin > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--win)' }}>
              Potential win: {fmtMoney(myPotentialWin)}
            </div>
          )}
        </div>
      )}

      {/* Team grid */}
      {!closed && !myBet && (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>
              Pick a team ({alive.length} still alive)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {alive.map(code => {
                const team = getTeam(code);
                const isSel = pick === code;
                const poolAmt = byOption[code] || 0;
                const pct = totalPool > 0 ? Math.round((poolAmt / totalPool) * 100) : 0;
                return (
                  <button
                    key={code}
                    onClick={() => setPick(code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      background: isSel ? 'rgba(54,211,153,0.14)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSel ? 'rgba(54,211,153,0.7)' : 'rgba(255,255,255,0.08)'}`,
                      color: isSel ? 'var(--win)' : 'var(--ink)',
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{team.flag}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
                    {poolAmt > 0 && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{pct}%</span>}
                    {isSel && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, marginBottom: 6, marginTop: 14 }}>
            {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
          </div>
          <input
            type="range" className="slider"
            min={250} max={MAX_BET} step={50}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ marginBottom: 8 }}
          />
          <div className="amount-presets" style={{ marginBottom: 12 }}>
            {[250, 500, 1000, 2000].map(p => (
              <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
                {CURRENCY_SYMBOL}{p}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: '8px 12px', marginBottom: 8, borderRadius: 8, background: 'rgba(255,61,127,0.08)', border: '1px solid rgba(255,61,127,0.3)', color: 'var(--loss)', fontSize: 12 }}>
              {error}
            </div>
          )}

          <button
            className="btn primary block lg"
            disabled={submitting || !pick}
            onClick={handleSubmit}
            style={{ width: '100%' }}
          >
            {submitting ? 'Placing…'
              : !pick ? 'Pick a team'
              : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} on ${getTeam(pick)?.name || pick}`}
          </button>
        </>
      )}

      {/* Everyone's picks */}
      {picks.length > 0 && (
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.04em' }}>
            EVERYONE'S PICKS
          </div>
          {picks.map((p, i) => {
            const team = getTeam(p.pick);
            const potWin = totalPool > 0 && byOption[p.pick]
              ? Math.floor((p.amount / byOption[p.pick]) * totalPool)
              : 0;
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
                <span style={{ fontSize: 14 }}>{team?.flag || ''}</span>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>{team?.name || p.pick}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{fmtMoney(p.amount)}</span>
                {potWin > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--win)', fontFamily: 'var(--font-mono)' }}>→{fmtMoney(potWin)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Haven't bet */}
      {allUsers.length > 0 && (() => {
        const bettorIds = new Set(picks.map(p => p.userId));
        const notBet = allUsers.filter(u => !bettorIds.has(u.id));
        if (notBet.length === 0) return null;
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8 }}>HAVEN'T BET YET ({notBet.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {notBet.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: 'var(--ink-3)',
                  }}>
                    {!u.avatar_url && (u.display_name?.[0] || '?')}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
