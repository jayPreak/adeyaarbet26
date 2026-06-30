import { describe, test, expect } from '@jest/globals';

// Test the R32 standings P&L computation logic (mirrors what the API route does)
function computeStandings(bets) {
  const byUser = {};
  for (const b of bets) {
    if (!byUser[b.user_id]) {
      byUser[b.user_id] = { userId: b.user_id, staked: 0, won: 0, lost: 0, pending: 0, net: 0, bets: 0 };
    }
    const u = byUser[b.user_id];
    u.bets++;
    u.staked += b.amount;
    if (b.status === 'won') u.won += (b.payout || 0) - b.amount;
    else if (b.status === 'lost') u.lost += b.amount;
    else if (b.status === 'pending') u.pending += b.amount;
  }
  for (const u of Object.values(byUser)) u.net = u.won - u.lost;
  return Object.values(byUser).sort((a, b) => a.net - b.net);
}

describe('R32 standings P&L', () => {
  test('biggest loser is first in sorted list', () => {
    const bets = [
      { user_id: 'alice', match_id: 'R32-1', amount: 100, status: 'lost', payout: null },
      { user_id: 'alice', match_id: 'R32-2', amount: 200, status: 'lost', payout: null },
      { user_id: 'bob', match_id: 'R32-1', amount: 100, status: 'won', payout: 300 },
      { user_id: 'bob', match_id: 'R32-2', amount: 50, status: 'lost', payout: null },
    ];
    const standings = computeStandings(bets);
    expect(standings[0].userId).toBe('alice');
    expect(standings[0].net).toBe(-300);
    expect(standings[1].userId).toBe('bob');
    expect(standings[1].net).toBe(150);
  });

  test('handles pending bets without affecting net', () => {
    const bets = [
      { user_id: 'alice', match_id: 'R32-3', amount: 500, status: 'pending', payout: null },
      { user_id: 'bob', match_id: 'R32-1', amount: 100, status: 'lost', payout: null },
    ];
    const standings = computeStandings(bets);
    expect(standings[0].userId).toBe('bob');
    expect(standings[0].net).toBe(-100);
    expect(standings[1].userId).toBe('alice');
    expect(standings[1].net).toBe(0);
    expect(standings[1].pending).toBe(500);
  });

  test('zero-sum: total won equals total lost', () => {
    const bets = [
      { user_id: 'a', match_id: 'R32-1', amount: 100, status: 'won', payout: 300 },
      { user_id: 'b', match_id: 'R32-1', amount: 100, status: 'lost', payout: null },
      { user_id: 'c', match_id: 'R32-1', amount: 100, status: 'lost', payout: null },
    ];
    const standings = computeStandings(bets);
    const totalNet = standings.reduce((s, u) => s + u.net, 0);
    expect(totalNet).toBe(0);
  });

  test('empty bets returns empty array', () => {
    expect(computeStandings([])).toEqual([]);
  });
});
