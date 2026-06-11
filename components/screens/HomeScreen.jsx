'use client';

import { useState, useEffect } from 'react';
import { getMatch, getTeam } from '@/lib/data';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { HeroMatch, SectionHead } from '@/components';
import CupWinnerCTA from '@/components/CupWinnerCTA';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function HomeScreen({ matches = [], balance, bets = [], onBet, onCancelBet, onNav, user, poolMap = {}, allUsers = [], myCupWinnerBet = null, onOpenCupWinner, cupWinnerDeadlineTs }) {
  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches.filter(m => m.status === 'upcoming').slice(0, 3);
  const featured = live[0] || upcoming[0];



  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetch('/api/activity?limit=10')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActivity(data.map(a => ({
            id: a.id,
            username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
            avatar_url: a.profiles?.avatar_url || null,
            text: formatActivityText(a),
            createdAt: a.created_at,
          })));
        }
      })
      .catch(() => {});
  }, [bets]);

  return (
    <div>
      {featured && <HeroMatch match={featured} onBet={onBet} poolData={poolMap[featured.id]} allUsers={allUsers} myBets={bets.filter(b => (b.match_id || b.matchId) === featured.id && b.status === 'pending')} onCancelBet={onCancelBet} />}

      <CupWinnerCTA myCupWinnerBet={myCupWinnerBet} onOpen={onOpenCupWinner} deadlineTs={cupWinnerDeadlineTs} />


      {/* Live matches */}
      {live.length > 0 && (
        <>
          <SectionHead title="Live now" more="All matches" onMore={() => onNav('fixtures')} />
          <div className="date-group" style={{ marginBottom: 8 }}>
            {live.map(m => <MatchCard key={m.id} match={m} onBet={onBet} myBets={bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending')} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} />)}
          </div>
        </>
      )}

      {/* Upcoming CTA */}
      <div
        onClick={() => onNav('fixtures')}
        style={{
          margin: '8px 16px 12px',
          padding: '16px 20px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Bet on upcoming matches</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{upcoming.length} matches coming up</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--ink-3)' }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* Friend activity */}
      <SectionHead title="Friend activity" more="See all" onMore={() => onNav('leaders')} />
      <div className="ticker" style={{ paddingBottom: 8 }}>
        {activity.length === 0 && (
          <div style={{ padding: '16px', color: 'var(--ink-3)', textAlign: 'center', fontSize: 13 }}>
            No activity yet — place the first bet!
          </div>
        )}
        {activity.map(a => (
          <div key={a.id} className="ticker-item">
            <div className="ticker-avatar" style={a.avatar_url ? { backgroundImage: `url(${a.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
              {!a.avatar_url && a.username[0]}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{a.username}</span>{' '}
              <span style={{ color: 'var(--ink-2)' }}>{a.text}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              {relativeTime(a.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatActivityText(a) {
  const isCupWinner = a.payload?.kind === 'cup_winner';
  const match = (!isCupWinner && a.payload?.match_id) ? getMatch(a.payload.match_id) : null;
  const matchLabel = isCupWinner
    ? 'to win the Cup'
    : match
      ? `${getTeam(match.home).name} vs ${getTeam(match.away).name}`
      : a.payload?.match_id || '';

  if (a.type === 'bet_placed' && a.payload) {
    const pickTeam = isCupWinner
      ? getTeam(a.payload.team).name
      : match
        ? (a.payload.pick === 'home' ? getTeam(match.home).name : a.payload.pick === 'away' ? getTeam(match.away).name : 'Draw')
        : a.payload.pick;
    return `bet ${CURRENCY_SYMBOL}${a.payload.amount} on ${pickTeam} · ${matchLabel}`;
  }
  if (a.type === 'bet_cancelled' && a.payload) {
    if (a.payload.reason === 'side_switch') {
      return `switched sides · ${matchLabel}`;
    }
    if (a.payload.reason === 'cup_winner_switch') {
      return `switched to ${getTeam(a.payload.new_team).name} · ${matchLabel}`;
    }
    return `cancelled bet${a.payload.refunded ? ` · refund ${CURRENCY_SYMBOL}${a.payload.refunded}` : ''} · ${matchLabel}`;
  }
  if (a.type === 'bet_won' && a.payload) {
    return `won ${CURRENCY_SYMBOL}${a.payload.payout} · ${matchLabel}`;
  }
  return a.type;
}
