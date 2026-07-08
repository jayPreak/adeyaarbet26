'use client';

import { useState, useEffect } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { TOTAL_GOALS_LINE, TOTAL_GOALS_MATCH_COUNT, formatTotalGoalsPick, goalsSoFar } from '@/lib/props';
import { qfDeadlineTs } from '@/components/FinalFourBetModal';

export default function TotalGoalsPage() {
  const { user, matches, refreshData, allUsers } = useBetting();
  const deadline = qfDeadlineTs();
  const closed = Date.now() >= deadline;
  const soFar = goalsSoFar(matches);
  const finishedCount = matches.filter(m => m.status === 'finished').length;

  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState(250);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/special-bet?match_id=TOTAL_GOALS&kind=total_goals&user_id=${user.id}`)
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
  const overPool = byOption.over || 0;
  const underPool = byOption.under || 0;

  async function handleSubmit() {
    if (!user || !pick) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: 'TOTAL_GOALS', kind: 'total_goals', pick, amount }),
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
    if (!myBet?.id || !user) return;
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

  const myPotentialWin = myBet && totalPool > 0
    ? Math.floor((myBet.amount / (myBet.pick === 'over' ? overPool : underPool)) * totalPool)
    : 0;

  const pacePerMatch = finishedCount > 0 ? (soFar / finishedCount).toFixed(2) : '–';
  const projectedTotal = finishedCount > 0 ? Math.round((soFar / finishedCount) * TOTAL_GOALS_MATCH_COUNT) : null;

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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🌡️ Total Tournament Goals</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Over/under {TOTAL_GOALS_LINE} goals across all {TOTAL_GOALS_MATCH_COUNT} matches
          </div>
        </div>
      </div>

      {/* Live goal tracker */}
      <div style={{
        padding: '16px', borderRadius: 12, marginBottom: 16, textAlign: 'center',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>Goals scored so far</div>
        <div style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>
          {soFar}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
          {finishedCount} of {TOTAL_GOALS_MATCH_COUNT} matches played · {pacePerMatch} goals/match
        </div>
        {projectedTotal && (
          <div style={{ fontSize: 12, color: projectedTotal > TOTAL_GOALS_LINE ? 'var(--win)' : 'var(--loss)', marginTop: 6, fontWeight: 600 }}>
            Projected: ~{projectedTotal} goals ({projectedTotal > TOTAL_GOALS_LINE ? 'Over' : 'Under'} pace)
          </div>
        )}
        {/* Progress bar toward line */}
        <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (soFar / TOTAL_GOALS_LINE) * 100)}%`, background: 'var(--gold)', borderRadius: 4, transition: 'width 0.3s' }} />
          <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 2, background: 'var(--ink-3)', transform: 'translateX(-50%)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink-3)', marginTop: 4 }}>
          <span>0</span>
          <span>Line: {TOTAL_GOALS_LINE}</span>
          <span>{Math.round(TOTAL_GOALS_LINE * 2)}</span>
        </div>
      </div>

      {/* Rules */}
      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Will there be over or under {TOTAL_GOALS_LINE} total goals across all {TOTAL_GOALS_MATCH_COUNT} tournament matches (including extra time, excluding shootouts)? Settled at tournament end.
        </div>
      </div>

      {/* My bet */}
      {myBet && (
        <div style={{
          marginBottom: 16, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4 }}>YOUR BET</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {formatTotalGoalsPick(myBet.pick)} · {fmtMoney(myBet.amount)}
            </span>
            {!closed && (
              <button onClick={handleCancel} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
          {myPotentialWin > 0 && (
            <div style={{ fontSize: 12, color: 'var(--win)', marginTop: 4 }}>
              Potential win: {fmtMoney(myPotentialWin)}
            </div>
          )}
        </div>
      )}

      {/* Over/Under buttons */}
      {!closed && !myBet && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {['over', 'under'].map(o => {
              const amt = byOption[o] || 0;
              const pct = totalPool > 0 ? Math.round((amt / totalPool) * 100) : 0;
              return (
                <button
                  key={o}
                  onClick={() => setPick(o)}
                  style={{
                    padding: '16px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    background: pick === o ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${pick === o ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
                    color: pick === o ? 'var(--gold)' : 'var(--ink)',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{o === 'over' ? '🔥' : '🧊'}</div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{o === 'over' ? 'Over' : 'Under'} {TOTAL_GOALS_LINE}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{totalPool > 0 ? `${fmtMoney(amt)} · ${pct}%` : '—'}</div>
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, marginBottom: 6 }}>
            {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
          </div>
          <input
            type="range" className="slider"
            min={50} max={MAX_BET} step={50}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ marginBottom: 8 }}
          />
          <div className="amount-presets" style={{ marginBottom: 12 }}>
            {[100, 250, 500, 1000].map(p => (
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
              : !pick ? 'Pick over or under'
              : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} on ${pick === 'over' ? 'Over' : 'Under'}`}
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
            const potWin = totalPool > 0
              ? Math.floor((p.amount / (p.pick === 'over' ? overPool : underPool)) * totalPool)
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
                <span style={{ fontSize: 12, color: p.pick === 'over' ? '#ff9500' : '#5ac8fa' }}>{formatTotalGoalsPick(p.pick)}</span>
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
