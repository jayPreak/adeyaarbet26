'use client';

import { useState, useEffect } from 'react';
import { fmtMoney, MAX_BET } from '@/lib/currency';
import { getSpecial } from '@/lib/specials';
import { fetchSpecialDirect } from '@/lib/specialsQuery';

const H2H = getSpecial('h2h');

export default function H2HBetModal({ open, onClose, user, onPlaced }) {
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [pool, setPool] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let cancelled = false;
    const apply = (data) => {
      if (cancelled || !data) return;
      setPool(data.pool);
      setMyBets(data.myBets || []);
      if (data.myBets?.length > 0) {
        setSelected(data.myBets[0].pick);
        setAmount(data.myBets[0].amount);
      }
    };
    (async () => {
      try {
        const direct = await fetchSpecialDirect({ matchId: 'MESSI_V_RONALDO', kind: 'h2h', userId: user?.id });
        if (direct) return apply(direct);
      } catch { /* fall through */ }
      try {
        const url = `/api/special-bet?match_id=MESSI_V_RONALDO&kind=h2h${user ? `&user_id=${user.id}` : ''}`;
        const res = await fetch(url);
        apply(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  if (!open) return null;

  const deadline = new Date(H2H.deadlineTs);
  const now = new Date();
  const closed = now >= deadline;
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));

  const hasBet = myBets.length > 0;
  const isChange = hasBet && (selected !== myBets[0]?.pick || amount !== myBets[0]?.amount);
  const canSubmit = !submitting && !closed && !!selected && amount > 0 && amount <= MAX_BET && (!hasBet || isChange);

  const handlePlace = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: 'MESSI_V_RONALDO', kind: 'h2h', pick: selected, amount, multiPick: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPlaced?.();
      onClose();
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
      setMyBets([]);
      setSelected(null);
      onPlaced?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const total = pool?.total || 0;
  const messiPool = pool?.byOption?.messi || 0;
  const ronaldoPool = pool?.byOption?.ronaldo || 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>⚔️ Messi vs Ronaldo</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
          Who scores more goals in the 2026 World Cup? Pool: {fmtMoney(total)}
        </div>

        <div style={{ fontSize: 11, color: closed ? 'var(--hot)' : 'var(--gold)', marginBottom: 16 }}>
          {closed ? 'Betting closed' : `Closes in ${daysLeft}d`}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {H2H.options.map(opt => {
            const isActive = selected === opt.value;
            const poolAmt = pool?.byOption?.[opt.value] || 0;
            const pct = total > 0 ? Math.round((poolAmt / total) * 100) : 50;
            return (
              <button
                key={opt.value}
                onClick={() => !closed && setSelected(opt.value)}
                disabled={closed}
                style={{
                  flex: 1,
                  padding: '20px 12px',
                  borderRadius: 12,
                  background: isActive ? 'rgba(0,255,133,0.1)' : 'var(--surface-2)',
                  border: isActive ? '2px solid var(--gold)' : '1px solid var(--line)',
                  textAlign: 'center',
                  cursor: closed ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.value === 'messi' ? '🇦🇷' : '🇵🇹'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? 'var(--gold)' : 'var(--ink)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{pct}% · {fmtMoney(poolAmt)}</div>
              </button>
            );
          })}
        </div>

        {/* Resolution rules */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}>Resolution rules</summary>
          <ul style={{ fontSize: 10, color: 'var(--ink-3)', paddingLeft: 16, marginTop: 6, lineHeight: 1.6 }}>
            {H2H.resolutionRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </details>

        {!closed && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Amount</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[100, 250, 500, 1000, 2000].map(v => (
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
        )}

        {hasBet && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Your bet: {H2H.formatPick(myBets[0].pick)} · {fmtMoney(myBets[0].amount)}</span>
            {!closed && (
              <button onClick={() => handleCancel(myBets[0].id)} style={{ fontSize: 11, color: 'var(--hot)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: 'var(--hot)', marginBottom: 12 }}>{error}</div>}

        {!closed && (
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
            {submitting ? 'Placing...' : hasBet ? 'Change bet' : 'Place bet'}
          </button>
        )}
      </div>
    </div>
  );
}
