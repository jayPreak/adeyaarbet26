'use client';

import { useState, useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtDay, fmtDate } from '@/lib/data';
import { MatchCard } from '@/components';
import KnockoutPage from '../knockout/page';

export default function FixturesUpcomingPage() {
  const { matches, openBet, bets, cancelBet, poolMap, allUsers, user, challenges } = useBetting();
  const [view, setView] = useState('list');

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
      <div style={{ padding: '10px 20px 6px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => setView('list')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: view === 'list' ? '1.5px solid var(--gold)' : '1px solid var(--line)',
            background: view === 'list' ? 'var(--gold-soft)' : 'var(--surface)',
            color: view === 'list' ? 'var(--gold)' : 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          Match List
        </button>
        <button
          onClick={() => setView('bracket')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: view === 'bracket' ? '1.5px solid var(--gold)' : '1px solid var(--line)',
            background: view === 'bracket' ? 'var(--gold-soft)' : 'var(--surface)',
            color: view === 'bracket' ? 'var(--gold)' : 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          Knockout Bracket
        </button>
      </div>

      {view === 'bracket' ? (
        <KnockoutPage />
      ) : (
        <div>
          {dates.map(date => (
            <div key={date} className="date-group">
              <div className="date-group__head">
                <div className="date-group__day">{date === 'tbd' ? 'Unknown' : fmtDay(date)}</div>
                <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
              </div>
              {byDate[date].map(m => {
                const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.kind === 'match' || b.kind === 'penalty') && (b.status !== 'cancelled' || m.status === 'finished'));
                return <MatchCard key={m.id} match={m} onBet={openBet} myBets={myBets} onCancelBet={cancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={user?.id} challenges={challenges} />;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
