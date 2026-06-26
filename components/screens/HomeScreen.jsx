'use client';

import { useState, useEffect } from 'react';
import { getMatch, getTeam } from '@/lib/data';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { HeroMatch, SectionHead, MatchCard } from '@/components';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function HomeScreen({ matches = [], balance, bets = [], onBet, onCancelBet, onNav, user, poolMap = {}, allUsers = [], myCupWinnerBet, onOpenCupWinner, cupWinnerDeadlineTs, onOpenThirdPlaceQual }) {
  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => (a.kickoffTs || '').localeCompare(b.kickoffTs || ''))
    .slice(0, 3);
  const featured = live[0] || upcoming[0];

  const fifaIdMap = {};
  for (const m of matches) {
    if (m.fifaId) fifaIdMap[m.fifaId] = m;
  }

  const [activity, setActivity] = useState([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [fullActivity, setFullActivity] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch('/api/activity?limit=10')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setActivity(data
            .filter(a => a.type !== 'penalty_applied')
            .map(a => ({
              id: a.id,
              username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
              avatar_url: a.profiles?.avatar_url || null,
              text: formatActivityText(a, fifaIdMap),
              createdAt: a.created_at,
            })));
        }
      })
      .catch(() => {});
  }, [bets]);

  const openAllActivity = () => {
    setShowAllActivity(true);
    setHasMore(true);
    fetch('/api/activity?limit=30')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data
            .filter(a => a.type !== 'penalty_applied')
            .map(a => ({
              id: a.id,
              username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
              avatar_url: a.profiles?.avatar_url || null,
              text: formatActivityText(a, fifaIdMap),
              createdAt: a.created_at,
            }));
          setFullActivity(mapped);
          if (data.length < 30) setHasMore(false);
        }
      })
      .catch(() => {});
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = fullActivity.length;
    fetch(`/api/activity?limit=30&offset=${offset}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data
            .filter(a => a.type !== 'penalty_applied')
            .map(a => ({
              id: a.id,
              username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
              avatar_url: a.profiles?.avatar_url || null,
              text: formatActivityText(a, fifaIdMap),
              createdAt: a.created_at,
            }));
          setFullActivity(prev => [...prev, ...mapped]);
          if (data.length < 30) setHasMore(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const [filterUser, setFilterUser] = useState(null);

  if (showAllActivity) {
    const uniqueUsers = [];
    const seen = new Set();
    for (const a of fullActivity) {
      if (!seen.has(a.username)) {
        seen.add(a.username);
        uniqueUsers.push({ username: a.username, avatar_url: a.avatar_url });
      }
    }

    const displayed = filterUser
      ? fullActivity.filter(a => a.username === filterUser)
      : fullActivity;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          <button
            onClick={() => { setShowAllActivity(false); setFilterUser(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 20, cursor: 'pointer', padding: 0 }}
          >
            ←
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Activity Feed</span>
        </div>

        {/* User filter chips */}
        {uniqueUsers.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '4px 16px 12px', overflowX: 'auto' }}>
            <button
              onClick={() => setFilterUser(null)}
              style={{
                padding: '6px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                background: !filterUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                color: !filterUser ? 'var(--ink)' : 'var(--ink-3)',
              }}
            >
              All
            </button>
            {uniqueUsers.map(u => (
              <button
                key={u.username}
                onClick={() => setFilterUser(filterUser === u.username ? null : u.username)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 16, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                  background: filterUser === u.username ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  color: filterUser === u.username ? 'var(--ink)' : 'var(--ink-3)',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: u.avatar_url ? `url(${u.avatar_url}) center/cover` : 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: 'var(--ink-3)',
                }}>
                  {!u.avatar_url && (u.username?.[0] || '?')}
                </div>
                {u.username}
              </button>
            ))}
          </div>
        )}

        <div className="ticker" style={{ paddingBottom: 16 }}>
          {displayed.map(a => (
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
          {displayed.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No activity from {filterUser}
            </div>
          )}
          {!filterUser && hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                display: 'block', width: 'calc(100% - 32px)', margin: '8px 16px',
                padding: '12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {live.length > 0 && (
        <div
          onClick={() => onNav('fixtures')}
          style={{
            margin: '0 16px 10px', padding: '8px 14px',
            borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,59,59,0.08)',
            border: '1px solid rgba(255,59,59,0.25)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b3b', animation: 'pulseDot 1.4s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ff3b3b', flex: 1 }}>
            {live.length === 1 ? `${getTeam(live[0].home).name} vs ${getTeam(live[0].away).name}` : `${live.length} matches`} LIVE
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,59,59,0.7)' }}>View →</span>
        </div>
      )}

      {featured && <HeroMatch match={featured} onBet={onBet} poolData={poolMap[featured.id]} allUsers={allUsers} myBets={bets.filter(b => (b.match_id || b.matchId) === featured.id && b.status === 'pending')} onCancelBet={onCancelBet} userId={user?.id} />}

      {/* Live matches */}
      {live.length > 0 && (
        <>
          <SectionHead title="Live now" more="All matches" onMore={() => onNav('fixtures')} />
          <div className="date-group" style={{ marginBottom: 8 }}>
            {live.map(m => <MatchCard key={m.id} match={m} onBet={onBet} myBets={bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending')} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={user?.id} />)}
          </div>
        </>
      )}

      {/* Upcoming CTA */}
      <div
        onClick={() => onNav('fixtures')}
        style={{
          margin: '8px 16px 6px',
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

      {/* 3rd-place qualifier bet CTA */}
      <div
        onClick={onOpenThirdPlaceQual}
        style={{
          margin: '0 16px 8px', padding: '14px 20px', borderRadius: 14,
          background: 'rgba(54,211,153,0.06)',
          border: '1px solid rgba(54,211,153,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🥉</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Pick 8 Third-Place Qualifiers</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>All 8 must be right · closes 12:29 AM IST</div>
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* Tournament standings shortcut */}
      <div
        onClick={() => onNav('tournament')}
        style={{
          margin: '0 16px 12px', padding: '14px 20px', borderRadius: 14,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Tournament standings</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>12 groups · W/D/L · bracket</div>
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--ink-3)' }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* Friend activity */}
      <SectionHead title="Friend activity" more="See all" onMore={openAllActivity} />
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

function formatSpecialMatchLabel(matchId) {
  if (matchId === 'CUP_WINNER') return 'Cup Winner';
  if (matchId === 'CONTINENT') return 'Winning Continent';
  if (matchId === 'MESSI_V_RONALDO') return 'Messi vs Ronaldo';
  if (matchId === 'GOLDEN_BOOT') return 'Golden Boot';
  if (matchId === 'THIRD_QUALIFIERS') return '3rd Place Qualifiers';
  if (matchId?.startsWith('HT_')) {
    const slug = matchId.slice(3).toLowerCase().replace(/_/g, ' ');
    return slug.replace(/\b\w/g, c => c.toUpperCase());
  }
  return null;
}

function formatActivityText(a, fifaIdMap) {
  const matchId = a.payload?.match_id;
  const specialLabel = formatSpecialMatchLabel(matchId);
  const isSpecial = !!specialLabel;
  const match = (!isSpecial && matchId)
    ? (getMatch(matchId) || fifaIdMap?.[matchId] || null)
    : null;
  const matchLabel = specialLabel
    || (match ? `${getTeam(match.home).name} vs ${getTeam(match.away).name}` : matchId || '');

  if (a.type === 'bet_placed' && a.payload) {
    const pickCode = a.payload.team || a.payload.pick;
    let pickLabel;
    if (matchId === 'CUP_WINNER') {
      pickLabel = getTeam(pickCode)?.name || pickCode;
    } else if (matchId === 'CONTINENT') {
      const confLabels = { UEFA: 'Europe', CONMEBOL: 'S. America', CONCACAF: 'N/C America', CAF: 'Africa', AFC: 'Asia', OFC: 'Oceania' };
      pickLabel = confLabels[pickCode] || pickCode;
    } else if (matchId?.startsWith('HT_')) {
      pickLabel = pickCode === 'yes' ? 'YES' : pickCode === 'no' ? 'NO' : pickCode;
    } else if (match) {
      pickLabel = pickCode === 'home' ? getTeam(match.home).name : pickCode === 'away' ? getTeam(match.away).name : 'Draw';
    } else {
      pickLabel = pickCode;
    }
    return `bet ${CURRENCY_SYMBOL}${a.payload.amount} on ${pickLabel} · ${matchLabel}`;
  }
  if (a.type === 'bet_cancelled' && a.payload) {
    if (a.payload.reason === 'side_switch') {
      return `switched sides · ${matchLabel}`;
    }
    return `cancelled bet${a.payload.refunded ? ` · refund ${CURRENCY_SYMBOL}${a.payload.refunded}` : ''} · ${matchLabel}`;
  }
  if (a.type === 'penalty_applied' && a.payload) {
    return `penalised ${CURRENCY_SYMBOL}${a.payload.amount} · did not bet · ${matchLabel}`;
  }
  if (a.type === 'bet_won' && a.payload) {
    return `won ${CURRENCY_SYMBOL}${a.payload.payout} · ${matchLabel}`;
  }
  return a.type;
}
