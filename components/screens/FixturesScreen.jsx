'use client';

import { useState, useMemo } from 'react';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';

export default function FixturesScreen({ matches = [], onBet, bets = [], onCancelBet, poolMap = {}, allUsers = [], userId }) {
  const [tab, setTab] = useState('upcoming');

  const { upcoming, completed } = useMemo(() => {
    const up = [];
    const done = [];
    for (const m of matches) {
      if (m.status === 'finished') {
        done.push(m);
      } else {
        up.push(m);
      }
    }
    up.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      return (a.kickoffTs || '').localeCompare(b.kickoffTs || '');
    });
    done.sort((a, b) => (b.kickoffTs || '').localeCompare(a.kickoffTs || ''));
    return { upcoming: up, completed: done };
  }, [matches]);

  const list = tab === 'upcoming' ? upcoming : completed;

  const byDate = useMemo(() => {
    const groups = {};
    for (const m of list) {
      const key = m.kickoffTs ? m.kickoffTs.split('T')[0] : 'tbd';
      (groups[key] = groups[key] || []).push(m);
    }
    return groups;
  }, [list]);

  const dates = useMemo(() => {
    return Object.keys(byDate).sort((a, b) => {
      if (a === 'tbd') return 1;
      if (b === 'tbd') return -1;
      return tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a);
    });
  }, [byDate, tab]);

  return (
    <div>

      <div className="material-tabs">
        <button
          className={'material-tab' + (tab === 'upcoming' ? ' active' : '')}
          onClick={() => setTab('upcoming')}
        >
          {upcoming.some(m => m.status === 'live') ? 'Upcoming / Live' : 'Upcoming'} ({upcoming.length})
        </button>
        <button
          className={'material-tab' + (tab === 'completed' ? ' active' : '')}
          onClick={() => setTab('completed')}
        >
          Completed ({completed.length})
        </button>
      </div>


      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-group__head">
            <div className="date-group__day">{date === 'tbd' ? 'Unknown' : fmtDay(date)}</div>
            <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
          </div>
          {byDate[date].map(m => {
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.kind === 'match' || b.kind === 'penalty') && (b.status !== 'cancelled' || m.status === 'finished'));
            return <MatchCard key={m.id} match={m} onBet={onBet} myBets={myBets} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={userId} />;
          })}
        </div>
      ))}

    </div>
  );
}
