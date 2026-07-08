'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL, MAX_BET } from '@/lib/currency';
import { SCORELINE_OPTIONS, formatScorelinePick, formatOverUnderPick, formatPensPick, OU_LINE } from '@/lib/props';
import { useBetting } from '@/lib/BettingContext';
import { Icon, useBettingOpen } from './index';
import { fetchSpecialDirect } from '@/lib/specialsQuery';

const PRESETS = [50, 100, 250, 500];

function kindTabs(isKnockout) {
  return [
    { id: 'scoreline', label: '🎯 Exact Score' },
    { id: 'over_under', label: `⚖️ O/U ${OU_LINE}` },
    ...(isKnockout ? [{ id: 'pens', label: '🥅 Pens?' }] : []),
  ];
}

export default function MatchPropsSheet({ match, open, onClose }) {
  const { user, setToast, refreshData } = useBetting();
  const bettingOpen = useBettingOpen(match);
  const home = getTeam(match.home);
  const away = getTeam(match.away);
  const isKnockout = !!match.knockout || (match.id || '').includes('-');

  const [kind, setKind] = useState('scoreline');
  const [data, setData] = useState({}); // { [kind]: { pool, picks, myBets } }
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!match?.id) return;
    for (const k of ['scoreline', 'over_under', 'pens']) {
      (async () => {
        try {
          const direct = await fetchSpecialDirect({ matchId: match.id, kind: k, userId: user?.id });
          if (direct) { setData(prev => ({ ...prev, [k]: direct })); return; }
        } catch { /* fall through */ }
        try {
          const res = await fetch(`/api/special-bet?match_id=${match.id}&kind=${k}${user?.id ? `&user_id=${user.id}` : ''}`);
          const d = await res.json();
          setData(prev => ({ ...prev, [k]: d }));
        } catch { /* ignore */ }
      })();
    }
  }, [match?.id, user?.id]);

  useEffect(() => {
    if (open) { setPick(null); setKind('scoreline'); load(); }
  }, [open, load]);

  if (!open) return null;

  const cur = data[kind] || {};
  const pool = cur.pool || { total: 0, byOption: {} };
  const picks = cur.picks || [];
  const myBet = cur.myBets?.[0] || null;

  const options =
    kind === 'scoreline' ? SCORELINE_OPTIONS :
    kind === 'over_under' ? ['over', 'under'] :
    ['yes', 'no'];

  const fmtPick = (p) =>
    kind === 'scoreline' ? formatScorelinePick(p, home.code, away.code) :
    kind === 'over_under' ? formatOverUnderPick(p) :
    formatPensPick(p);

  // Parimutuel payout preview including my stake
  const sideAmt = (pool.byOption?.[pick] || 0) + amount;
  const potentialPayout = pick ? Math.floor((amount / sideAmt) * ((pool.total || 0) + amount)) : 0;

  async function place() {
    if (!user || !pick || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: match.id, kind, pick, amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to place bet');
      setToast(`Bet placed · ${fmtMoney(amount)} on ${fmtPick(pick)}`);
      setPick(null);
      load();
      refreshData();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelMine() {
    if (!user || !myBet || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betId: myBet.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Cancel failed');
      setToast(`Bet cancelled · ${fmtMoney(myBet.amount)} refunded`);
      load();
      refreshData();
    } catch (e) {
      setToast(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const optBtn = (active) => ({
    padding: '9px 4px', borderRadius: 9, fontSize: 12, fontWeight: 700,
    fontFamily: 'var(--font-mono)', cursor: 'pointer',
    background: active ? 'var(--gold-soft, rgba(212,175,55,0.15))' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
    color: active ? 'var(--gold)' : 'var(--ink)',
  });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        <div className="row between center" style={{ marginBottom: 8 }}>
          <div>
            <div className="eyebrow">Match props</div>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              {home.flag} {home.code} vs {away.code} {away.flag}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
            {Icon.close}
          </button>
        </div>

        {/* Kind tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kindTabs(isKnockout).length}, 1fr)`, gap: 6, marginBottom: 12 }}>
          {kindTabs(isKnockout).map(t => (
            <button
              key={t.id}
              onClick={() => { setKind(t.id); setPick(null); }}
              style={{
                padding: '9px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: kind === t.id ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${kind === t.id ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: kind === t.id ? 'var(--gold)' : 'var(--ink-2)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Market explainer */}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.4 }}>
            {kind === 'scoreline' && 'Pick the exact final score (extra time counts, penalty shootout doesn\'t). Winners split the pool — a lucky exact score can pay huge.'}
            {kind === 'over_under' && `Will the match (incl. extra time) have over or under ${OU_LINE} total goals?`}
            {kind === 'pens' && 'Will this knockout match be decided by a penalty shootout?'}
            {' '}If nobody picks the winning outcome, everyone is refunded.
          </div>

          {/* Pool summary */}
          {pool.total > 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, textAlign: 'center' }}>
              Pool: {fmtMoney(pool.total)} · {pool.bettorCount} bettor{pool.bettorCount !== 1 ? 's' : ''}
            </div>
          )}

          {/* My bet */}
          {myBet && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
            }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--win)' }}>
                Your bet: <b>{fmtMoney(myBet.amount)}</b> on <b>{fmtPick(myBet.pick)}</b>
              </span>
              {bettingOpen && (
                <button onClick={cancelMine} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--loss)', fontSize: 11, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Option picker */}
          {kind === 'scoreline' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 6 }}>
                {SCORELINE_OPTIONS.filter(o => !o.startsWith('other')).map(o => (
                  <button key={o} onClick={() => setPick(o)} style={optBtn(pick === o)}>
                    {o}
                    {pool.byOption?.[o] > 0 && <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 500 }}>{fmtMoney(pool.byOption[o])}</div>}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                {['other_home', 'other_away', 'other_draw'].map(o => (
                  <button key={o} onClick={() => setPick(o)} style={{ ...optBtn(pick === o), fontFamily: 'inherit', fontSize: 10.5 }}>
                    {formatScorelinePick(o, home.code, away.code)}
                    {pool.byOption?.[o] > 0 && <div style={{ fontSize: 9, color: 'var(--ink-3)', fontWeight: 500 }}>{fmtMoney(pool.byOption[o])}</div>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {options.map(o => (
                <button key={o} onClick={() => setPick(o)} style={{ ...optBtn(pick === o), fontFamily: 'inherit', padding: '14px 6px', fontSize: 13 }}>
                  {fmtPick(o)}
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500, marginTop: 2 }}>
                    {pool.byOption?.[o] > 0 ? fmtMoney(pool.byOption[o]) : '—'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Amount + payout preview */}
          {pick && bettingOpen && (
            <>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Amount</div>
              <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, marginBottom: 6 }}>
                {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
              </div>
              <input
                type="range" className="slider"
                min={50} max={MAX_BET} step={50}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                style={{ marginBottom: 10 }}
              />
              <div className="amount-presets" style={{ marginBottom: 12 }}>
                {PRESETS.map(p => (
                  <button key={p} className={amount === p ? 'active' : ''} onClick={() => setAmount(p)}>
                    {CURRENCY_SYMBOL}{p}
                  </button>
                ))}
              </div>
              {potentialPayout > 0 && (
                <div style={{
                  textAlign: 'center', marginBottom: 12, padding: '8px 0', borderRadius: 10,
                  background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>If {fmtPick(pick)} hits, you get at least</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--win)' }}>
                    {fmtMoney(potentialPayout)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>grows as more friends miss the pick</div>
                </div>
              )}
            </>
          )}

          {/* Everyone's picks */}
          {picks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>EVERYONE&apos;S PICKS</div>
              {picks.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)' }}>{p.displayName}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink)' }}>{fmtPick(p.pick)}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn primary block lg"
          style={{ flexShrink: 0, marginTop: 10 }}
          disabled={submitting || !bettingOpen || !pick}
          onClick={place}
        >
          {!bettingOpen ? 'Betting closed'
            : submitting ? 'Placing…'
            : !pick ? 'Pick an outcome'
            : myBet ? `Replace with ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} on ${fmtPick(pick)}`
            : `Place ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')} bet`}
        </button>
      </div>
    </div>
  );
}
