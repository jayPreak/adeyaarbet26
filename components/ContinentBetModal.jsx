'use client';

import { useState, useEffect } from 'react';
import { fmtMoney, MAX_BET } from '@/lib/currency';
import { CONFEDERATION_OPTIONS } from '@/lib/specials';
import { TEAM } from '@/lib/data';

export default function ContinentBetModal({ open, onClose, user, onPlaced }) {
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [pool, setPool] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const url = `/api/special-bet?match_id=CONTINENT&kind=continent${user ? `&user_id=${user.id}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setPool(data.pool);
        setMyBets(data.myBets || []);
        if (data.myBets?.length > 0) {
          setSelected(data.myBets[0].pick);
          setAmount(data.myBets[0].amount);
        }
      })
      .catch(() => {});
  }, [open, user]);

  if (!open) return null;

  const hasBet = myBets.length > 0;
  const isChange = hasBet && (selected !== myBets[0]?.pick || amount !== myBets[0]?.amount);
  const canSubmit = !submitting && !!selected && amount > 0 && amount <= MAX_BET && (!hasBet || isChange);

  const handlePlace = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: 'CONTINENT', kind: 'continent', pick: selected, amount, multiPick: false }),
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

  const total = pool?.total || 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🌍 Winning Continent</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
          Which confederation will the World Cup winner belong to? Pool: {fmtMoney(total)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CONFEDERATION_OPTIONS.map(conf => {
            const isActive = selected === conf.value;
            const poolAmt = pool?.byOption?.[conf.value] || 0;
            const teamNames = conf.teams.slice(0, 6).map(c => TEAM[c]?.name || c).join(', ');
            return (
              <button
                key={conf.value}
                onClick={() => setSelected(conf.value)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(0,255,133,0.1)' : 'var(--surface-2)',
                  border: isActive ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? 'var(--gold)' : 'var(--ink)' }}>{conf.label}</span>
                  {poolAmt > 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmtMoney(poolAmt)}</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>{teamNames}{conf.teams.length > 6 ? '...' : ''}</div>
              </button>
            );
          })}
        </div>

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
          {submitting ? 'Placing...' : hasBet ? 'Change bet' : 'Place bet'}
        </button>
      </div>
    </div>
  );
}
