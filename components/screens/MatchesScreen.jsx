'use client';

import { useState } from 'react';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';

export default function MatchesScreen({ matches = [], onBet, bets = [], onCancelBet, poolMap = {}, allUsers = [] }) {
  const [filter, setFilter] = useState('all');

  const filters = [
    { id: 'all',   label: 'All' },
    { id: 'live',  label: 'Live' },
    { id: 'today', label: 'Today' },
    { id: 'r32',   label: 'Round of 32' },
    { id: 'group', label: 'Group' },
  ];

  const TODAY = new Date().toISOString().split('T')[0];

  const getMatchDate = (m) => {
    if (m.kickoffTs) return m.kickoffTs.split('T')[0];
    return null;
  };

  let filtered = matches;
  if (filter === 'live')  filtered = matches.filter(m => m.status === 'live');
  if (filter === 'today') filtered = matches.filter(m => getMatchDate(m) === TODAY);
  if (filter === 'r32')   filtered = matches.filter(m => !m.group);
  if (filter === 'group') filtered = matches.filter(m => !!m.group);

  const byDate = {};
  filtered.forEach(m => {
    const key = getMatchDate(m) || 'tbd';
    (byDate[key] = byDate[key] || []).push(m);
  });
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      <div className="section-head" style={{ marginTop: 8 }}>
        <div className="section-head__title display">Fixtures</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{filtered.length} matches</div>
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {filters.map(f => (
          <button
            key={f.id}
            className={'chip ' + (filter === f.id ? 'active' : '')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-group__head">
            <div className="date-group__day">{date === 'tbd' ? 'TBD' : fmtDay(date)}</div>
            <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
          </div>
          {byDate[date].map(m => {
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status === 'pending');
            return <MatchCard key={m.id} match={m} onBet={onBet} myBets={myBets} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} />;
          })}
        </div>
      ))}
    </div>
  );
}
