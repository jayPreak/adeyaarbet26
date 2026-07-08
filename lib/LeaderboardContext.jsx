'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const LeaderboardContext = createContext(null);

export function LeaderboardProvider({ user, children }) {
  const [rankings, setRankings] = useState([]);
  const [biggestWins, setBiggestWins] = useState([]);
  const [biggestLosses, setBiggestLosses] = useState([]);
  const [duelStats, setDuelStats] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRankings(data);
        } else if (data?.rankings) {
          setRankings(data.rankings);
          setBiggestWins(data.biggestWins || []);
          setBiggestLosses(data.biggestLosses || []);
        }
      })
      .catch(() => {});

    fetch('/api/challenge')
      .then(r => r.json())
      .then(data => {
        const challenges = data.challenges || [];
        const settled = challenges.filter(c => c.status === 'settled');
        const voided = challenges.filter(c => c.status === 'void');
        const statsMap = {};

        for (const c of settled) {
          const ids = [c.challenger_id, c.opponent_id];
          for (const id of ids) {
            if (!statsMap[id]) statsMap[id] = { wins: 0, losses: 0, draws: 0, profit: 0, totalStaked: 0, name: '', avatar: '' };
            statsMap[id].totalStaked += c.amount;
            if (c.winner_id === id) {
              statsMap[id].wins++;
              statsMap[id].profit += c.amount;
            } else {
              statsMap[id].losses++;
              statsMap[id].profit -= c.amount;
            }
          }
          // names
          if (c.challenger && statsMap[c.challenger_id]) {
            statsMap[c.challenger_id].name = c.challenger.display_name || '';
            statsMap[c.challenger_id].avatar = c.challenger.avatar_url || '';
          }
          if (c.opponent && statsMap[c.opponent_id]) {
            statsMap[c.opponent_id].name = c.opponent.display_name || '';
            statsMap[c.opponent_id].avatar = c.opponent.avatar_url || '';
          }
        }

        for (const c of voided) {
          const ids = [c.challenger_id, c.opponent_id];
          for (const id of ids) {
            if (!statsMap[id]) statsMap[id] = { wins: 0, losses: 0, draws: 0, profit: 0, totalStaked: 0, name: '', avatar: '' };
            statsMap[id].draws++;
          }
          if (c.challenger && statsMap[c.challenger_id]) {
            statsMap[c.challenger_id].name = c.challenger.display_name || '';
            statsMap[c.challenger_id].avatar = c.challenger.avatar_url || '';
          }
          if (c.opponent && statsMap[c.opponent_id]) {
            statsMap[c.opponent_id].name = c.opponent.display_name || '';
            statsMap[c.opponent_id].avatar = c.opponent.avatar_url || '';
          }
        }

        const arr = Object.entries(statsMap).map(([id, s]) => ({
          userId: id,
          displayName: s.name,
          avatarUrl: s.avatar,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          total: s.wins + s.losses + s.draws,
          winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
          profit: s.profit,
          totalStaked: s.totalStaked,
        }));

        arr.sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.losses - b.losses);
        setDuelStats(arr);
      })
      .catch(() => {});
  }, []);

  return (
    <LeaderboardContext.Provider value={{ rankings, biggestWins, biggestLosses, duelStats, user }}>
      {children}
    </LeaderboardContext.Provider>
  );
}

export function useLeaderboard() {
  return useContext(LeaderboardContext);
}
