/**
 * Tests for the match participation penalty system.
 *
 * Penalty rule:
 *   - Match bets only (not specials)
 *   - If 5, 6, or 7 of the 8 users bet on a match, the remaining users are
 *     penalised ₹50 each
 *   - If 4 or fewer bet, no penalty
 *   - Penalty amounts are added to the match pool as pending bets with
 *     pick='penalty', so they inflate winner payouts when the match resolves
 */

import { resolveMatchBets, computeBalance } from '@/lib/ledger';
import { getMinBet } from '@/lib/currency';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeBet(userId, pick, amount, kind = 'match') {
  return { id: `${userId}-${pick}`, user_id: userId, pick, amount, kind, status: 'pending', payout: null };
}

function makePenalty(userId, matchId = 'A1') {
  return makeBet(userId, 'penalty', 50, 'penalty');
}

// Pure JS re-implementation of the penalty threshold logic
// (mirrors apply_match_penalties in the SQL RPC)
function shouldApplyPenalties(matchBets) {
  const uniqueBettors = new Set(
    matchBets.filter(b => b.kind === 'match' && b.status !== 'cancelled').map(b => b.user_id)
  );
  return uniqueBettors.size >= 5;
}

function getPenalizedUsers(allUsers, matchBets) {
  const bettors = new Set(
    matchBets.filter(b => b.kind === 'match' && b.status !== 'cancelled').map(b => b.user_id)
  );
  return allUsers.filter(u => !bettors.has(u));
}

// ─── threshold tests ──────────────────────────────────────────────────────────

describe('penalty threshold — shouldApplyPenalties', () => {
  const USERS = ['jayesh', 'ashin', 'pratyush', 'manan', 'aryan', 'rahul', 'rohan', 'boidushya'];

  function betsForUsers(userIds) {
    return userIds.map(u => makeBet(u, 'home', 100));
  }

  test('0 bettors → no penalty', () => {
    expect(shouldApplyPenalties([])).toBe(false);
  });

  test('4 bettors → no penalty', () => {
    expect(shouldApplyPenalties(betsForUsers(USERS.slice(0, 4)))).toBe(false);
  });

  test('5 bettors → penalty triggers', () => {
    expect(shouldApplyPenalties(betsForUsers(USERS.slice(0, 5)))).toBe(true);
  });

  test('6 bettors → penalty triggers', () => {
    expect(shouldApplyPenalties(betsForUsers(USERS.slice(0, 6)))).toBe(true);
  });

  test('7 bettors → penalty triggers', () => {
    expect(shouldApplyPenalties(betsForUsers(USERS.slice(0, 7)))).toBe(true);
  });

  test('8 bettors → penalty triggers (nobody to penalise, but threshold met)', () => {
    expect(shouldApplyPenalties(betsForUsers(USERS))).toBe(true);
  });

  test('cancelled bets do not count toward threshold', () => {
    const bets = [
      { ...makeBet('jayesh', 'home', 100), status: 'cancelled' },
      { ...makeBet('ashin',  'home', 100), status: 'cancelled' },
      { ...makeBet('pratyush', 'home', 100), status: 'cancelled' },
      { ...makeBet('manan',  'home', 100), status: 'cancelled' },
      makeBet('aryan',  'home', 100),  // only 1 active
    ];
    expect(shouldApplyPenalties(bets)).toBe(false);
  });

  test('duplicate user bets (same user, multiple picks) count as 1 bettor', () => {
    const bets = [
      makeBet('jayesh', 'home', 100),
      makeBet('jayesh', 'away', 100), // same user, second pick — should still be 1
      makeBet('ashin',  'home', 100),
      makeBet('pratyush', 'home', 100),
      makeBet('manan',  'home', 100),
    ];
    expect(shouldApplyPenalties(bets)).toBe(false); // only 4 unique users
  });
});

// ─── who gets penalised ───────────────────────────────────────────────────────

describe('getPenalizedUsers', () => {
  const ALL = ['jayesh', 'ashin', 'pratyush', 'manan', 'aryan', 'rahul', 'rohan', 'boidushya'];

  test('5 bettors → 3 penalised', () => {
    const bets = ALL.slice(0, 5).map(u => makeBet(u, 'home', 100));
    const penalized = getPenalizedUsers(ALL, bets);
    expect(penalized).toHaveLength(3);
    expect(penalized).toEqual(ALL.slice(5));
  });

  test('6 bettors → 2 penalised', () => {
    const bets = ALL.slice(0, 6).map(u => makeBet(u, 'home', 100));
    expect(getPenalizedUsers(ALL, bets)).toHaveLength(2);
  });

  test('7 bettors → 1 penalised', () => {
    const bets = ALL.slice(0, 7).map(u => makeBet(u, 'home', 100));
    expect(getPenalizedUsers(ALL, bets)).toHaveLength(1);
  });

  test('8 bettors → 0 penalised', () => {
    const bets = ALL.map(u => makeBet(u, 'home', 100));
    expect(getPenalizedUsers(ALL, bets)).toHaveLength(0);
  });
});

