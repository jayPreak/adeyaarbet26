'use client';

import { useState, useEffect } from 'react';
import { GROUPS, getTeam } from '@/lib/data';
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

  const [selectedTeam, setSelectedTeam] = useState(myCupWinnerBet?.pick || null);
  const [amount, setAmount] = useState(myCupWinnerBet?.amount || 500);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedTeam(myCupWinnerBet?.pick || null);
      setAmount(myCupWinnerBet?.amount || 500);
      setError(null);
    }
  }, [open, myCupWinnerBet?.pick, myCupWinnerBet?.amount]);

  const maxAmount = Math.max(0, (balance || 0) + (myCupWinnerBet?.amount || 0));
  const hasBet = !!myCupWinnerBet;
  const isChange =
    hasBet && (selectedTeam !== myCupWinnerBet.pick || amount !== myCupWinnerBet.amount);
  const canSubmit =
    !closed && !submitting && !!selectedTeam && amount > 0 && amount <= maxAmount && (!hasBet || isChange);

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
      if (!res.ok) { setError(data.error || 'Failed to place bet'); return; }
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
    ? 'Placing…'
    : amount > maxAmount
    ? 'Insufficient balance'
    : !selectedTeam
    ? 'Pick a team'
    : hasBet
    ? (isChange ? 'Update pick' : 'Done')
    : `Bet ${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN')}`;

  // Always-clickable submit when locked-in: 'Done' just closes
  const finalCanSubmit = canSubmit;
  const finalOnClick = canSubmit ? handleSubmit : (hasBet && !isChange && !closed ? onClose : undefined);

  const presets = [250, 500, 1000, 2000].filter(p => p <= maxAmount);
  const sliderMax = Math.max(100, maxAmount);
  const presetCap = presets.length > 0 ? Math.max(...presets) : 100;

  return (
    <div className="sheet-backdrop cup-modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Header */}
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>
                Pick the World Cup winner
              </div>
              <div style={{ fontSize: 11, color: closed ? 'var(--loss)' : 'var(--ink-3)', marginTop: 3 }}>
                {closed ? 'Locked in — betting closed' : `Closes in ${formatCountdown(cd)} · 1h before kickoff`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              color: 'var(--ink-2)', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            {Icon.close}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="cup-modal__body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginTop: 8, paddingBottom: 4 }}>
          {hasBet && (
            <div className="cup-modal__current">
              <Flag code={myCupWinnerBet.pick} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                  Your current pick
                </div>
                <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getTeam(myCupWinnerBet.pick).name} · {fmtMoney(myCupWinnerBet.amount)}
                </div>
              </div>
              {!closed && (
                <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  Tap to change
                </span>
              )}
            </div>
          )}

          {GROUPS.map(g => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>Group {g.id}</div>
              <div className="cup-modal__grid">
                {g.teams.map(t => {
                  const team = getTeam(t.code);
                  const isSelected = selectedTeam === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={closed}
                      onClick={() => setSelectedTeam(t.code)}
                      className={'cup-team' + (isSelected ? ' cup-team--selected' : '')}
                    >
                      <Flag code={t.code} size="sm" />
                      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <div className="cup-team__name">{team.name}</div>
                        <div className="cup-team__code">{t.code}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="cup-modal__footer">
          {!closed && (
            <>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="eyebrow" style={{ margin: 0 }}>Stake</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  Available: {fmtMoney(maxAmount)}
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
                min={100}
                max={sliderMax}
                step={50}
                value={Math.min(amount, sliderMax)}
                onChange={e => setAmount(Number(e.target.value))}
              />
              {presets.length > 0 && (
                <div className="cup-modal__presets">
                  {presets.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={amount === p ? 'active' : ''}
                    >
                      {CURRENCY_SYMBOL}{p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 10, borderRadius: 8,
              background: 'var(--hot-soft)', border: '1px solid rgba(255,61,127,0.3)',
              color: 'var(--loss)', fontSize: 12, lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={finalOnClick}
            disabled={!finalCanSubmit && !finalOnClick}
            className="cup-modal__submit"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      <style>{`
        .cup-modal .sheet {
          background: #0B0D11;
          color: #F2F3F5;
          padding-bottom: 0;
        }
        .cup-modal__body {
          padding-right: 2px;
        }
        .cup-modal__current {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 12px; margin-bottom: 14px;
          background: rgba(0,255,133,0.10);
          border: 1px solid rgba(0,255,133,0.45);
          border-radius: 12px;
        }
        .cup-modal__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .cup-team {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 11px;
          border-radius: 12px;
          background: #1A1D24;
          border: 1px solid rgba(255,255,255,0.10);
          color: #F2F3F5;
          cursor: pointer;
          transition: transform 0.08s ease, border-color 0.12s ease, background 0.12s ease;
          text-align: left;
          min-width: 0;
        }
        .cup-team:hover { border-color: rgba(255,255,255,0.22); background: #20242C; }
        .cup-team:active { transform: scale(0.97); }
        .cup-team:disabled { cursor: not-allowed; opacity: 0.4; }
        .cup-team--selected {
          background: rgba(0,255,133,0.14);
          border-color: #00FF85;
          box-shadow: 0 0 0 1px rgba(0,255,133,0.4) inset;
        }
        .cup-team__name {
          font-size: 13px; font-weight: 600; color: #F2F3F5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.2;
        }
        .cup-team__code {
          font-family: var(--font-mono); font-size: 10px; color: #8089A0;
          margin-top: 2px;
        }
        .cup-modal__footer {
          flex-shrink: 0;
          padding: 14px 0 max(16px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(255,255,255,0.08);
          background: #0B0D11;
          margin-top: 6px;
        }
        .cup-modal__slider {
          appearance: none; -webkit-appearance: none;
          width: 100%; height: 8px;
          background: #2A2F39; border-radius: 4px; outline: none;
          margin-bottom: 12px;
          display: block;
        }
        .cup-modal__slider::-webkit-slider-thumb {
          appearance: none; -webkit-appearance: none;
          width: 26px; height: 26px;
          background: #00FF85; border-radius: 50%;
          border: 3px solid #0B0D11;
          box-shadow: 0 2px 10px rgba(0,255,133,0.45);
          cursor: pointer;
        }
        .cup-modal__slider::-moz-range-thumb {
          width: 26px; height: 26px;
          background: #00FF85; border-radius: 50%;
          border: 3px solid #0B0D11;
          box-shadow: 0 2px 10px rgba(0,255,133,0.45);
          cursor: pointer;
        }
        .cup-modal__presets {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
          margin-bottom: 10px;
        }
        .cup-modal__presets button {
          background: #1A1D24; border: 1px solid rgba(255,255,255,0.10);
          padding: 9px 0; border-radius: 10px;
          font-family: var(--font-mono); font-weight: 600; font-size: 12.5px;
          color: #F2F3F5; cursor: pointer;
        }
        .cup-modal__presets button.active {
          background: rgba(0,255,133,0.14);
          border-color: #00FF85;
          color: #00FF85;
        }
        .cup-modal__submit {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          font-family: var(--font-display);
          font-weight: 700; font-size: 15px;
          border: none; cursor: pointer;
          background: #00FF85; color: #051912;
          transition: transform 0.08s ease;
        }
        .cup-modal__submit:active:not(:disabled) { transform: scale(0.985); }
        .cup-modal__submit:disabled {
          background: #1F2229; color: #5B6473; cursor: not-allowed;
        }
        @media (min-width: 640px) {
          .cup-modal__grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .cup-modal .sheet {
            max-width: 560px;
            max-height: 86vh;
          }
          .cup-modal__grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 6px;
          }
          .cup-team { padding: 9px 10px; }
        }
      `}</style>
    </div>
  );
}
