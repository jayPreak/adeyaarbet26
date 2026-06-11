import { computeGenerated, computeBalance } from '@/lib/ledger';

// Top-ups ("generated" funds) are modeled as `_topup` bets: amount 0, status
// 'won', payout = generated amount. They add to a wallet but must never count
// toward settlement / P&L. computeGenerated surfaces the total purely for
// transparency in the settlement breakdown.

describe('computeGenerated — generated (top-up) funds', () => {
  const topup = (amount) => ({ match_id: '_topup', pick: 'home', amount: 0, status: 'won', payout: amount });

  test('no bets → 0 generated', () => {
    expect(computeGenerated([])).toBe(0);
  });

  test('sums payouts of _topup bets', () => {
    expect(computeGenerated([topup(1000), topup(500)])).toBe(1500);
  });

  test('ignores real match bets', () => {
    const bets = [
      topup(2000),
      { match_id: 'A1', pick: 'home', amount: 300, status: 'won', payout: 600 },
      { match_id: 'B2', pick: 'away', amount: 200, status: 'lost', payout: null },
    ];
    expect(computeGenerated(bets)).toBe(2000);
  });

  test('handles missing payout safely', () => {
    expect(computeGenerated([{ match_id: '_topup', payout: null }])).toBe(0);
  });

  test('excluding generated funds leaves P&L unchanged', () => {
    // Settlement filters out `_topup` rows before computing net, so generating
    // tokens can never inflate a player's position.
    const real = { match_id: 'A1', pick: 'home', amount: 300, status: 'won', payout: 600 };
    const realOnly = [topup(5000), real].filter(b => b.match_id !== '_topup');
    expect(computeBalance(realOnly)).toBe(computeBalance([real]));
    expect(computeBalance(realOnly)).toBe(300); // +600 payout − 300 stake
  });
});
