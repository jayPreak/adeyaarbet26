'use client';

import { useState, useEffect, useMemo } from 'react';
import { fmtMoney, MAX_BET } from '@/lib/currency';
import { getSpecial } from '@/lib/specials';

const GB = getSpecial('golden_boot');

export default function GoldenBootBetModal({ open, onClose, user, onPlaced }) {
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [pool, setPool] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSearch('');
    const url = `/api/special-bet?match_id=GOLDEN_BOOT&kind=golden_boot${user ? `&user_id=${user.id}` : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setPool(data.pool);
        setMyBets(data.myBets || []);
      })
      .catch(() => {});
  }, [open, user]);

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    let opts = GB.options;
    if (q) opts = opts.filter(o => o.label.toLowerCase().includes(q) || o.country.toLowerCase().includes(q));
    // Sort by pool size descending, then alphabetical
    return [...opts].sort((a, b) => {
      const aPool = pool?.byOption?.[a.value] || 0;
      const bPool = pool?.byOption?.[b.value] || 0;
      if (bPool !== aPool) return bPool - aPool;
      return a.label.localeCompare(b.label);
    });
  }, [search, pool]);

  if (!open) return null;

  const deadline = new Date(GB.deadlineTs);
  const now = new Date();
  const closed = now >= deadline;
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));

  const myPicks = myBets.map(b => b.pick);
  const alreadyBetOnSelected = selected && myBets.find(b => b.pick === selected);
  const isChangeAmount = alreadyBetOnSelected && alreadyBetOnSelected.amount !== amount;
  const canSubmit = !submitting && !closed && !!selected && amount > 0 && amount <= MAX_BET && (!alreadyBetOnSelected || isChangeAmount);

  const handlePlace = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/special-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId: 'GOLDEN_BOOT', kind: 'golden_boot', pick: selected, amount, multiPick: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refresh bets
      const url = `/api/special-bet?match_id=GOLDEN_BOOT&kind=golden_boot&user_id=${user.id}`;
      const r2 = await fetch(url);
      const d2 = await r2.json();
      setPool(d2.pool);
      setMyBets(d2.myBets || []);
      setSelected(null);
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

  const total = pool?.total || 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>👟 Golden Boot</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
          Who wins the Golden Boot? Pool: {fmtMoney(total)}
        </div>
        <div style={{ fontSize: 11, color: closed ? 'var(--hot)' : 'var(--gold)', marginBottom: 12 }}>
          {closed ? 'Betting closed' : `Closes in ${daysLeft}d · Multi-pick allowed`}
        </div>

        {/* My existing bets */}
        {myBets.length > 0 && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Your bets ({myBets.length})</div>
            {myBets.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--ink)' }}>{GB.formatPick(b.pick)} · {fmtMoney(b.amount)}</span>
                {!closed && (
                  <button onClick={() => handleCancel(b.id)} style={{ fontSize: 10, color: 'var(--hot)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        {!closed && (
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              color: 'var(--ink)', marginBottom: 12, outline: 'none',
            }}
          />
        )}

        {/* Player grid */}
        {!closed && (
          <div style={{ maxHeight: 260, overflow: 'auto', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredOptions.map(opt => {
                const isActive = selected === opt.value;
                const isMine = myPicks.includes(opt.value);
                const poolAmt = pool?.byOption?.[opt.value] || 0;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 8,
                      background: isActive ? 'rgba(0,255,133,0.1)' : 'var(--surface-2)',
                      border: isActive ? '1.5px solid var(--gold)' : isMine ? '1px solid rgba(0,255,133,0.3)' : '1px solid var(--line)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--gold)' : 'var(--ink)' }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>{opt.country}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {poolAmt > 0 && fmtMoney(poolAmt)}
                      {isMine && <span style={{ marginLeft: 4, color: 'var(--gold)' }}>✓</span>}
                    </div>
                  </button>
                );
              })}
              {filteredOptions.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 12, textAlign: 'center' }}>No players match "{search}"</div>
              )}
            </div>
          </div>
        )}

        {/* Amount picker */}
        {!closed && selected && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
              Amount for {GB.options.find(o => o.value === selected)?.label || selected}
            </div>
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

        {error && <div style={{ fontSize: 12, color: 'var(--hot)', marginBottom: 12 }}>{error}</div>}

        {!closed && selected && (
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
            {submitting ? 'Placing...' : alreadyBetOnSelected ? 'Change amount' : 'Place bet'}
          </button>
        )}
      </div>
    </div>
  );
}
