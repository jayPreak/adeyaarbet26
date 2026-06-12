import { computeRealisedBalance } from '@/lib/ledger';

describe('computeRealisedBalance', () => {
  test('empty bets returns 0', () => {
    expect(computeRealisedBalance([])).toBe(0);
  });

  test('pending bets are ignored', () => {
    const bets = [
      { amount: 500, status: 'pending', payout: null },
      { amount: 1000, status: 'pending', payout: null },
    ];
    expect(computeRealisedBalance(bets)).toBe(0);
  });

  test('cancelled bets are ignored', () => {
    const bets = [{ amount: 300, status: 'cancelled', payout: null }];
    expect(computeRealisedBalance(bets)).toBe(0);
  });

  test('won bet: profit = payout - stake', () => {
    const bets = [{ amount: 100, status: 'won', payout: 300 }];
    expect(computeRealisedBalance(bets)).toBe(200);
  });

  test('lost bet: loss = -stake', () => {
    const bets = [{ amount: 200, status: 'lost', payout: null }];
    expect(computeRealisedBalance(bets)).toBe(-200);
  });

  test('mix of won and lost', () => {
    const bets = [
      { amount: 100, status: 'won', payout: 400 },   // +300
      { amount: 200, status: 'lost', payout: null },  // -200
      { amount: 50, status: 'won', payout: 100 },    // +50
      { amount: 500, status: 'pending', payout: null }, // ignored
    ];
    expect(computeRealisedBalance(bets)).toBe(150);
  });

  test('won bet with payout equal to stake = 0 profit', () => {
    const bets = [{ amount: 500, status: 'won', payout: 500 }];
    expect(computeRealisedBalance(bets)).toBe(0);
  });

  test('all losses', () => {
    const bets = [
      { amount: 100, status: 'lost', payout: null },
      { amount: 200, status: 'lost', payout: null },
      { amount: 300, status: 'lost', payout: null },
    ];
    expect(computeRealisedBalance(bets)).toBe(-600);
  });

  test('differs from computeBalance — pending not counted', () => {
    const bets = [
      { amount: 1000, status: 'pending', payout: null },
      { amount: 100, status: 'won', payout: 200 },
    ];
    // computeBalance would be -1000 - 100 + 200 = -900
    // computeRealisedBalance only counts resolved: +100
    expect(computeRealisedBalance(bets)).toBe(100);
  });

  test('won bet with null payout treats as 0', () => {
    const bets = [{ amount: 100, status: 'won', payout: null }];
    expect(computeRealisedBalance(bets)).toBe(-100);
  });
});
