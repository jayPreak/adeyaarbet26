'use client';

import { useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';

export default function FixturesUpcomingPage() {
  const { matches, openBet, bets, cancelBet, poolMap, allUsers, user } = useBetting();

  const upcoming = useMemo(() => {
    const up = matches.filter(m => m.status !== 'finished');
    up.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return (a.kickoffTs || '').localeCompare(b.kickoffTs || '');
    });
    return up;
  }, [matches]);

  const byDate = useMemo(() => {
    const groups = {};
    for (const m of upcoming) {
      const key = m.kickoffTs ? m.kickoffTs.split('T')[0] : 'tbd';
      (groups[key] = groups[key] || []).push(m);
    }
    return groups;
  }, [upcoming]);

  const dates = useMemo(() => {
    return Object.keys(byDate).sort((a, b) => {
      if (a === 'tbd') return 1;
      if (b === 'tbd') return -1;
      return a.localeCompare(b);
    });
  }, [byDate]);

  return (
    <div>
      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-group__head">
            <div className="date-group__day">{date === 'tbd' ? 'Unknown' : fmtDay(date)}</div>
            <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
          </div>
          {byDate[date].map(m => {
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.status !== 'cancelled' || m.status === 'finished'));
            return <MatchCard key={m.id} match={m} onBet={openBet} myBets={myBets} onCancelBet={cancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={user?.id} />;
          })}
        </div>
      ))}
    </div>
  );
}
