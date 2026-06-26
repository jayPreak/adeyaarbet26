'use client';

import { useState, useEffect } from 'react';
import { GROUPS, getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { Icon } from './index';

// Compute the current 3rd-place team for each group from live match data.
// Returns array of { code, group, pts, gf, ga } — one per group (12 total).
// Groups with no finished matches still appear with the first team as placeholder.
function computeCurrentThirds(matches) {
  return GROUPS.map(g => {
    const stats = {};
    for (const t of g.teams) {
      stats[t.code] = { code: t.code, pts: 0, gf: 0, ga: 0 };
    }
    for (const m of matches) {
      if (m.group !== g.id || m.status !== 'finished' || !m.score) continue;
      const [hg, ag] = m.score;
      const h = stats[m.home], a = stats[m.away];
      if (!h || !a) continue;
      h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
      if (hg > ag)      { h.pts += 3; }
      else if (ag > hg) { a.pts += 3; }
      else              { h.pts += 1; a.pts += 1; }
    }
    const sorted = Object.values(stats).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
    // Return 3rd-place team (index 2), or last team if fewer than 3 played yet
    const third = sorted[2] || sorted[sorted.length - 1];
    return { ...third, group: g.id };
  });
}

const DEADLINE_TS = new Date('2026-06-26T18:59:00Z').getTime();
const REQUIRED = 8;

function useCountdown(targetTs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, targetTs - now);
  const done = diff === 0;
  return {
    diff, done,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

function fmtCd({ diff, days, hours, mins, secs }) {
  if (diff === 0) return 'closed';
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function ThirdPlaceQualifierBetModal({ open, onClose, user, onPlaced, matches = [] }) {
  const cd = useCountdown(DEADLINE_TS);
  const closed = cd.done;

  const [myBet, setMyBet] = useState(null);
  const [pool, setPool] = useState(null);
  const [picks, setPicks] = useState([]);

  const [selected, setSelected] = useState(new Set());
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('pick'); // 'pick' | 'picks'
  const [justPlaced, setJustPlaced] = useState(false);

  async function loadData() {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/third-place-qualifier-bet?user_id=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMyBet(data.myBet || null);
      setPool(data.pool || null);
      setPicks(data.picks || []);
      if (data.myBet?.pick) {
        setSelected(new Set(data.myBet.pick.split(',')));
        setAmount(data.myBet.amount);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (open) {
      setError(null);
      setJustPlaced(false);
      setView('pick');
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleTeam(code) {
    if (closed) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else if (next.size < REQUIRED) {
        next.add(code);
      }
      return next;
    });
  }

  const count = selected.size;
  const canSubmit = !closed && !submitting && count === REQUIRED && amount > 0 && amount <= MAX_BET;
  const hasBet = !!myBet;
  const isChange = hasBet && (
    [...selected].sort().join(',') !== myBet.pick ||
    amount !== myBet.amount
  );

  async function handleSubmit() {
    if (!user || count !== REQUIRED) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/third-place-qualifier-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          picks: [...selected],
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to place bet'); return; }
      setJustPlaced(true);
      setView('picks');
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
    setError(null);
    try {
      const res = await fetch('/api/third-place-qualifier-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betId: myBet.id }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Cancel failed'); return; }
      setMyBet(null);
      setSelected(new Set());
      setAmount(500);
      setView('pick');
      onPlaced?.();
      loadData();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const thirds = computeCurrentThirds(matches);

  if (!open) return null;

  const presets = [250, 500, 1000, 2000].filter(p => p <= MAX_BET);

  const submitLabel = closed
    ? 'Betting closed'
    : submitting ? 'Placing…'
    : amount > MAX_BET ? `Max ${CURRENCY_SYMBOL}${MAX_BET.toLocaleString('en-IN')}`
    : count < REQUIRED ? `Pick ${REQUIRED - count} more team${REQUIRED - count !== 1 ? 's' : ''}`
    : hasBet ? (isChange ? 'Update picks' : 'Done')
    : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`;

  const finalOnClick =
    canSubmit ? handleSubmit :
    (hasBet && !isChange && !closed) ? onClose :
    undefined;

  return (
    <div className="sheet-backdrop tpq-modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>🥉</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1, fontFamily: 'var(--font-display)' }}>
                {view === 'picks'
                  ? (justPlaced ? '🎉 Picks locked in!' : "Everyone's picks")
                  : '3rd Place Race — Pick 8'}
              </div>
              <div style={{ fontSize: 11, color: closed ? 'var(--loss)' : 'var(--ink-3)', marginTop: 3 }}>
                {closed
                  ? 'Locked — betting closed'
                  : `Closes ${fmtCd(cd)} · All 8 must be correct`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              color: 'var(--ink-2)', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            {Icon.close}
          </button>
        </div>

        {/* View switcher */}
        {(hasBet || picks.length > 0) && (
          <div className="tpq-modal__viewswitch">
            <button
              type="button"
              className={view === 'pick' ? 'active' : ''}
              onClick={() => setView('pick')}
            >
              {hasBet ? 'Change picks' : 'Pick teams'}
            </button>
            <button
              type="button"
              className={view === 'picks' ? 'active' : ''}
              onClick={() => { setView('picks'); loadData(); }}
            >
              Everyone's picks {picks.length > 0 && `(${picks.length})`}
            </button>
          </div>
        )}

        {/* Pool summary bar */}
        {pool && pool.total > 0 && (
          <div style={{
            margin: '10px 0 4px',
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,193,7,0.07)',
            border: '1px solid rgba(255,193,7,0.18)',
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--gold)' }}>
                {CURRENCY_SYMBOL}{pool.total.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>pool</div>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>
              {pool.bettorCount} player{pool.bettorCount !== 1 ? 's' : ''} in — all-correct players split pool
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="tpq-modal__body">
          {view === 'picks' ? (
            <PicksView picks={picks} currentUserId={user?.id} />
          ) : (
            <>
              {/* Current bet banner */}
              {hasBet && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', marginBottom: 12,
                  background: 'rgba(0,255,133,0.10)',
                  border: '1px solid rgba(0,255,133,0.45)',
                  borderRadius: 12,
                }}>
                  <span style={{ fontSize: 18 }}>🥉</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                      Your current picks · {fmtMoney(myBet.amount)}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12, marginTop: 2 }}>
                      {myBet.pick.split(',').map(c => getTeam(c).flag).join(' ')}
                    </div>
                  </div>
                  {!closed && (
                    <button
                      onClick={handleCancel}
                      disabled={submitting}
                      style={{
                        padding: '5px 10px', borderRadius: 8,
                        background: 'rgba(255,61,127,0.12)',
                        border: '1px solid rgba(255,61,127,0.3)',
                        color: 'var(--loss)', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {/* Selection counter */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  Tap to select/deselect — pick exactly 8
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14,
                  color: count === REQUIRED ? 'var(--win)' : count > 0 ? 'var(--gold)' : 'var(--ink-3)',
                }}>
                  {count} / {REQUIRED}
                </div>
              </div>

              {/* 12 third-place teams — one per group */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {thirds.map(t => {
                  const team = getTeam(t.code);
                  const isSel = selected.has(t.code);
                  const isDisabled = closed || (!isSel && count >= REQUIRED);
                  const gd = t.gf - t.ga;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleTeam(t.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 11px', borderRadius: 10,
                        background: isSel ? 'rgba(54,211,153,0.14)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isSel ? 'rgba(54,211,153,0.7)' : 'rgba(255,255,255,0.08)'}`,
                        boxShadow: isSel ? '0 0 0 1px rgba(54,211,153,0.3) inset' : 'none',
                        color: 'var(--ink)', cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled && !isSel ? 0.35 : 1,
                        transition: 'border-color 0.1s, background 0.1s',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{team.flag}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: isSel ? 'var(--win)' : 'var(--ink)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {team.name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 1 }}>
                          Grp {t.group} · {t.pts}pts · GD {gd >= 0 ? '+' : ''}{gd}
                        </div>
                      </div>
                      {isSel && (
                        <svg style={{ flexShrink: 0, color: 'var(--win)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="tpq-modal__footer">
          {view === 'picks' ? (
            <button onClick={onClose} className="tpq-modal__submit">Done</button>
          ) : (
            <>
              {!closed && (
                <>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span className="eyebrow" style={{ margin: 0 }}>Stake</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      Max: {fmtMoney(MAX_BET)}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30,
                    color: 'var(--ink)', textAlign: 'center', lineHeight: 1.1, marginBottom: 6,
                  }}>
                    {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
                  </div>
                  <input
                    type="range"
                    className="cup-modal__slider"
                    min={100} max={Math.max(100, MAX_BET)} step={50}
                    value={Math.min(amount, MAX_BET)}
                    onChange={e => setAmount(Number(e.target.value))}
                  />
                  <div className="cup-modal__presets">
                    {presets.map(p => (
                      <button
                        key={p} type="button"
                        onClick={() => setAmount(p)}
                        className={amount === p ? 'active' : ''}
                      >
                        {CURRENCY_SYMBOL}{p}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: 10, borderRadius: 8,
                  background: 'rgba(255,61,127,0.08)', border: '1px solid rgba(255,61,127,0.3)',
                  color: 'var(--loss)', fontSize: 12, lineHeight: 1.4,
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={finalOnClick}
                disabled={!finalOnClick && !canSubmit}
                className="tpq-modal__submit"
              >
                {submitLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .tpq-modal .sheet {
          background: #0B0D11;
          color: #F2F3F5;
          padding-bottom: 0;
        }
        .tpq-modal__body {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          margin-top: 8px; padding-bottom: 4px; padding-right: 2px;
        }
        .tpq-modal__viewswitch {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
          padding: 3px; margin-top: 8px;
          background: #14171D;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
        }
        .tpq-modal__viewswitch button {
          padding: 8px 10px; border: none; border-radius: 8px;
          background: transparent; color: #8089A0;
          font-weight: 600; font-size: 12px; cursor: pointer;
        }
        .tpq-modal__viewswitch button.active {
          background: rgba(54,211,153,0.14); color: #36D399;
        }
        .tpq-modal__footer {
          flex-shrink: 0;
          padding: 14px 0 max(16px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(255,255,255,0.08);
          background: #0B0D11;
          margin-top: 6px;
        }
        .tpq-modal__submit {
          width: 100%; padding: 14px 16px; border-radius: 14px;
          font-family: var(--font-display);
          font-weight: 700; font-size: 15px;
          border: none; cursor: pointer;
          background: #36D399; color: #051912;
          transition: transform 0.08s ease;
        }
        .tpq-modal__submit:active:not(:disabled) { transform: scale(0.985); }
        .tpq-modal__submit:disabled {
          background: #1F2229; color: #5B6473; cursor: not-allowed;
        }
        @media (min-width: 640px) {
          .tpq-modal .sheet { max-width: 520px; max-height: 88vh; }
        }
      `}</style>
    </div>
  );
}

function PicksView({ picks, currentUserId }) {
  if (picks.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        No picks yet — be the first!
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {picks.map((p, i) => {
        const isMe = p.userId === currentUserId;
        const teams = p.pick ? p.pick.split(',').map(c => getTeam(c)) : [];
        return (
          <div
            key={i}
            style={{
              padding: '12px', marginBottom: 8, borderRadius: 12,
              background: isMe ? 'rgba(54,211,153,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isMe ? 'rgba(54,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--ink)',
                backgroundImage: p.avatarUrl ? `url(${p.avatarUrl})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }}>
                {!p.avatarUrl && p.displayName[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: isMe ? 'var(--win)' : 'var(--ink)' }}>
                  {p.displayName}{isMe && ' (you)'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                  {fmtMoney(p.amount)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {teams.map(t => (
                <span
                  key={t.code}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 7px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    fontSize: 11, color: 'var(--ink-2)',
                  }}
                >
                  {t.flag} {t.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
