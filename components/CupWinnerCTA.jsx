'use client';

import { useState, useEffect } from 'react';
import { getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';
import { Flag } from './index';

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
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

export default function CupWinnerCTA({ myCupWinnerBet, onOpen }) {
  const cd = useCountdown(CUP_WINNER_DEADLINE_TS);
  const closed = cd.done;
  const hasBet = !!myCupWinnerBet;

  if (closed && !hasBet) return null;

  const team = hasBet ? getTeam(myCupWinnerBet.pick) : null;

  let title, subtitle, action;
  if (closed && hasBet) {
    title = `Locked on ${team.name}`;
    subtitle = `${fmtMoney(myCupWinnerBet.amount)} riding on the cup`;
    action = null;
  } else if (hasBet) {
    title = `Backing ${team.name}`;
    subtitle = `${fmtMoney(myCupWinnerBet.amount)} · changes close in ${formatCountdown(cd)}`;
    action = 'Change';
  } else {
    title = `Pick the World Cup winner`;
    subtitle = `Bet closes in ${formatCountdown(cd)} · 1h before kickoff`;
    action = 'Bet now';
  }

  const handleClick = (e) => {
    if (!action) return;
    e.stopPropagation?.();
    onOpen?.();
  };

  return (
    <>
      <div
        className={'cup-cta' + (closed ? ' cup-cta--locked' : '') + (action ? ' cup-cta--clickable' : '')}
        onClick={handleClick}
        role={action ? 'button' : undefined}
        tabIndex={action ? 0 : undefined}
        onKeyDown={action ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } } : undefined}
      >
        <div className="cup-cta__icon" aria-hidden>
          {hasBet ? <Flag code={myCupWinnerBet.pick} size="sm" /> : <span style={{ fontSize: 22 }}>🏆</span>}
        </div>
        <div className="cup-cta__body">
          <div className="cup-cta__title">
            {!hasBet && <span style={{ marginRight: 6 }}>🏆</span>}
            {title}
          </div>
          <div className="cup-cta__sub">{subtitle}</div>
        </div>
        {action && (
          <button
            type="button"
            className="cup-cta__btn"
            onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          >
            {action}
          </button>
        )}
      </div>

      <style>{`
        .cup-cta {
          margin: 10px 16px 14px;
          padding: 12px 14px;
          border-radius: var(--radius);
          background: linear-gradient(135deg, rgba(0,255,133,0.10), rgba(0,255,133,0.02));
          border: 1px solid rgba(0,255,133,0.32);
          display: flex; align-items: center; gap: 12px;
          position: relative;
          overflow: hidden;
        }
        .cup-cta::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at top right, rgba(0,255,133,0.10), transparent 60%);
          pointer-events: none;
        }
        .cup-cta--locked {
          background: var(--surface-2);
          border-color: var(--line);
        }
        .cup-cta--locked::before { display: none; }
        .cup-cta--clickable { cursor: pointer; }
        .cup-cta--clickable:active { transform: scale(0.995); }

        .cup-cta__icon {
          flex-shrink: 0;
          width: 38px; height: 38px;
          display: grid; place-items: center;
          border-radius: 10px;
          background: rgba(0,0,0,0.25);
        }

        .cup-cta__body {
          flex: 1; min-width: 0;
          position: relative;
        }
        .cup-cta__title {
          font-family: var(--font-display);
          font-weight: 700; font-size: 14px;
          color: var(--ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cup-cta__sub {
          font-size: 11.5px; color: var(--ink-2);
          margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .cup-cta__btn {
          flex-shrink: 0;
          padding: 8px 14px;
          border-radius: 10px;
          background: var(--gold);
          color: #0a0a0a;
          border: none;
          font-size: 12px; font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.2px;
          position: relative;
        }
        .cup-cta__btn:active { transform: scale(0.96); }

        @media (min-width: 1024px) {
          .cup-cta {
            margin: 16px 0 20px;
            padding: 16px 18px;
            gap: 14px;
          }
          .cup-cta__icon {
            width: 44px; height: 44px;
          }
          .cup-cta__title { font-size: 16px; }
          .cup-cta__sub { font-size: 12.5px; }
          .cup-cta__btn { padding: 10px 18px; font-size: 13px; }
        }
      `}</style>
    </>
  );
}
