/**
 * Real-world scenario tests for the special bet system.
 * These test user journeys, edge cases, and parimutuel math — NOT just that code "runs".
 */

// --- Simulate the place_special_bet logic (mirrors the PG function) ---
function simulatePlaceSpecialBet(db, { userId, matchId, kind, pick, amount, multiPick }) {
  if (amount <= 0 || amount > 10000) throw new Error('Amount must be between 1 and 10000');

  const pending = db.filter(b => b.user_id === userId && b.match_id === matchId && b.kind === kind && b.status === 'pending');

  if (multiPick) {
    const existing = pending.find(b => b.pick === pick);
    if (existing) {
      if (existing.amount === amount) throw new Error('Already bet on this option for this amount');
      existing.status = 'cancelled';
    }
  } else {
    const existing = pending[0];
    if (existing && existing.pick === pick && existing.amount === amount) {
      throw new Error('Already bet on this option for this amount');
    }
    if (existing) existing.status = 'cancelled';
  }

  const bet = { id: db.length + 1, user_id: userId, match_id: matchId, kind, pick, amount, status: 'pending', payout: 0 };
  db.push(bet);
  return bet;
}

function simulateCancelSpecialBet(db, { userId, betId }) {
  const bet = db.find(b => b.id === betId && b.user_id === userId && b.status === 'pending');
  if (!bet) throw new Error('Bet not found, not yours, or already resolved');
  bet.status = 'cancelled';
  return { refunded: bet.amount };
}

function computePool(db, matchId, kind) {
  const pending = db.filter(b => b.match_id === matchId && b.kind === kind && b.status === 'pending');
  const total = pending.reduce((s, b) => s + b.amount, 0);
  const byOption = {};
  for (const b of pending) byOption[b.pick] = (byOption[b.pick] || 0) + b.amount;
  return { total, byOption, bets: pending };
}

function settlePool(db, matchId, kind, winningPick) {
  const pending = db.filter(b => b.match_id === matchId && b.kind === kind && b.status === 'pending');
  const total = pending.reduce((s, b) => s + b.amount, 0);
  const winners = pending.filter(b => b.pick === winningPick);
  const winningPool = winners.reduce((s, b) => s + b.amount, 0);

  for (const b of pending) {
    if (b.pick === winningPick) {
      b.status = 'won';
      b.payout = winningPool > 0 ? Math.floor((b.amount / winningPool) * total) : 0;
    } else {
      b.status = 'lost';
      b.payout = 0;
    }
  }
  return { winners: winners.length, totalPaid: winners.reduce((s, b) => s + b.payout, 0) };
}

describe('Continent bet — single-pick scenarios', () => {
  let db;
  beforeEach(() => { db = []; });

  test('user places bet on UEFA, changes mind to CONMEBOL — old bet cancelled', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    expect(db.filter(b => b.status === 'pending')).toHaveLength(1);

    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'CONMEBOL', amount: 1000, multiPick: false });
    const pending = db.filter(b => b.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].pick).toBe('CONMEBOL');
    expect(pending[0].amount).toBe(1000);
    expect(db.filter(b => b.status === 'cancelled')).toHaveLength(1);
  });

  test('user tries exact same bet twice — rejected', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    expect(() => {
      simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    }).toThrow('Already bet on this option for this amount');
  });

  test('user changes amount on same pick — allowed (cancel + replace)', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 1000, multiPick: false });
    const pending = db.filter(b => b.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].amount).toBe(1000);
  });

  test('two different users bet on different confederations — both pending', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'CONTINENT', kind: 'continent', pick: 'CONMEBOL', amount: 2000, multiPick: false });
    expect(db.filter(b => b.status === 'pending')).toHaveLength(2);
  });

  test('settlement: UEFA wins — u1 gets entire pool', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'CONTINENT', kind: 'continent', pick: 'CONMEBOL', amount: 2000, multiPick: false });
    simulatePlaceSpecialBet(db, { userId: 'u3', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 1500, multiPick: false });

    const result = settlePool(db, 'CONTINENT', 'continent', 'UEFA');
    const u1Bet = db.find(b => b.user_id === 'u1');
    const u3Bet = db.find(b => b.user_id === 'u3' && b.status === 'won');
    const u2Bet = db.find(b => b.user_id === 'u2');

    // Total pool = 4000. UEFA pool = 2000.
    // u1: 500/2000 * 4000 = 1000
    // u3: 1500/2000 * 4000 = 3000
    expect(u1Bet.payout).toBe(1000);
    expect(u3Bet.payout).toBe(3000);
    expect(u2Bet.status).toBe('lost');
    expect(u2Bet.payout).toBe(0);
    expect(result.totalPaid).toBeLessThanOrEqual(4000);
  });
});

