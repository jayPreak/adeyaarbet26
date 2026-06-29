'use client';

import { useState, useEffect } from 'react';
import { getTeam } from '@/lib/data';
import { Flag } from './index';

const POS_ORDER = { FWD: 0, MID: 1, DEF: 2, GK: 3 };
const POS_COLORS = { GK: '#6b7280', DEF: '#3b82f6', MID: '#22c55e', FWD: '#f97316' };

function PlayerRow({ player }) {
  const posColor = POS_COLORS[player.position_label] || '#6b7280';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{
        minWidth: 20, fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--ink-3)', textAlign: 'right', flexShrink: 0,
      }}>
        {player.jersey_num ?? ''}
      </span>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.player_name}
        {player.captain && (
          <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 800, color: 'var(--gold)', verticalAlign: 'middle' }}>C</span>
        )}
      </span>
      {player.position_label && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, flexShrink: 0,
          background: `${posColor}22`, color: posColor,
        }}>
          {player.position_label}
        </span>
      )}
    </div>
  );
}

function PlayerGroup({ label, players }) {
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => {
    const pa = POS_ORDER[a.position_label] ?? 9;
    const pb = POS_ORDER[b.position_label] ?? 9;
    return pa - pb;
  });
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 4, paddingTop: 4 }}>
        {label}
      </div>
      {sorted.map(p => <PlayerRow key={p.player_id || p.player_name} player={p} />)}
    </div>
  );
}

function TeamColumn({ code, players }) {
  const team = getTeam(code);
  const starters = players.filter(p => p.is_starter !== false);
  const subs = players.filter(p => p.is_starter === false);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10, paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Flag code={code} size="sm" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{team?.name || code}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{starters.length}+{subs.length}</span>
      </div>
      <PlayerGroup label="STARTING XI" players={starters} />
      <PlayerGroup label="SUBSTITUTES" players={subs} />
    </div>
  );
}

export default function LineupSheet({ match, open, onClose }) {
  const [state, setState] = useState('idle'); // idle | loading | ready | unavailable | error
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);

  useEffect(() => {
    if (!open || !match) return;
    setState('loading');
    fetch(`/api/goalscorer-players/${match.id}`)
      .then(r => r.json())
      .then(data => {
        const home = data.players?.home || [];
        const away = data.players?.away || [];
        if (home.length === 0 && away.length === 0) {
          setState('unavailable');
        } else {
          setHomePlayers(home);
          setAwayPlayers(away);
          setState('ready');
        }
      })
      .catch(() => setState('error'));
  }, [open, match?.id]);

  if (!open || !match) return null;

  const homeTeam = getTeam(match.home);
  const awayTeam = getTeam(match.away);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: '50%', bottom: 0, zIndex: 801,
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Title */}
        <div style={{
          padding: '4px 16px 12px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              {homeTeam?.name || match.home} vs {awayTeam?.name || match.away}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Match Lineup</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: 8, width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px 24px' }}>
          {state === 'loading' && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Loading lineup…
            </div>
          )}
          {state === 'unavailable' && (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
                Lineup not announced yet
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Starting XI is announced 75 minutes before kickoff
              </div>
            </div>
          )}
          {state === 'error' && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--loss)', fontSize: 13 }}>
              Could not load lineup
            </div>
          )}
          {state === 'ready' && (
            <div style={{ display: 'flex', gap: 16 }}>
              <TeamColumn code={match.home} players={homePlayers} />
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
              <TeamColumn code={match.away} players={awayPlayers} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
