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

  // Post-deadline with no bet: hide entirely (not actionable)
  if (closed && !hasBet) return null;

  const team = hasBet ? getTeam(myCupWinnerBet.pick) : null;

  let title, subtitle, action;
  if (closed && hasBet) {
    title = `🏆 Locked on ${team.name}`;
    subtitle = `${fmtMoney(myCupWinnerBet.amount)} on the cup`;
    action = null;
  } else if (hasBet) {
    title = `🏆 You're backing ${team.name}`;
    subtitle = `${fmtMoney(myCupWinnerBet.amount)} · changes close in ${formatCountdown(cd)}`;
    action = 'Update pick';
  } else {
    title = `🏆 Pick the World Cup winner`;
    subtitle = `Bet closes in ${formatCountdown(cd)} (1h before kickoff)`;
    action = 'Bet now';
  }

  return (
    <div
      onClick={action ? onOpen : undefined}
      style={{
        margin: '10px 16px 14px',
        padding: '14px 16px',
        borderRadius: 14,
        background: closed
          ? 'rgba(255,255,255,0.04)'
          : 'linear-gradient(135deg, rgba(255,193,7,0.16), rgba(255,140,0,0.08))',
        border: closed ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,193,7,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: action ? 'pointer' : 'default',
      }}
    >
      {hasBet && <Flag code={myCupWinnerBet.pick} size="md" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {action && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: '#ffc107',
            color: '#0a1f17',
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