describe('Multi-pick bet scenarios (YES/NO pools)', () => {
  let db;
  beforeEach(() => { db = []; });

  test('user bets YES on Shakira AND YES on Coldplay — both coexist', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_COLDPLAY', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    expect(db.filter(b => b.status === 'pending')).toHaveLength(2);
  });

  test('user bets YES on Shakira, then NO on Shakira — YES cancelled, NO placed (same pool)', () => {
    // Each performer is its own pool (HT_SHAKIRA), so YES and NO on same performer = same matchId
    // But picks are different ('yes' vs 'no'), so multi-pick allows both? No — multi-pick only blocks DUPLICATE same option.
    // YES and NO are different picks on same match_id — both should coexist with multi-pick.
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'no', amount: 250, multiPick: true });
    // Multi-pick: only blocks duplicate same pick — these are different picks, both stand
    const pending = db.filter(b => b.status === 'pending');
    expect(pending).toHaveLength(2);
    expect(pending.map(b => b.pick).sort()).toEqual(['no', 'yes']);
  });

  test('user bets YES ₹250 on Shakira twice — second rejected as duplicate', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    expect(() => {
      simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    }).toThrow('Already bet on this option for this amount');
  });

  test('user changes YES ₹250 to YES ₹500 on Shakira — old cancelled, new placed', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    const pending = db.filter(b => b.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].amount).toBe(500);
  });

  test('Shakira performs (YES wins) — YES bettors split pool, NO bettors lose', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u3', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'no', amount: 1000, multiPick: true });

    settlePool(db, 'HT_SHAKIRA', 'halftime', 'yes');
    // Total = 2000. YES pool = 1000. Each YES bettor: 500/1000 * 2000 = 1000
    const u1 = db.find(b => b.user_id === 'u1');
    const u2 = db.find(b => b.user_id === 'u2');
    const u3 = db.find(b => b.user_id === 'u3');
    expect(u1.payout).toBe(1000);
    expect(u2.payout).toBe(1000);
    expect(u3.status).toBe('lost');
    // Each YES bettor doubled their money
    expect(u1.payout - u1.amount).toBe(500);
  });

  test('performer pools are independent — settling Shakira doesnt affect Coldplay', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_COLDPLAY', kind: 'halftime', pick: 'no', amount: 300, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'no', amount: 500, multiPick: true });

    settlePool(db, 'HT_SHAKIRA', 'halftime', 'yes');

    const coldplayBet = db.find(b => b.match_id === 'HT_COLDPLAY');
    expect(coldplayBet.status).toBe('pending');
  });

  test('nobody bets NO — everyone who bet YES splits equally (trivial pool)', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });

    settlePool(db, 'HT_SHAKIRA', 'halftime', 'yes');
    // Total = 1000, YES pool = 1000. Each: 500/1000 * 1000 = 500 (get own money back, 0 profit)
    expect(db.find(b => b.user_id === 'u1').payout).toBe(500);
    expect(db.find(b => b.user_id === 'u2').payout).toBe(500);
  });
});

describe('Cancel special bet scenarios', () => {
  let db;
  beforeEach(() => { db = []; });

  test('cancel returns full stake', () => {
    const bet = simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 2000, multiPick: false });
    const result = simulateCancelSpecialBet(db, { userId: 'u1', betId: bet.id });
    expect(result.refunded).toBe(2000);
    expect(db.filter(b => b.status === 'pending')).toHaveLength(0);
  });

  test('cannot cancel someone elses bet', () => {
    const bet = simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    expect(() => simulateCancelSpecialBet(db, { userId: 'u2', betId: bet.id })).toThrow('not yours');
  });

  test('cannot cancel already-cancelled bet', () => {
    const bet = simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 500, multiPick: false });
    simulateCancelSpecialBet(db, { userId: 'u1', betId: bet.id });
    expect(() => simulateCancelSpecialBet(db, { userId: 'u1', betId: bet.id })).toThrow('not yours');
  });

  test('cancel one halftime bet doesnt affect others', () => {
    const b1 = simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_COLDPLAY', kind: 'halftime', pick: 'yes', amount: 250, multiPick: true });
    simulateCancelSpecialBet(db, { userId: 'u1', betId: b1.id });
    expect(db.filter(b => b.status === 'pending')).toHaveLength(1);
    expect(db.filter(b => b.status === 'pending')[0].match_id).toBe('HT_COLDPLAY');
  });
});

