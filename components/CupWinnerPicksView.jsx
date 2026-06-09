'use client';

import { useMemo, useState } from 'react';
import { getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';
import { Flag } from './index';

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('');
}

export default function CupWinnerPicksView({ picks = [], currentUserId, pool }) {
  const [mode, setMode] = useState('team');

  const byTeam = useMemo(() => {
    const map = {};
    for (const p of picks) {
      if (!map[p.pick]) map[p.pick] = { code: p.pick, total: 0, bettors: [] };
      map[p.pick].total += p.amount;
      map[p.pick].bettors.push(p);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [picks]);

  const byUser = useMemo(() => {
    const sorted = [...picks].sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return sorted;
  }, [picks, currentUserId]);

  const totalPool = pool?.total || picks.reduce((s, p) => s + p.amount, 0);
  const bettorCount = pool?.bettorCount ?? new Set(picks.map(p => p.user_id)).size;

  return (
    <div className="cup-picks">
      <div className="cup-picks__summary">
        <div>
          <div className="cup-picks__summary-label">Total pool</div>
          <div className="cup-picks__summary-value">{fmtMoney(totalPool)}</div>
        </div>
        <div>
          <div className="cup-picks__summary-label">Bettors</div>
          <div className="cup-picks__summary-value">{bettorCount}</div>
        </div>
        <div>
          <div className="cup-picks__summary-label">Teams backed</div>
          <div className="cup-picks__summary-value">{byTeam.length}</div>
        </div>
      </div>

      <div className="cup-picks__toggle" role="tablist">
        <button
          role="tab"
          aria-selected={mode === 'team'}
          className={mode === 'team' ? 'active' : ''}
          onClick={() => setMode('team')}
        >
          By team
        </button>
        <button
          role="tab"
          aria-selected={mode === 'user'}
          className={mode === 'user' ? 'active' : ''}
          onClick={() => setMode('user')}
        >
          By user
        </button>
      </div>

      {picks.length === 0 && (
        <div className="cup-picks__empty">No picks yet. Be the first!</div>
      )}

      {mode === 'team' && picks.length > 0 && (
        <div className="cup-picks__teams">
          {byTeam.map(t => {
            const team = getTeam(t.code);
            return (
              <div key={t.code} className="cup-picks__team">
                <div className="cup-picks__team-head">
                  <Flag code={t.code} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cup-picks__team-name">{team.name}</div>
                    <div className="cup-picks__team-meta">
                      {t.bettors.length} {t.bettors.length === 1 ? 'bettor' : 'bettors'}
                    </div>
                  </div>
                  <div className="cup-picks__team-total mono">{fmtMoney(t.total)}</div>
                </div>
                <div className="cup-picks__bettors">
                  {t.bettors
                    .sort((a, b) => b.amount - a.amount)
                    .map(b => (
                      <div
                        key={b.user_id}
                        className={
                          'cup-picks__bettor' +
                          (b.user_id === currentUserId ? ' cup-picks__bettor--me' : '')
                        }
                      >
                        <div className="cup-picks__avatar">{initials(b.display_name)}</div>
                        <div className="cup-picks__bettor-name">
                          {b.display_name}
                          {b.user_id === currentUserId && <span className="cup-picks__you"> · you</span>}
                        </div>
                        <div className="cup-picks__bettor-amt mono">{fmtMoney(b.amount)}</div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'user' && picks.length > 0 && (
        <div className="cup-picks__users">
          {byUser.map(p => {
            const team = getTeam(p.pick);
            const isMe = p.user_id === currentUserId;
            return (
              <div
                key={p.user_id}
                className={'cup-picks__user' + (isMe ? ' cup-picks__user--me' : '')}
              >
                <div className="cup-picks__avatar">{initials(p.display_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cup-picks__bettor-name">
                    {p.display_name}
                    {isMe && <span className="cup-picks__you"> · you</span>}
                  </div>
                  <div className="cup-picks__user-pick">
                    <Flag code={p.pick} size="sm" />
                    <span>{team.name}</span>
                  </div>
                </div>
                <div className="cup-picks__bettor-amt mono">{fmtMoney(p.amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .cup-picks { display: flex; flex-direction: column; gap: 12px; }
        .cup-picks__summary {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
          padding: 10px; border-radius: 12px;
          background: #1A1D24; border: 1px solid rgba(255,255,255,0.08);
        }
        .cup-picks__summary > div { text-align: center; min-width: 0; }
        .cup-picks__summary-label {
          font-size: 9.5px; font-weight: 600; letter-spacing: 0.6px;
          text-transform: uppercase; color: #8089A0;
        }
        .cup-picks__summary-value {
          font-family: var(--font-mono); font-weight: 700; font-size: 14px;
          color: #F2F3F5; margin-top: 2px;
        }
        .cup-picks__toggle {
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
          padding: 3px; background: #14171D;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
        }
        .cup-picks__toggle button {
          padding: 8px 10px; border: none; border-radius: 8px;
          background: transparent; color: #8089A0;
          font-weight: 600; font-size: 12px; cursor: pointer;
        }
        .cup-picks__toggle button.active {
          background: rgba(0,255,133,0.14); color: #00FF85;
        }
        .cup-picks__empty {
          text-align: center; padding: 24px 12px;
          color: #8089A0; font-size: 13px;
        }
        .cup-picks__teams, .cup-picks__users {
          display: flex; flex-direction: column; gap: 10px;
        }
        .cup-picks__team {
          border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
          background: #14171D; overflow: hidden;
        }
        .cup-picks__team-head {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; background: #1A1D24;
        }
        .cup-picks__team-name {
          font-size: 13px; font-weight: 700; color: #F2F3F5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cup-picks__team-meta {
          font-size: 10.5px; color: #8089A0; margin-top: 1px;
        }
        .cup-picks__team-total {
          font-size: 13px; font-weight: 700; color: #00FF85;
        }
        .cup-picks__bettors {
          display: flex; flex-direction: column;
        }
        .cup-picks__bettor, .cup-picks__user {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .cup-picks__user {
          border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
          background: #14171D; border-top: 1px solid rgba(255,255,255,0.08);
        }
        .cup-picks__bettor--me, .cup-picks__user--me {
          background: rgba(0,255,133,0.06);
        }
        .cup-picks__avatar {
          flex-shrink: 0;
          width: 28px; height: 28px; border-radius: 50%;
          background: #2A2F39; color: #F2F3F5;
          display: grid; place-items: center;
          font-size: 11px; font-weight: 700;
        }
        .cup-picks__bettor-name {
          flex: 1; min-width: 0;
          font-size: 12.5px; font-weight: 600; color: #F2F3F5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cup-picks__you { color: #00FF85; font-weight: 600; }
        .cup-picks__bettor-amt {
          font-size: 12px; font-weight: 700; color: #F2F3F5;
        }
        .cup-picks__user-pick {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: #8089A0; margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
