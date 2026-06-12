import { resolveMatchBets } from '@/lib/ledger';

function makeBet(userId, pick, amount) {
  return { id: `${userId}-${pick}`, user_id: userId, pick, amount, status: 'pending', payout: null };
}

describe('resolveMatchBets', () => {
  test('basic home win — losers get nothing, winners split pool proportionally', () => {
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob', 'away', 200),
      makeBet('carol', 'home', 300),
    ];
    const resolved = resolveMatchBets(bets, 'home');

    const alice = resolved.find(b => b.user_id === 'alice');
    const bob = resolved.find(b => b.user_id === 'bob');
    const carol = resolved.find(b => b.user_id === 'carol');

    expect(alice.status).toBe('won');
    expect(carol.status).toBe('won');
    expect(bob.status).toBe('lost');
    expect(bob.payout).toBeNull();

    // Total pool = 600. Alice staked 100/400 of winning pool → floor(100/400 * 600) = 150
    expect(alice.payout).toBe(150);
    // Carol staked 300/400 → floor(300/400 * 600) = 450
    expect(carol.payout).toBe(450);
  });

  test('away win', () => {
    const bets = [
      makeBet('alice', 'home', 50),
      makeBet('bob', 'away', 50),
    ];
    const resolved = resolveMatchBets(bets, 'away');
    expect(resolved.find(b => b.user_id === 'alice').status).toBe('lost');
    expect(resolved.find(b => b.user_id === 'bob').status).toBe('won');
    expect(resolved.find(b => b.user_id === 'bob').payout).toBe(100);
  });

  test('draw win', () => {
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob', 'draw', 100),
      makeBet('carol', 'away', 100),
    ];
    const resolved = resolveMatchBets(bets, 'draw');
    expect(resolved.find(b => b.user_id === 'bob').status).toBe('won');
    expect(resolved.find(b => b.user_id === 'bob').payout).toBe(300);
    expect(resolved.find(b => b.user_id === 'alice').status).toBe('lost');
    expect(resolved.find(b => b.user_id === 'carol').status).toBe('lost');
  });

  test('no winners — everyone gets refunded (cancelled)', () => {
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob', 'home', 200),
    ];
    // Nobody bet on away, but away wins
    const resolved = resolveMatchBets(bets, 'away');
    for (const b of resolved) {
      expect(b.status).toBe('cancelled');
      expect(b.payout).toBeNull();
    }
  });

  test('single bettor wins entire pool', () => {
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob', 'away', 500),
      makeBet('carol', 'away', 400),
    ];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.user_id === 'alice').payout).toBe(1000);
  });

  test('rounding — payouts use floor (house keeps dust)', () => {
    const bets = [
      makeBet('alice', 'home', 33),
      makeBet('bob', 'home', 33),
      makeBet('carol', 'away', 34),
    ];
    // Total pool = 100. Winning pool (home) = 66.
    // Each winner: floor(33/66 * 100) = floor(50) = 50
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.user_id === 'alice').payout).toBe(50);
    expect(resolved.find(b => b.user_id === 'bob').payout).toBe(50);
    // Total paid out = 100, no dust in this case. But test uneven:
  });

  test('rounding with dust — total payout <= total pool (never overpay)', () => {
    const bets = [
      makeBet('alice', 'home', 10),
      makeBet('bob', 'home', 10),
      makeBet('carol', 'home', 10),
      makeBet('dave', 'away', 70),
    ];
    // Total pool = 100. Winning pool = 30.
    // Each winner: floor(10/30 * 100) = floor(33.33) = 33
    const resolved = resolveMatchBets(bets, 'home');
    const totalPaid = resolved
      .filter(b => b.status === 'won')
      .reduce((sum, b) => sum + b.payout, 0);
    expect(totalPaid).toBeLessThanOrEqual(100);
    expect(totalPaid).toBe(99); // 33 * 3 = 99, 1 coin dust
  });

  test('empty bets array — returns empty', () => {
    expect(resolveMatchBets([], 'home')).toEqual([]);
  });

  test('ignores already-resolved bets (only processes pending)', () => {
    const bets = [
      { id: '1', user_id: 'alice', pick: 'home', amount: 100, status: 'won', payout: 200 },
      makeBet('bob', 'home', 50),
      makeBet('carol', 'away', 50),
    ];
    const resolved = resolveMatchBets(bets, 'home');
    // Alice's existing won bet should be unchanged
    expect(resolved[0]).toEqual(bets[0]);
    // Bob wins the pending pool (50+50=100, bob gets all)
    expect(resolved[1].status).toBe('won');
    expect(resolved[1].payout).toBe(100);
    expect(resolved[2].status).toBe('lost');
  });

  test('large pool — payout math correct at scale', () => {
    const bets = [
      makeBet('whale', 'home', 50000),
      makeBet('minnow', 'home', 100),
      makeBet('loser1', 'away', 30000),
      makeBet('loser2', 'draw', 20000),
    ];
    // Total = 100100. Winning pool = 50100.
    const resolved = resolveMatchBets(bets, 'home');
    const whale = resolved.find(b => b.user_id === 'whale');
    const minnow = resolved.find(b => b.user_id === 'minnow');
    // whale: floor(50000/50100 * 100100) = floor(99900.199...) = 99900
    expect(whale.payout).toBe(99900);
    // minnow: floor(100/50100 * 100100) = floor(199.800...) = 199
    expect(minnow.payout).toBe(199);
  });
});