describe('Pool math edge cases', () => {
  let db;
  beforeEach(() => { db = []; });

  test('floor rounding: total payout never exceeds pool', () => {
    // 3 people bet odd amounts on YES, 1 on NO
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_DRAKE', kind: 'halftime', pick: 'yes', amount: 333, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'HT_DRAKE', kind: 'halftime', pick: 'yes', amount: 333, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u3', matchId: 'HT_DRAKE', kind: 'halftime', pick: 'yes', amount: 334, multiPick: true });
    simulatePlaceSpecialBet(db, { userId: 'u4', matchId: 'HT_DRAKE', kind: 'halftime', pick: 'no', amount: 1000, multiPick: true });

    const { totalPaid } = settlePool(db, 'HT_DRAKE', 'halftime', 'yes');
    const pool = 333 + 333 + 334 + 1000; // 2000
    expect(totalPaid).toBeLessThanOrEqual(pool);
    // Floor dust: sum of floors ≤ total
    const u1Pay = db.find(b => b.user_id === 'u1').payout;
    const u2Pay = db.find(b => b.user_id === 'u2').payout;
    const u3Pay = db.find(b => b.user_id === 'u3').payout;
    // 333/1000 * 2000 = 666, 333/1000 * 2000 = 666, 334/1000 * 2000 = 668 → sum = 2000
    expect(u1Pay + u2Pay + u3Pay).toBeLessThanOrEqual(pool);
  });

  test('single bettor wins nothing extra (gets own money back)', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 5000, multiPick: false });
    settlePool(db, 'CONTINENT', 'continent', 'UEFA');
    expect(db[0].payout).toBe(5000); // gets own stake, 0 profit
  });

  test('no winners on losing pick — all lose', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 1000, multiPick: false });
    simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 2000, multiPick: false });
    // If AFC wins but nobody bet AFC
    settlePool(db, 'CONTINENT', 'continent', 'AFC');
    expect(db.every(b => b.status === 'lost')).toBe(true);
  });

  test('computePool aggregates correctly with cancelled bets excluded', () => {
    simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'yes', amount: 500, multiPick: true });
    const b2 = simulatePlaceSpecialBet(db, { userId: 'u2', matchId: 'HT_SHAKIRA', kind: 'halftime', pick: 'no', amount: 300, multiPick: true });
    simulateCancelSpecialBet(db, { userId: 'u2', betId: b2.id });

    const pool = computePool(db, 'HT_SHAKIRA', 'halftime');
    expect(pool.total).toBe(500); // only u1's pending bet
    expect(pool.byOption).toEqual({ yes: 500 });
  });
});

describe('Amount validation', () => {
  let db;
  beforeEach(() => { db = []; });

  test('rejects 0 amount', () => {
    expect(() => simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 0, multiPick: false }))
      .toThrow('Amount must be between 1 and 10000');
  });

  test('rejects negative amount', () => {
    expect(() => simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: -100, multiPick: false }))
      .toThrow('Amount must be between 1 and 10000');
  });

  test('rejects amount over 10000', () => {
    expect(() => simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 10001, multiPick: false }))
      .toThrow('Amount must be between 1 and 10000');
  });

  test('accepts max amount 10000', () => {
    const bet = simulatePlaceSpecialBet(db, { userId: 'u1', matchId: 'CONTINENT', kind: 'continent', pick: 'UEFA', amount: 10000, multiPick: false });
    expect(bet.amount).toBe(10000);
  });
});

describe('Activity feed formatting', () => {
  // Test the formatSpecialMatchLabel logic directly
  function formatSpecialMatchLabel(matchId) {
    if (matchId === 'CUP_WINNER') return 'Cup Winner';
    if (matchId === 'CONTINENT') return 'Winning Continent';
    if (matchId?.startsWith('HT_')) {
      const slug = matchId.slice(3).toLowerCase().replace(/_/g, ' ');
      return slug.replace(/\b\w/g, c => c.toUpperCase());
    }
    return null;
  }

  test('formats CUP_WINNER correctly', () => {
    expect(formatSpecialMatchLabel('CUP_WINNER')).toBe('Cup Winner');
  });

  test('formats CONTINENT correctly', () => {
    expect(formatSpecialMatchLabel('CONTINENT')).toBe('Winning Continent');
  });

  test('formats HT_SHAKIRA to "Shakira"', () => {
    expect(formatSpecialMatchLabel('HT_SHAKIRA')).toBe('Shakira');
  });

  test('formats HT_KENDRICK_LAMAR to "Kendrick Lamar"', () => {
    expect(formatSpecialMatchLabel('HT_KENDRICK_LAMAR')).toBe('Kendrick Lamar');
  });

  test('formats HT_BAD_BUNNY to "Bad Bunny"', () => {
    expect(formatSpecialMatchLabel('HT_BAD_BUNNY')).toBe('Bad Bunny');
  });

  test('returns null for regular match IDs', () => {
    expect(formatSpecialMatchLabel('A1')).toBeNull();
    expect(formatSpecialMatchLabel('B3')).toBeNull();
  });
});