// ─── penalty bets inflate the pool in resolveMatchBets ───────────────────────

describe('resolveMatchBets — penalty amounts flow into winner payouts', () => {
  test('penalty bet is treated as lost and inflates pool', () => {
    // 2 real bettors + 1 penalty user
    // alice: home 100, bob: away 100, penalty: 50
    // total pool = 250, alice wins home
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob',   'away', 100),
      makePenalty('carol'),  // penalty bet (pick='penalty')
    ];

    const resolved = resolveMatchBets(bets, 'home');

    const alice  = resolved.find(b => b.user_id === 'alice');
    const bob    = resolved.find(b => b.user_id === 'bob');
    const carol  = resolved.find(b => b.user_id === 'carol');

    // Alice wins the entire pool of 250 (she's the only home bettor)
    expect(alice.status).toBe('won');
    expect(alice.payout).toBe(250);

    // Bob loses
    expect(bob.status).toBe('lost');
    expect(bob.payout).toBeNull();

    // Carol's penalty bet also loses (pick='penalty' != 'home')
    expect(carol.status).toBe('lost');
    expect(carol.payout).toBeNull();
  });

  test('multiple penalty users each add 50 to the pool', () => {
    // 5 bettors on home, 3 penalty users → pool = 5*100 + 3*50 = 650
    const homeBettors = ['u1', 'u2', 'u3', 'u4', 'u5'].map(u => makeBet(u, 'home', 100));
    const penalties   = ['p1', 'p2', 'p3'].map(u => makePenalty(u));
    const bets = [...homeBettors, ...penalties];

    const resolved = resolveMatchBets(bets, 'home');

    const totalPayout = resolved
      .filter(b => b.status === 'won')
      .reduce((s, b) => s + (b.payout || 0), 0);

    // Total pool = 650, all goes to home winners (floor rounding may lose 1–4 coins)
    expect(totalPayout).toBeGreaterThanOrEqual(646);
    expect(totalPayout).toBeLessThanOrEqual(650);

    // Penalty bets always lose
    for (const p of resolved.filter(b => b.pick === 'penalty')) {
      expect(p.status).toBe('lost');
    }
  });

  test('no winners (all bet on losing side) — penalty bets also refunded', () => {
    // Everyone bet home, away wins — resolveMatchBets refunds all (cancelled)
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob',   'home', 200),
      makePenalty('carol'),
    ];
    const resolved = resolveMatchBets(bets, 'away');
    for (const b of resolved) {
      expect(b.status).toBe('cancelled');
    }
  });

  test('penalty amount does NOT count toward winning pool calculation', () => {
    // alice: home 100, bob: home 300, penalty: 50
    // winning pool (home only) = 400, total pool = 450
    // alice payout = floor(100/400 * 450) = floor(112.5) = 112
    // bob   payout = floor(300/400 * 450) = floor(337.5) = 337
    const bets = [
      makeBet('alice', 'home', 100),
      makeBet('bob',   'home', 300),
      makePenalty('carol'),
    ];
    const resolved = resolveMatchBets(bets, 'home');
    const alice = resolved.find(b => b.user_id === 'alice');
    const bob   = resolved.find(b => b.user_id === 'bob');
    expect(alice.payout).toBe(112);
    expect(bob.payout).toBe(337);
  });
});

// ─── balance impact of penalty bets ──────────────────────────────────────────

describe('computeBalance — penalty bets deducted like any other lost bet', () => {
  test('pending penalty bet reduces balance', () => {
    const bets = [makePenalty('user1')];
    // pending bet: deducted from balance
    expect(computeBalance(bets)).toBe(-50);
  });

  test('lost penalty bet reduces balance', () => {
    const bets = [{ ...makePenalty('user1'), status: 'lost' }];
    expect(computeBalance(bets)).toBe(-50);
  });

  test('cancelled penalty bet does not affect balance', () => {
    const bets = [{ ...makePenalty('user1'), status: 'cancelled' }];
    expect(computeBalance(bets)).toBe(0);
  });

  test('mix: real bet won + penalty lost = correct net', () => {
    const bets = [
      { ...makeBet('user1', 'home', 200), status: 'won', payout: 400 },
      { ...makePenalty('user1'), status: 'lost' },
    ];
    // net = -200 + 400 - 50 = 150
    expect(computeBalance(bets)).toBe(150);
  });
});

// ─── min bet enforcement (group stage = 50) ───────────────────────────────────

describe('getMinBet — group stage matches', () => {
  test('group stage matches have 50 minimum', () => {
    expect(getMinBet('A1')).toBe(50);
    expect(getMinBet('L6')).toBe(50);
  });

  test('knockout matches have stage-based minimums', () => {
    expect(getMinBet('R32-1')).toBe(50);
    expect(getMinBet('R16-4')).toBe(100);
    expect(getMinBet('QF-2')).toBe(200);
    expect(getMinBet('SF-1')).toBe(300);
    expect(getMinBet('FIN-1')).toBe(500);
  });
});
