'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fmtMoney, MAX_BET } from '@/lib/currency';
import { HALFTIME_PERFORMERS } from '@/lib/specials';

function performerSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function poolId(name) {
  return `HT_${performerSlug(name).toUpperCase()}`;
}

export default function HalftimeBetModal({ open, onClose, user, onPlaced, initialPerformer }) {
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [pick, setPick] = useState('yes'); // 'yes' or 'no'
  const [amount, setAmount] = useState(250);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [poolData, setPoolData] = useState({}); // keyed by performer slug
  const [myBets, setMyBets] = useState([]); // all user's halftime bets across performers

  const [poolSummary, setPoolSummary] = useState({}); // keyed by HT_SLUG -> { total, bettorCount }

  useEffect(() => {
    if (!open || !user) return;
    setError(null);
    if (initialPerformer) {
      setSelectedPerformer(initialPerformer);
    }
    // Fetch aggregate pool data for sorting
    fetch('/api/special-bet?match_id=HT_ALL&kind=halftime&summary=true')
      .then(r => r.json())
      .then(data => { if (data.performers) setPoolSummary(data.performers); })
      .catch(() => {});
  }, [open, user, initialPerformer]);

  useEffect(() => {
    if (!open || !selectedPerformer) return;
    const mid = poolId(selectedPerformer);
    const url = `/api/special-bet?match_id=${mid}&kind=halftime${user ? `&user_id=${user.id}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setPoolData(prev => ({ ...prev, [selectedPerformer]: data.pool }));
        setMyBets(prev => {
          const filtered = prev.filter(b => b.matchId !== mid);
          const newBets = (data.myBets || []).map(b => ({ ...b, matchId: mid, performer: selectedPerformer }));
          return [...filtered, ...newBets];
        });
        if (data.myBets?.length > 0) {
          setPick(data.myBets[0].pick);
          setAmount(data.myBets[0].amount);
        } else {
          setPick('yes');
          setAmount(250);
        }
      })
      .catch(() => {});
  }, [open, selectedPerformer, user]);

  const myBetOnSelected = useMemo(() => {
    if (!selectedPerformer) return null;
    const mid = poolId(selectedPerformer);
    return myBets.find(b => b.matchId === mid) || null;
  }, [myBets, selectedPerformer]);

  if (!open) return null;

  const handlePlace = async () => {
    if (!selectedPerformer || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const mid = poolId(selectedPerformer);
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: mid, kind: 'halftime', pick, amount, multiPick: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refresh this performer's pool
      setMyBets(prev => {
        const filtered = prev.filter(b => b.matchId !== mid);
        return [...filtered, { id: data.id, pick, amount, matchId: mid, performer: selectedPerformer }];
      });
      onPlaced?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (betId) => {
    try {
      const res = await fetch('/api/special-bet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, betId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setMyBets(prev => prev.filter(b => b.id !== betId));
      onPlaced?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const pool = selectedPerformer ? poolData[selectedPerformer] : null;
  const isChange = myBetOnSelected && (pick !== myBetOnSelected.pick || amount !== myBetOnSelected.amount);
  const canSubmit = !submitting && !!selectedPerformer && amount > 0 && amount <= MAX_BET && (!myBetOnSelected || isChange);

  // List of performers user has already bet on
  const bettedPerformers = new Set(myBets.map(b => b.performer));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🎤 Halftime Show</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,200,0,0.06)', borderRadius: 8, border: '1px solid rgba(255,200,0,0.15)' }}>
          ⚠️ Only counts if they are one of the MAIN performers — guest appearances, introductions, and side cameos do NOT count.
        </div>

        {!selectedPerformer ? (
          // Performer grid — sorted by pool size (most bet on first), then alphabetical
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[...HALFTIME_PERFORMERS].sort((a, b) => {
              const aKey = `HT_${a.toLowerCase().replace(/[^a-z0-9]/g, '_').toUpperCase()}`;
              const bKey = `HT_${b.toLowerCase().replace(/[^a-z0-9]/g, '_').toUpperCase()}`;
              const aTotal = poolSummary[aKey]?.total || 0;
              const bTotal = poolSummary[bKey]?.total || 0;
              if (bTotal !== aTotal) return bTotal - aTotal;
              return a.localeCompare(b);
            }).map(name => {
              const hasBet = bettedPerformers.has(name);
              const pKey = `HT_${name.toLowerCase().replace(/[^a-z0-9]/g, '_').toUpperCase()}`;
              const poolAmt = poolSummary[pKey]?.total || 0;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedPerformer(name)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                    background: hasBet ? 'rgba(0,255,133,0.06)' : 'var(--surface-2)',
                    border: hasBet ? '1px solid rgba(0,255,133,0.2)' : '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: hasBet ? 'var(--gold)' : 'var(--ink)' }}>{name}</div>
                  {hasBet && <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>✓ Bet placed</div>}
                  {poolAmt > 0 && !hasBet && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{fmtMoney(poolAmt)} in pool</div>}
                </button>
              );
            })}
          </div>
        ) : (
          // Bet on specific performer
          <div>
            <button
              onClick={() => setSelectedPerformer(null)}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 12, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              ← All performers
            </button>

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedPerformer}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
              Will they appear? Pool: {fmtMoney(pool?.total || 0)}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['yes', 'no'].map(p => (
                <button
                  key={p}
                  onClick={() => setPick(p)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: pick === p ? (p === 'yes' ? 'rgba(0,255,133,0.12)' : 'rgba(255,61,127,0.12)') : 'var(--surface-2)',
                    border: pick === p ? `1.5px solid ${p === 'yes' ? 'var(--gold)' : 'var(--hot)'}` : '1px solid var(--line)',
                    color: pick === p ? (p === 'yes' ? 'var(--gold)' : 'var(--hot)') : 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  {p === 'yes' ? 'YES' : 'NO'}
                  {pool?.byOption?.[p] ? <div style={{ fontSize: 10, fontWeight: 500, marginTop: 2 }}>{fmtMoney(pool.byOption[p])}</div> : null}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Amount</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[100, 250, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: amount === v ? 'var(--gold)' : 'var(--surface-3)',
                      color: amount === v ? '#0a0a0a' : 'var(--ink)',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {fmtMoney(v)}
                  </button>
                ))}
              </div>
            </div>

            {myBetOnSelected && (
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
                Current bet: <strong>{myBetOnSelected.pick.toUpperCase()}</strong> · {fmtMoney(myBetOnSelected.amount)}
                <button
                  onClick={() => handleCancel(myBetOnSelected.id)}
                  style={{ marginLeft: 8, fontSize: 11, color: 'var(--hot)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 700 }}
                >
                  Cancel
                </button>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: 'var(--hot)', marginBottom: 12 }}>{error}</div>}

            <button
              onClick={handlePlace}
              disabled={!canSubmit}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: canSubmit ? 'var(--gold)' : 'var(--surface-3)',
                color: canSubmit ? '#0a0a0a' : 'var(--ink-3)',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Placing...' : myBetOnSelected ? 'Change bet' : `Bet ${pick.toUpperCase()} · ${fmtMoney(amount)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
