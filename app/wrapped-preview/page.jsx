'use client';
import { useState } from 'react';
import WrappedStory from '@/components/WrappedStory';

const bets = [
  { id: '1', match_id: 'A1', pick: 'home', amount: 500, status: 'won', payout: 1200, kind: 'match' },
  { id: '2', match_id: 'A2', pick: 'away', amount: 2000, status: 'lost', payout: 0, kind: 'match' },
  { id: '3', match_id: 'C1', pick: 'home', amount: 800, status: 'won', payout: 1500, kind: 'match' },
  { id: '4', match_id: 'FIN-1', pick: 'home', amount: 5000, status: 'won', payout: 9500, kind: 'match' },
  { id: '5', match_id: 'CUP_WINNER', pick: 'ARG', amount: 1000, status: 'won', payout: 8750, kind: 'cup_winner' },
  { id: '6', match_id: 'C2', pick: 'home', amount: 4200, status: 'lost', payout: 0, kind: 'match' },
  { id: '7', match_id: 'D1', pick: 'over', amount: 250, status: 'won', payout: 480, kind: 'over_under' },
  { id: '8', match_id: 'B1', pick: 'home', amount: 400, status: 'won', payout: 700, kind: 'match' },
];
const allChallenges = [
  { id: 'c1', status: 'settled', challenger_id: 'me', opponent_id: 'x', winner_id: 'me' },
  { id: 'c2', status: 'settled', challenger_id: 'me', opponent_id: 'y', winner_id: 'me' },
  { id: 'c3', status: 'settled', challenger_id: 'z', opponent_id: 'me', winner_id: 'z' },
];
const settlementByUser = { me: 6540, x: -3000, y: 1500, z: 800, w: -5840 };
const allUsers = [{ id: 'me', display_name: 'Rohan' }, { id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }];
const user = { id: 'me', display_name: 'Rohan' };
const matches = [{ id: 'FIN-1', home: 'ARG', away: 'FRA' }];

export default function P() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ minHeight: '100vh', background: '#111' }}>
      <button onClick={() => setOpen(true)}>open</button>
      <WrappedStory open={open} onClose={() => setOpen(false)} bets={bets} matches={matches}
        allChallenges={allChallenges} settlementByUser={settlementByUser} allUsers={allUsers} user={user} initialIndex={14} />
    </div>
  );
}
