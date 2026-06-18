'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const LeaderboardContext = createContext(null);

export function LeaderboardProvider({ user, children }) {
  const [rankings, setRankings] = useState([]);
  const [biggestWins, setBiggestWins] = useState([]);
  const [biggestLosses, setBiggestLosses] = useState([]);

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
  }, []);

  return (
    <LeaderboardContext.Provider value={{ rankings, biggestWins, biggestLosses, user }}>
      {children}
    </LeaderboardContext.Provider>
  );
}

export function useLeaderboard() {
  return useContext(LeaderboardContext);
}
