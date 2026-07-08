'use client';

import { useState, useEffect } from 'react';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { TOTAL_GOALS_LINE, TOTAL_GOALS_MATCH_COUNT, formatTotalGoalsPick, goalsSoFar } from '@/lib/props';
import { qfDeadlineTs } from './FinalFourBetModal';
import { Icon } from './index';
import { fetchSpecialDirect } from '@/lib/specialsQuery';

export default function TotalGoalsBetModal({ open, onClose, user, onPlaced, matches = [] }) {
  const deadline = qfDeadlineTs(matches);
  const closed = deadline != null && Date.now() >= deadline;
  const soFar = goalsSoFar(matches);

  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState(250);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function loadData() {
    if (!user?.id) return;
    const apply = (data) => {
      if (!data) return;
      const mine = data.myBets?.[0] || null;
      setMyBet(mine);
      setPool(data.pool || null);
      setPicks(data.picks || []);
      if (mine) { setPick(mine.pick); setAmount(mine.amount); }
    };
    try {
      const direct = await fetchSpecialDirect({ matchId: 'TOTAL_GOALS', kind: 'total_goals', userId: user.id });
      if (direct) return apply(direct);
    } catch { /* fall through */ }
    try {
      const res = await fetch(`/api/special-bet?match_id=TOTAL_GOALS&kind=total_goals&user_id=${user.id}`);
      if (!res.ok) return;
      apply(await res.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (open) { setError(null); loadData(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const byOption = pool?.byOption || {};
  const total = pool?.total || 0;

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
      onPlaced?.();
      loadData();
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
      onPlaced?.();
      loadData();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        <div className="row between center" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)' }}>🌡️ Total Tournament Goals</div>
            <div style={{ fontSize: 11, color: closed ? 'var(--loss)' : 'var(--ink-3)', marginTop: 2 }}>
              {closed ? 'Locked — quarterfinals started' : `Through Round of 16 (${TOTAL_GOALS_MATCH_COUNT} matches, incl. extra time) · line ${TOTAL_GOALS_LINE}`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            {Icon.close}
          </button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
          padding: '8px 0 12px', marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Goals so far</span>
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>{soFar}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>/ {TOTAL_GOALS_LINE} line</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {myBet && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
            }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--win)' }}>
                Your bet: <b>{fmtMoney(myBet.amount)}</b> on <b>{formatTotalGoalsPick(myBet.pick)}</b>
              </span>
              {!closed && (
                <button onClick={handleCancel} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {['over', 'under'].map(o => {
              const amt = byOption[o] || 0;
              const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
              return (
                <button
                  key={o}
                  disabled={closed}
                  onClick={() => setPick(o)}
                  style={{
                    padding: '16px 8px', borderRadius: 12, cursor: closed ? 'not-allowed' : 'pointer', textAlign: 'center',
                    background: pick === o ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${pick === o ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
                    color: pick === o ? 'var(--gold)' : 'var(--ink)',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{o === 'over' ? '🔥' : '🧊'}</div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{o === 'over' ? 'Over' : 'Under'} {TOTAL_GOALS_LINE}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{total > 0 ? `${fmtMoney(amt)} · ${pct}%` : '—'}</div>
                </button>
              );
            })}
          </div>

          {picks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>EVERYONE&apos;S PICKS</div>
              {picks.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{p.displayName}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink)' }}>{formatTotalGoalsPick(p.pick)}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {!closed && (
            <div style={{ paddingTop: 8 }}>
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
              <div className="amount-presets" style={{ marginBottom: 10 }}>
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
            </div>
          )}
        </div>

        {!closed && (
          <button
            className="btn primary block lg"
            style={{ flexShrink: 0, marginTop: 10 }}
            disabled={submitting || !pick || (myBet && myBet.pick === pick && myBet.amount === amount)}
            onClick={handleSubmit}
          >
            {submitting ? 'Placing…'
              : !pick ? 'Pick over or under'
              : myBet ? 'Update bet'
              : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`}
          </button>
        )}
      </div>
    </div>
  );
}
