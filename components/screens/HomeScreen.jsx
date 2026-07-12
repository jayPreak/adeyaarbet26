'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMatch, getTeam, fmtKnockoutStage } from '@/lib/data';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { getSpecialLabel } from '@/lib/specials';
import { HeroMatch, SectionHead, MatchCard } from '@/components';
import LiveStreamPanel from '@/components/LiveStreamPanel';
import { fetchActivityDirect } from '@/lib/browserQueries';

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function HomeScreen({ matches = [], balance, bets = [], onBet, onCancelBet, onNav, user, poolMap = {}, allUsers = [], myCupWinnerBet, onOpenCupWinner, cupWinnerDeadlineTs, onOpenThirdPlaceQual, totalInPlay = 0, totalBets = 0, challenges = [] }) {
  const live = matches.filter(m => m.status === 'live');
  const upcoming = matches
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => (a.kickoffTs || '').localeCompare(b.kickoffTs || ''))
    .slice(0, 3);
  const featured = live[0] || upcoming[0];

  // Memoized so activity effect deps don't get a fresh reference every render
  // (previously activity re-fetched only on bets.length change and rendered
  // labels off stale/empty matches — team names showed as raw IDs).
  const { fifaIdMap, matchesById } = useMemo(() => {
    const fMap = {};
    const mMap = {};
    for (const m of matches) {
      if (m.fifaId) fMap[m.fifaId] = m;
      mMap[m.id] = m;
    }
    return { fifaIdMap: fMap, matchesById: mMap };
  }, [matches]);

  const [activity, setActivity] = useState([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [fullActivity, setFullActivity] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mapItems = (data) => data
      .filter(a => a.type !== 'penalty_applied')
      .map(a => ({
        id: a.id,
        username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
        avatar_url: a.profiles?.avatar_url || null,
        text: formatActivityText(a, fifaIdMap, matchesById, allUsers),
        createdAt: a.created_at,
      }));
    (async () => {
      try {
        const direct = await fetchActivityDirect({ limit: 10 });
        if (!cancelled && direct) { setActivity(mapItems(direct)); return; }
      } catch { /* fall through */ }
      try {
        const res = await fetch('/api/activity?limit=10');
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setActivity(mapItems(data));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // fifaIdMap/matchesById/allUsers included so labels reflect the newest
    // match + user data as it lands (FIFA fetch is async, users load in init)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bets.length, fifaIdMap, matchesById, allUsers]);

  const mapItems = (data) => data
    .filter(a => a.type !== 'penalty_applied')
    .map(a => ({
      id: a.id,
      username: a.profiles?.display_name || a.profiles?.username || 'Unknown',
      avatar_url: a.profiles?.avatar_url || null,
      text: formatActivityText(a, fifaIdMap, matchesById, allUsers),
      createdAt: a.created_at,
    }));

  const openAllActivity = async () => {
    setShowAllActivity(true);
    setHasMore(true);
    let data = null;
    try { data = await fetchActivityDirect({ limit: 30 }); } catch { /* ignore */ }
    if (!data) {
      try { data = await fetch('/api/activity?limit=30').then(r => r.json()); } catch { data = null; }
    }
    if (Array.isArray(data)) {
      setFullActivity(mapItems(data));
      if (data.length < 30) setHasMore(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const offset = fullActivity.length;
    let data = null;
    try { data = await fetchActivityDirect({ limit: 30, offset }); } catch { /* ignore */ }
    if (!data) {
      try { data = await fetch(`/api/activity?limit=30&offset=${offset}`).then(r => r.json()); } catch { data = null; }
    }
    if (Array.isArray(data)) {
      setFullActivity(prev => [...prev, ...mapItems(data)]);
      if (data.length < 30) setHasMore(false);
    }
    setLoadingMore(false);
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
      {featured?.status === 'live' && <LiveStreamPanel match={featured} />}

      {featured && <HeroMatch match={featured} onBet={onBet} poolData={poolMap[featured.id]} allUsers={allUsers} myBets={bets.filter(b => (b.match_id || b.matchId) === featured.id && b.status === 'pending' && (b.kind === 'match' || b.kind === 'penalty'))} onCancelBet={onCancelBet} userId={user?.id} />}

      {/* Additional live-stream panels default to COLLAPSED — only the
          featured hero-stream autoplays, preventing multiple iframes running
          in parallel (audio doubling + 2x bandwidth on doubleheaders). */}
      {live.filter(m => m.id !== featured?.id).map(m => (
        <LiveStreamPanel key={`stream-${m.id}`} match={m} defaultOpen={false} />
      ))}

      {/* Live matches (exclude the featured/hero match to avoid duplicate) */}
      {live.filter(m => m.id !== featured?.id).length > 0 && (
        <>
          <SectionHead title="Live now" more="All matches" onMore={() => onNav('fixtures')} />
          <div className="date-group" style={{ marginBottom: 8 }}>
            {live.filter(m => m.id !== featured?.id).map(m => <MatchCard key={m.id} match={m} onBet={onBet} myBets={bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending' && (b.kind === 'match' || b.kind === 'penalty'))} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={user?.id} challenges={challenges} />)}
          </div>
        </>
      )}


      {/* Total in play ticker */}
      {totalInPlay > 0 && (
        <div style={{
          margin: '12px 16px 8px', padding: '10px 16px',
          borderRadius: 10, textAlign: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            Total Volume
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
            {CURRENCY_SYMBOL}{totalInPlay.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
            {totalBets} bets across {allUsers.length} players
          </div>
        </div>
      )}

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
  return getSpecialLabel(matchId);
}

function formatActivityText(a, fifaIdMap, matchesById, allUsers) {
  const matchId = a.payload?.match_id;
  const specialLabel = formatSpecialMatchLabel(matchId);
  const isSpecial = !!specialLabel;
  const match = (!isSpecial && matchId)
    ? (getMatch(matchId) || matchesById?.[matchId] || fifaIdMap?.[matchId] || null)
    : null;
  const stageTag = fmtKnockoutStage(matchId);
  const matchLabel = specialLabel
    || (match && (match.home || match.away)
      ? (stageTag ? `${stageTag}: ` : '') + `${match.home ? getTeam(match.home).name : (match.placeholderA || 'TBD')} vs ${match.away ? getTeam(match.away).name : (match.placeholderB || 'TBD')}`
      : (stageTag || matchId?.replace('-', ' ') || ''));

  if (a.type === 'bet_placed' && a.payload) {
    const pickCode = a.payload.team || a.payload.pick;
    let pickLabel;
    if (matchId === 'CUP_WINNER') {
      pickLabel = getTeam(pickCode)?.name || pickCode;
    } else if (matchId === 'CONTINENT') {
      const confLabels = { UEFA: 'Europe', CONMEBOL: 'S. America', CONCACAF: 'N/C America', CAF: 'Africa', AFC: 'Asia', OFC: 'Oceania' };
      pickLabel = confLabels[pickCode] || pickCode;
    } else if (matchId === 'R32_BIGGEST_LOSER' || matchId === 'R32_BIGGEST_WINNER') {
      const u = allUsers?.find(u => u.id === pickCode);
      pickLabel = u?.display_name || u?.username || pickCode;
    } else if (matchId?.startsWith('HT_')) {
      pickLabel = pickCode === 'yes' ? 'YES' : pickCode === 'no' ? 'NO' : pickCode;
    } else if (match) {
      pickLabel = pickCode === 'home'
        ? (match.home ? getTeam(match.home).name : 'Home')
        : pickCode === 'away'
          ? (match.away ? getTeam(match.away).name : 'Away')
          : 'Draw';
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
