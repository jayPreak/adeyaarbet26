'use client';

import { useState, useMemo } from 'react';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';

export default function MatchesScreen({ matches = [], onBet, bets = [], onCancelBet, poolMap = {}, allUsers = [] }) {
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
    up.sort((a, b) => (a.kickoffTs || '').localeCompare(b.kickoffTs || ''));
    done.sort((a, b) => (b.kickoffTs || '').localeCompare(a.kickoffTs || ''));
    return { upcoming: up, completed: done };
  }, [matches]);

  const list = tab === 'upcoming' ? upcoming : completed;

  const getMatchDate = (m) => m.kickoffTs ? m.kickoffTs.split('T')[0] : null;

  const byDate = {};
  list.forEach(m => {
    const key = getMatchDate(m) || 'tbd';
    (byDate[key] = byDate[key] || []).push(m);
  });
  const dates = Object.keys(byDate).sort((a, b) => {
    if (a === 'tbd') return 1;
    if (b === 'tbd') return -1;
    return tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a);
  });

  return (
    <div>
      <div className="section-head" style={{ marginTop: 8 }}>
        <div className="section-head__title display">Fixtures</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{list.length} matches</div>
      </div>

      <div style={{ display: 'flex', gap: 0, margin: '0 16px 16px', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[
          { id: 'upcoming', label: `Upcoming · ${upcoming.length}` },
          { id: 'completed', label: `Completed · ${completed.length}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: tab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-group__head">
            <div className="date-group__day">{date === 'tbd' ? 'Unknown' : fmtDay(date)}</div>
            <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
          </div>
          {byDate[date].map(m => {
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && b.status !== 'cancelled');
            return <MatchCard key={m.id} match={m} onBet={onBet} myBets={myBets} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} />;
          })}
        </div>
      ))}
    </div>
  );
}
