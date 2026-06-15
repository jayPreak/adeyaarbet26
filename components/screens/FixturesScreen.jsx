'use client';

import { useState, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import { fmtDay, fmtDate, getTeam } from '@/lib/data';
import { MatchCard } from '@/components';

export default function FixturesScreen({ matches = [], onBet, bets = [], onCancelBet, poolMap = {}, allUsers = [], userId }) {
  const [tab, setTab] = useState('upcoming');
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

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

  // Build searchable items with team names/codes for Fuse
  const searchItems = useMemo(() => {
    return list.map(m => {
      const home = getTeam(m.home);
      const away = getTeam(m.away);
      return {
        match: m,
        homeName: home.name,
        awayName: away.name,
        homeCode: home.code,
        awayCode: away.code,
        combined: `${home.name} ${away.name} ${home.code} ${away.code}`,
      };
    });
  }, [list]);

  const fuse = useMemo(() => new Fuse(searchItems, {
    keys: ['homeName', 'awayName', 'homeCode', 'awayCode', 'combined'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [searchItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const results = fuse.search(query.trim());
    return results.map(r => r.item.match);
  }, [query, fuse, list]);

  const byDate = useMemo(() => {
    const groups = {};
    for (const m of filtered) {
      const key = m.kickoffTs ? m.kickoffTs.split('T')[0] : 'tbd';
      (groups[key] = groups[key] || []).push(m);
    }
    return groups;
  }, [filtered]);

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

      {/* Search bar */}
      <div style={{ padding: '8px 16px 4px' }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search teams… e.g. Brazil, FRA vs GER"
            style={{
              width: '100%',
              padding: '10px 36px 10px 12px',
              fontSize: 13,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, paddingLeft: 2 }}>
            {filtered.length} match{filtered.length !== 1 ? 'es' : ''} found
          </div>
        )}
      </div>

      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-group__head">
            <div className="date-group__day">{date === 'tbd' ? 'Unknown' : fmtDay(date)}</div>
            <div className="date-group__date">{date === 'tbd' ? '' : fmtDate(date)}</div>
          </div>
          {byDate[date].map(m => {
            const myBets = bets.filter(b => (b.match_id || b.matchId) === m.id && (b.status !== 'cancelled' || m.status === 'finished'));
            return <MatchCard key={m.id} match={m} onBet={onBet} myBets={myBets} onCancelBet={onCancelBet} poolData={poolMap[m.id]} allUsers={allUsers} userId={userId} />;
          })}
        </div>
      ))}

      {query && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ink-3)', fontSize: 14 }}>
          No matches found for "{query}"
        </div>
      )}
    </div>
  );
}
