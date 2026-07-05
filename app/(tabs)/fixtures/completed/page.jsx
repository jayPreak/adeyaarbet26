'use client';

import { useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';

export default function FixturesCompletedPage() {
  const { matches, openBet, bets, cancelBet, poolMap, allUsers, user } = useBetting();

  const completed = useMemo(() => {
    const done = matches.filter(m => m.status === 'finished');
    done.sort((a, b) => (b.kickoffTs || '').localeCompare(a.kickoffTs || ''));
    return done;
  }, [matches]);

  const byDate = useMemo(() => {
    const groups = {};
    for (const m of completed) {
      const key = m.kickoffTs ? m.kickoffTs.split('T')[0] : 'tbd';
      (groups[key] = groups[key] || []).push(m);
    }
    return groups;
  }, [completed]);

  const dates = useMemo(() => {
    return Object.keys(byDate).sort((a, b) => {
      if (a === 'tbd') return 1;
      if (b === 'tbd') return -1;
      return b.localeCompare(a);
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
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && b.kind === 'match' && (b.status !== 'cancelled' || m.status === 'finished'));
            return <MatchCard key={m.id} match={m} onBet={openBet} myBets={myBets} onCancelBet={cancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={user?.id} />;
          })}
        </div>
      ))}
    </div>
  );
}
