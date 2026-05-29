'use client';

import { useState, useEffect, useMemo } from 'react';
import { TEAM, GROUPS, getTeam } from '@/lib/data';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';
import { Flag, Icon } from './index';

function useCountdown(targetTs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, targetTs - now);
  return {
    diff,
    done: diff === 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

function formatCountdown({ diff, days, hours, mins, secs }) {
  if (diff === 0) return 'closed';
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function CupWinnerBetModal({ open, onClose, user, balance, myCupWinnerBet, onPlaced }) {
  const cd = useCountdown(CUP_WINNER_DEADLINE_TS);
  const closed = cd.done;

  const initialTeam = myCupWinnerBet?.pick || null;
  const initialAmount = myCupWinnerBet?.amount || 500;

  const [selectedTeam, setSelectedTeam] = useState(initialTeam);
  const [amount, setAmount] = useState(initialAmount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedTeam(myCupWinnerBet?.pick || null);
      setAmount(myCupWinnerBet?.amount || 500);
      setError(null);
    }
  }, [open, myCupWinnerBet?.pick, myCupWinnerBet?.amount]);

  const maxAmount = (balance || 0) + (myCupWinnerBet?.amount || 0);
  const hasBet = !!myCupWinnerBet;
  const isChange =
    hasBet &&
    (selectedTeam !== myCupWinnerBet.pick || amount !== myCupWinnerBet.amount);
  const canSubmit =
    !closed &&
    !submitting &&
    !!selectedTeam &&
    amount > 0 &&
    amount <= maxAmount &&
    (!hasBet || isChange);

  async function handleSubmit() {
    if (!user || !selectedTeam) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cup-winner-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, teamCode: selectedTeam, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to place bet');
        return;
      }
      onPlaced?.(data);
      onClose?.();
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const submitLabel = closed
    ? 'Betting closed'
    : submitting
    ? 'Placing...'
    : amount > maxAmount
    ? 'Insufficient balance'
    : !selectedTeam
    ? 'Pick a team'
    : hasBet
    ? (isChange ? 'Update pick' : 'No changes')
    : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a2e22',
          border: '1px solid #1a4a3a',
          borderRadius: 16,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>🏆</span>
              Pick the World Cup Winner
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
              }}
            >
              {Icon.close}
            </button>
          </div>
          <div style={{ fontSize: 12, color: closed ? '#f87171' : 'rgba(255,255,255,0.6)' }}>
            {closed
              ? '⏱ Betting closed — your pick is locked in'
              : `⏱ Closes in ${formatCountdown(cd)} (1h before kickoff)`}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {hasBet && (
            <div
              style={{
                marginBottom: 14, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <Flag code={myCupWinnerBet.pick} size="sm" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Your current pick</div>
                <div style={{ fontWeight: 700, color: '#fff' }}>
                  {getTeam(myCupWinnerBet.pick).name} · {fmtMoney(myCupWinnerBet.amount)}
                </div>
              </div>
              {!closed && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Tap a team to change</div>}
            </div>
          )}

          {/* Group sections */}
          {GROUPS.map(g => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)', marginBottom: 6,
              }}>
                Group {g.id}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {g.teams.map(t => {
                  const team = getTeam(t.code);
                  const isSelected = selectedTeam === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={closed}
                      onClick={() => setSelectedTeam(t.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: isSelected ? 'rgba(255,193,7,0.16)' : 'rgba(255,255,255,0.04)',
                        border: isSelected ? '1px solid rgba(255,193,7,0.55)' : '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        cursor: closed ? 'not-allowed' : 'pointer',
                        opacity: closed && !isSelected ? 0.4 : 1,
                        textAlign: 'left',
                      }}
                    >
                      <Flag code={t.code} size="sm" />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {team.name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                          {t.code}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: amount + submit */}
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          {!closed && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                  Stake
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  Available: {fmtMoney(maxAmount)}
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
                color: '#fff', textAlign: 'center', marginBottom: 8,
              }}>
                {CURRENCY_SYMBOL}{amount.toLocaleString('en-IN')}
              </div>
              <input
                type="range"
                min={100}
                max={Math.max(100, maxAmount)}
                step={50}
                value={Math.min(amount, Math.max(100, maxAmount))}
                onChange={e => setAmount(Number(e.target.value))}
                disabled={closed}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[250, 500, 1000, 2000].filter(p => p <= maxAmount).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      fontSize: 12, fontWeight: 600,
                      borderRadius: 8,
                      background: amount === p ? 'rgba(255,193,7,0.16)' : 'rgba(255,255,255,0.04)',
                      border: amount === p ? '1px solid rgba(255,193,7,0.55)' : '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', cursor: 'pointer',
                    }}
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
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
              color: '#f87171', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              background: canSubmit ? 'linear-gradient(135deg, #ffc107, #ff9800)' : 'rgba(255,255,255,0.08)',
              color: canSubmit ? '#0a1f17' : 'rgba(255,255,255,0.4)',
              border: 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
