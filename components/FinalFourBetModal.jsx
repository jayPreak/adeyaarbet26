'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { Icon } from './index';
import { fetchSpecialDirect } from '@/lib/specialsQuery';

const REQUIRED = 4;

// Teams still alive in the knockout bracket: everyone who appears in a KO
// match minus everyone who has lost one. Falls back to [] if KO data missing.
export function computeAliveTeams(matches) {
  const inKo = new Set();
  const eliminated = new Set();
  for (const m of matches) {
    if (!m.knockout || m.id?.startsWith('3RD')) continue;
    if (m.home) inKo.add(m.home);
    if (m.away) inKo.add(m.away);
    if (m.status === 'finished' && m.score) {
      const [h, a] = m.score;
      let loser = null;
      if (h > a) loser = m.away;
      else if (a > h) loser = m.home;
      else {
        // Level after 90/ET → decided by penalties. Knockouts can't end in a
        // true draw, so if scores are level we MUST have valid, non-equal pen
        // scores to know who advanced. If FIFA hasn't posted pen scores yet
        // (brief lag after the final whistle), eliminate NO ONE this pass —
        // the next refresh, once pens are in, will resolve it correctly.
        // Never eliminate a team on a tie we can't break.
        if (m.homePen != null && m.awayPen != null && m.homePen !== m.awayPen) {
          loser = m.homePen > m.awayPen ? m.away : m.home;
        }
      }
      if (loser) eliminated.add(loser);
    }
  }
  return [...inKo].filter(c => !eliminated.has(c)).sort();
}

// Deadline = first QF kickoff, matching the server-side qf_deadline() RPC
// (MIN(kickoff_ts) WHERE id LIKE 'QF-%'). Derive it from the live schedule
// (matches array) so it's always exact and never drifts from the server.
// Falls back to the pinned first-QF kickoff if schedule data isn't loaded yet.
const QF_KICKOFF_FALLBACK = new Date('2026-07-09T20:00:00Z').getTime();
export function qfDeadlineTs(matches = []) {
  const qfKickoffs = matches
    .filter(m => (m.id || '').startsWith('QF-') && m.kickoffTs)
    .map(m => new Date(m.kickoffTs).getTime())
    .filter(t => !isNaN(t));
  return qfKickoffs.length ? Math.min(...qfKickoffs) : QF_KICKOFF_FALLBACK;
}

export default function FinalFourBetModal({ open, onClose, user, onPlaced, matches = [] }) {
  const deadline = qfDeadlineTs(matches);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);
  const closed = deadline != null && now >= deadline;

  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const alive = useMemo(() => computeAliveTeams(matches), [matches]);

  // Cancellation ref so async loadData() calls (post-place, post-cancel)
  // don't stomp state after the modal closes.
  const loadEpoch = useRef(0);

  const applyData = (data, epoch) => {
    if (epoch !== loadEpoch.current) return;   // stale response — modal was closed or reloaded
    if (!data) return;
    const mine = data.myBets?.[0] || null;
    setMyBet(mine);
    setPool(data.pool || null);
    setPicks(data.picks || []);
    if (mine?.pick) {
      setSelected(new Set(mine.pick.split(',')));
      setAmount(mine.amount);
    }
  };

  async function loadData() {
    if (!user?.id) return;
    const epoch = ++loadEpoch.current;
    try {
      const direct = await fetchSpecialDirect({ matchId: 'FINAL_FOUR', kind: 'final_four', userId: user.id });
      if (direct) return applyData(direct, epoch);
    } catch { /* fall through */ }
    try {
      const res = await fetch(`/api/special-bet?match_id=FINAL_FOUR&kind=final_four&user_id=${user.id}`);
      if (!res.ok) return;
      applyData(await res.json(), epoch);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!open) { loadEpoch.current++; return; }   // bump epoch so in-flight loads are ignored
    if (!user?.id) return;
    setError(null);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  if (!open) return null;

  function toggleTeam(code) {
    if (closed) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else if (next.size < REQUIRED) next.add(code);
      return next;
    });
  }

  const count = selected.size;
  const canSubmit = !closed && !submitting && count === REQUIRED && amount > 0 && amount <= MAX_BET;

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
    if (!confirm('Cancel this bet? Your stake will be refunded.')) return;
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
      onPlaced?.();
      loadData();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const presets = [100, 250, 500, 1000];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        <div className="row between center" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)' }}>🔮 Final Four — Pick 4</div>
            <div style={{ fontSize: 11, color: closed ? 'var(--loss)' : 'var(--ink-3)', marginTop: 2 }}>
              {closed ? 'Locked — quarterfinals started' : 'Most correct semifinalists wins the pool (ties split)'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            {Icon.close}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {pool?.total > 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, textAlign: 'center' }}>
              Pool: {fmtMoney(pool.total)} · {pool.bettorCount} player{pool.bettorCount !== 1 ? 's' : ''}
            </div>
          )}

          {myBet && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
            }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--win)' }}>
                Your picks ({fmtMoney(myBet.amount)}): {myBet.pick.split(',').map(c => getTeam(c).flag).join(' ')}
              </span>
              {!closed && (
                <button onClick={handleCancel} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          )}

          <div className="row between center" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Teams still alive — pick exactly 4</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: count === REQUIRED ? 'var(--win)' : count > 0 ? 'var(--gold)' : 'var(--ink-3)' }}>
              {count} / {REQUIRED}
            </span>
          </div>

          {alive.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '18px 0', fontSize: 12, color: 'var(--ink-3)' }}>
              Knockout bracket still loading — try again shortly.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
              {alive.map(code => {
                const team = getTeam(code);
                const isSel = selected.has(code);
                const disabled = closed || (!isSel && count >= REQUIRED);
                return (
                  <button
                    key={code}
                    disabled={disabled}
                    onClick={() => toggleTeam(code)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
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

          {picks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>EVERYONE&apos;S PICKS</div>
              {picks.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{p.displayName}</span>
                  <span style={{ fontSize: 13 }}>{(p.pick || '').split(',').map(c => getTeam(c).flag).join(' ')}</span>
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
                min={100} max={MAX_BET} step={50}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                style={{ marginBottom: 8 }}
              />
              <div className="amount-presets" style={{ marginBottom: 10 }}>
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
            </div>
          )}
        </div>

        {!closed && (
          <button className="btn primary block lg" style={{ flexShrink: 0, marginTop: 10 }} disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? 'Placing…'
              : count < REQUIRED ? `Pick ${REQUIRED - count} more`
              : myBet ? 'Update picks'
              : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`}
          </button>
        )}
      </div>
    </div>
  );
}
