'use client';

import { useState, useEffect, useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { computeAliveTeams, qfDeadlineTs } from '@/components/FinalFourBetModal';

const REQUIRED = 4;

function fmtCountdown(ms) {
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function FinalFourPage() {
  const { user, matches, refreshData, allUsers } = useBetting();
  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const deadline = qfDeadlineTs();
  const closed = now >= deadline;
  const remaining = deadline - now;

  const alive = useMemo(() => computeAliveTeams(matches), [matches]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/special-bet?match_id=FINAL_FOUR&kind=final_four&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        const mine = data.myBets?.[0] || null;
        setMyBet(mine);
        setPool(data.pool || null);
        setPicks(data.picks || []);
        if (mine?.pick) {
          setSelected(new Set(mine.pick.split(',')));
          setAmount(mine.amount);
        }
      })
      .catch(() => {});
  }, [user]);

  function toggleTeam(code) {
    if (closed || myBet) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else if (next.size < REQUIRED) next.add(code);
      return next;
    });
  }

  const count = selected.size;
  const canSubmit = !closed && !submitting && !myBet && count === REQUIRED && amount > 0 && amount <= MAX_BET;

  async function handleSubmit() {
    if (!user || count !== REQUIRED) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          matchId: 'FINAL_FOUR',
          kind: 'final_four',
          pick: [...selected].sort().join(','),
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to place bet'); return; }
      refreshData?.();
      setMyBet({ pick: [...selected].sort().join(','), amount, status: 'pending' });
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!myBet || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betId: myBet.id }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Cancel failed'); return; }
      setMyBet(null);
      setSelected(new Set());
      refreshData?.();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const presets = [100, 250, 500, 1000];
  const totalPool = pool?.total || 0;
  const bettorCount = pool?.bettorCount || 0;

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
          <div style={{ fontSize: 20, fontWeight: 700 }}>🔮 Final Four</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Pick 4 semifinalists. Most correct wins the pool (ties split).
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

      {/* My bet */}
      {myBet && (
        <div style={{
          marginBottom: 16, padding: '12px 14px', borderRadius: 10,
          background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>YOUR PICK</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {myBet.pick.split(',').map(code => {
              const team = getTeam(code);
              return (
                <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.1)', fontSize: 12, fontWeight: 600 }}>
                  {team.flag} {team.name}
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{fmtMoney(myBet.amount)}</span>
            {!closed && (
              <button onClick={handleCancel} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team grid */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
            {closed ? 'Teams were alive at lock' : 'Teams still alive — pick exactly 4'}
          </span>
          {!myBet && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: count === REQUIRED ? 'var(--win)' : count > 0 ? 'var(--gold)' : 'var(--ink-3)' }}>
              {count}/{REQUIRED}
            </span>
          )}
        </div>

        {alive.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '18px 0', fontSize: 12, color: 'var(--ink-3)' }}>
            Knockout bracket still loading...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {alive.map(code => {
              const team = getTeam(code);
              const isSel = selected.has(code);
              const disabled = closed || myBet || (!isSel && count >= REQUIRED);
              return (
                <button
                  key={code}
                  disabled={disabled}
                  onClick={() => toggleTeam(code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
                    background: isSel ? 'rgba(54,211,153,0.14)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSel ? 'rgba(54,211,153,0.7)' : 'rgba(255,255,255,0.08)'}`,
                    color: isSel ? 'var(--win)' : 'var(--ink)',
                    opacity: disabled && !isSel ? 0.35 : 1,
                    fontSize: 12, fontWeight: 600, textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{team.flag}</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
                  {isSel && <span>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Amount + submit (only if no bet yet and not closed) */}
      {!closed && !myBet && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, marginBottom: 6 }}>
            {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
          </div>
          <input
            type="range" className="slider"
            min={100} max={MAX_BET} step={50}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ marginBottom: 8 }}
          />
          <div className="amount-presets" style={{ marginBottom: 12 }}>
            {presets.map(p => (
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
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{ width: '100%' }}
          >
            {submitting ? 'Placing…'
              : count < REQUIRED ? `Pick ${REQUIRED - count} more`
              : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`}
          </button>
        </div>
      )}

      {/* Rules */}
      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Pick 4 teams you think will make the semifinals. Whoever gets the most correct wins the entire pool. Ties split evenly.
        </div>
      </div>

      {/* Everyone's picks + potential win */}
      {picks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.04em' }}>
            EVERYONE'S PICKS
          </div>
          {picks.map((p, i) => {
            const samePick = picks.filter(x => x.pick === p.pick);
            const samePickTotal = samePick.reduce((s, x) => s + x.amount, 0);
            const potentialWin = totalPool > 0 && samePickTotal > 0
              ? fmtMoney(Math.floor((p.amount / samePickTotal) * totalPool))
              : '–';
            return (
              <div key={i} style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: 'var(--ink-3)',
                  }}>
                    {!p.avatarUrl && (p.displayName?.[0] || '?')}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{p.displayName}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{fmtMoney(p.amount)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 30 }}>
                  <span style={{ fontSize: 14 }}>{(p.pick || '').split(',').map(c => getTeam(c).flag).join(' ')}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                    if all 4 correct → <span style={{ color: 'var(--win)', fontWeight: 700 }}>{potentialWin}</span>
                  </span>
                </div>
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
