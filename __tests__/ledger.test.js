import { computeBalance, resolveMatchBets, validateBetPlacement } from '@/lib/ledger';

// computeBalance now returns NET position (0 start, no wallet):
//   net = SUM(payout WHERE won) - SUM(amount WHERE not cancelled)

// =============================================================================
// 1. BALANCE (NET POSITION) COMPUTATION
// =============================================================================

describe('computeBalance — net position', () => {
  test('new user with no bets has net 0', () => {
    expect(computeBalance([])).toBe(0);
  });

  test('single pending bet makes net negative', () => {
    const bets = [{ amount: 100, status: 'pending', payout: null }];
    expect(computeBalance(bets)).toBe(-100);
  });

  test('single won bet: stake deducted, payout added', () => {
    // bet 100, win 300 → net = +200
    const bets = [{ amount: 100, status: 'won', payout: 300 }];
    expect(computeBalance(bets)).toBe(200);
  });

  test('single lost bet: stake deducted, nothing added', () => {
    const bets = [{ amount: 200, status: 'lost', payout: null }];
    expect(computeBalance(bets)).toBe(-200);
  });

  test('cancelled bet does NOT affect net', () => {
    const bets = [{ amount: 500, status: 'cancelled', payout: null }];
    expect(computeBalance(bets)).toBe(0);
  });

  test('mix of all statuses computes correctly', () => {
    const bets = [
      { amount: 100, status: 'pending', payout: null },   // -100
      { amount: 200, status: 'won',     payout: 600 },    // -200 + 600
      { amount: 300, status: 'lost',    payout: null },    // -300
      { amount: 400, status: 'cancelled', payout: null }, // free
      { amount: 50,  status: 'won',     payout: 150 },    // -50 + 150
    ];
    // -100 - 200 + 600 - 300 - 50 + 150 = 100
    expect(computeBalance(bets)).toBe(100);
  });

  test('won bet with payout=0 still deducts stake', () => {
    const bets = [{ amount: 100, status: 'won', payout: 0 }];
    expect(computeBalance(bets)).toBe(-100);
  });

  test('won bet with null payout treats payout as 0', () => {
    const bets = [{ amount: 100, status: 'won', payout: null }];
    expect(computeBalance(bets)).toBe(-100);
  });

  test('net is negative when all bets lost', () => {
    const bets = Array.from({ length: 10 }, () => ({
      amount: 100, status: 'lost', payout: null,
    }));
    expect(computeBalance(bets)).toBe(-1000);
  });

  test('many cancelled bets do not affect net', () => {
    const bets = Array.from({ length: 100 }, () => ({
      amount: 999, status: 'cancelled', payout: null,
    }));
    expect(computeBalance(bets)).toBe(0);
  });

  test('large win makes net highly positive', () => {
    const bets = [{ amount: 100, status: 'won', payout: 10000 }];
    // -100 + 10000 = 9900
    expect(computeBalance(bets)).toBe(9900);
  });

  test('interleaved cancelled and active bets', () => {
    const bets = [
      { amount: 1000, status: 'pending',   payout: null },
      { amount: 1000, status: 'cancelled', payout: null },
      { amount: 1000, status: 'pending',   payout: null },
      { amount: 1000, status: 'cancelled', payout: null },
      { amount: 1000, status: 'pending',   payout: null },
    ];
    // -1000 -1000 -1000 = -3000
    expect(computeBalance(bets)).toBe(-3000);
  });

  test('won bet payout exactly equal to stake — net 0 for that bet', () => {
    const bets = [{ amount: 500, status: 'won', payout: 500 }];
    expect(computeBalance(bets)).toBe(0);
  });

  test('net can be zero even with activity (wins and losses balance out)', () => {
    const bets = [
      { amount: 200, status: 'won',  payout: 400 }, // +200 net
      { amount: 200, status: 'lost', payout: null }, // -200 net
    ];
    expect(computeBalance(bets)).toBe(0);
  });
});

// =============================================================================
// 2. PLACE BET VALIDATION (no balance check — anyone can bet any positive amount)
// =============================================================================

describe('validateBetPlacement', () => {
  test('valid home bet passes', () => {
    expect(validateBetPlacement({ pick: 'home', amount: 100 }))
      .toEqual({ valid: true });
  });

  test('valid draw pick passes', () => {
    expect(validateBetPlacement({ pick: 'draw', amount: 1 }))
      .toEqual({ valid: true });
  });

  test('invalid pick rejected', () => {
    const result = validateBetPlacement({ pick: 'win', amount: 100 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid pick/);
  });

  test('empty string pick rejected', () => {
    expect(validateBetPlacement({ pick: '', amount: 100 }).valid).toBe(false);
  });

  test('null pick rejected', () => {
    expect(validateBetPlacement({ pick: null, amount: 100 }).valid).toBe(false);
  });

  test('zero amount rejected', () => {
    const result = validateBetPlacement({ pick: 'home', amount: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/);
  });

  test('negative amount rejected', () => {
    const result = validateBetPlacement({ pick: 'away', amount: -50 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/);
  });

  test('no balance cap — any positive amount passes', () => {
    // Previously 5001 would fail "Insufficient balance". Now it passes.
    expect(validateBetPlacement({ pick: 'home', amount: 5001 })).toEqual({ valid: true });
    expect(validateBetPlacement({ pick: 'home', amount: 100000 })).toEqual({ valid: true });
  });

  test('non-number amount rejected', () => {
    expect(validateBetPlacement({ pick: 'home', amount: '100' }).valid).toBe(false);
  });

  test('NaN amount rejected', () => {
    expect(validateBetPlacement({ pick: 'home', amount: NaN }).valid).toBe(false);
  });

  test('Infinity amount rejected', () => {
    expect(validateBetPlacement({ pick: 'home', amount: Infinity }).valid).toBe(false);
  });

  test('fractional amount passes validation (PG floors it)', () => {
    expect(validateBetPlacement({ pick: 'home', amount: 0.5 })).toEqual({ valid: true });
  });

  test('amount=1 (minimum) passes', () => {
    expect(validateBetPlacement({ pick: 'away', amount: 1 })).toEqual({ valid: true });
  });
});

// =============================================================================
// 3. SIDE-SWITCHING LOGIC
// =============================================================================

describe('place bet — side switching and additive logic', () => {
  function simulatePlaceBet(existingBets, newPick, newAmount) {
    let bets = [...existingBets];

    // Reject if already pending on this exact pick (matches RPC behavior)
    const alreadyOnSide = bets.some(b => b.status === 'pending' && b.pick === newPick);
    if (alreadyOnSide) {
      return { error: 'Already bet on this side', bets };
    }

    // Cancel ALL pending bets (handles both normal switch and prior multi-pending bug state)
    const hadPending = bets.some(b => b.status === 'pending');
    if (hadPending) {
      bets = bets.map(b => b.status === 'pending' ? { ...b, status: 'cancelled' } : b);
    }

    const validation = validateBetPlacement({ pick: newPick, amount: newAmount });
    if (!validation.valid) {
      return { error: validation.error, bets };
    }

    bets.push({ amount: newAmount, status: 'pending', payout: null, pick: newPick });
    return { error: null, bets, net: computeBalance(bets) };
  }

  test('switching sides cancels existing pending bets', () => {
    const existing = [{ amount: 3000, status: 'pending', payout: null, pick: 'home' }];
    const result = simulatePlaceBet(existing, 'away', 4000);
    expect(result.error).toBeNull();
    // net: -4000 (old 3000 cancelled, new 4000 pending)
    expect(result.net).toBe(-4000);
  });

  test('placing on same side is rejected — use cancel-and-rebet to change amount', () => {
    const existing = [{ amount: 1000, status: 'pending', payout: null, pick: 'home' }];
    const result = simulatePlaceBet(existing, 'home', 500);
    expect(result.error).toMatch(/Already bet on this side/);
  });

  test('multiple pending bets from prior bug state — all cancelled when switching', () => {
    // Simulates B4-style bug: user somehow has draw + home both pending
    const existing = [
      { amount: 250, status: 'pending', payout: null, pick: 'draw' },
      { amount: 100, status: 'pending', payout: null, pick: 'home' },
    ];
    const result = simulatePlaceBet(existing, 'away', 150);
    expect(result.error).toBeNull();
    // Both old pending bets cancelled, only new away bet active
    const pending = result.bets.filter(b => b.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].pick).toBe('away');
    expect(pending[0].amount).toBe(150);
    const cancelled = result.bets.filter(b => b.status === 'cancelled');
    expect(cancelled).toHaveLength(2);
    // Net only reflects the new pending bet
    expect(result.net).toBe(-150);
  });

  test('switching sides — multiple existing bets all get cancelled', () => {
    const existing = [
      { amount: 1000, status: 'pending', payout: null, pick: 'home' },
      { amount: 500,  status: 'pending', payout: null, pick: 'home' },
      { amount: 200,  status: 'pending', payout: null, pick: 'home' },
    ];
    const result = simulatePlaceBet(existing, 'draw', 4000);
    expect(result.error).toBeNull();
    expect(result.net).toBe(-4000);
    const pendingBets = result.bets.filter(b => b.status === 'pending');
    expect(pendingBets).toHaveLength(1);
    expect(pendingBets[0].pick).toBe('draw');
  });

  test('no balance cap — can place bet larger than any previous position', () => {
    const existing = [{ amount: 100, status: 'pending', payout: null, pick: 'home' }];
    const result = simulatePlaceBet(existing, 'away', 100000);
    expect(result.error).toBeNull();
    expect(result.net).toBe(-100000);
  });
});

// =============================================================================
// 4. CANCEL BETS
// =============================================================================

describe('cancel bets logic', () => {
  test('cancelling a pending bet restores net to 0', () => {
    const before = [{ amount: 500, status: 'pending', payout: null }];
    expect(computeBalance(before)).toBe(-500);

    const after = [{ amount: 500, status: 'cancelled', payout: null }];
    expect(computeBalance(after)).toBe(0);
  });

  test('cancelling multiple pending bets restores net fully', () => {
    const before = [
      { amount: 100, status: 'pending', payout: null },
      { amount: 200, status: 'pending', payout: null },
      { amount: 300, status: 'pending', payout: null },
    ];
    expect(computeBalance(before)).toBe(-600);

    const after = before.map(b => ({ ...b, status: 'cancelled' }));
    expect(computeBalance(after)).toBe(0);
  });

  test('cancelling already-cancelled bets has no effect', () => {
    const bets = [{ amount: 500, status: 'cancelled', payout: null }];
    expect(computeBalance(bets)).toBe(0);
  });

  test('cancel with mix of statuses only affects pending ones', () => {
    const bets = [
      { amount: 100, status: 'pending',   payout: null },
      { amount: 200, status: 'won',       payout: 500 },
      { amount: 300, status: 'lost',      payout: null },
      { amount: 400, status: 'cancelled', payout: null },
    ];
    // net before: -100 - 200 + 500 - 300 = -100
    expect(computeBalance(bets)).toBe(-100);

    const after = bets.map(b =>
      b.status === 'pending' ? { ...b, status: 'cancelled' } : b
    );
    // net after cancelling pending: -200 + 500 - 300 = 0
    expect(computeBalance(after)).toBe(0);
  });
});

// =============================================================================
// 5. RESOLVE MATCH — parimutuel payouts
// =============================================================================

describe('resolveMatchBets', () => {
  test('single winner takes the entire pool', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 200, pick: 'away', status: 'pending' },
      { id: 3, user_id: 'c', amount: 300, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    const winner = resolved.find(b => b.id === 1);
    expect(winner.status).toBe('won');
    expect(winner.payout).toBe(600); // (100/100)*600
    expect(resolved.find(b => b.id === 2).status).toBe('lost');
    expect(resolved.find(b => b.id === 3).status).toBe('lost');
  });

  test('multiple winners split proportionally', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 300, pick: 'home', status: 'pending' },
      { id: 3, user_id: 'c', amount: 200, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.id === 1).payout).toBe(150);  // (100/400)*600
    expect(resolved.find(b => b.id === 2).payout).toBe(450);  // (300/400)*600
  });

  test('no winners — all bets refunded (cancelled)', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 200, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'draw');
    expect(resolved.every(b => b.status === 'cancelled')).toBe(true);
    expect(resolved.every(b => b.payout === null)).toBe(true);
  });

  test('integer truncation (floor) in payout', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 10, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 20, pick: 'home', status: 'pending' },
      { id: 3, user_id: 'c', amount: 70, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.id === 1).payout).toBe(33);  // floor(10/30*100)
    expect(resolved.find(b => b.id === 2).payout).toBe(66);  // floor(20/30*100)
  });

  test('all bets on same side — everyone gets stake back exactly', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 200, pick: 'home', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.id === 1).payout).toBe(100);
    expect(resolved.find(b => b.id === 2).payout).toBe(200);
  });

  test('already-resolved bets are untouched', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'won', payout: 300 },
      { id: 2, user_id: 'b', amount: 200, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'away');
    expect(resolved.find(b => b.id === 1)).toEqual(bets[0]); // unchanged
    expect(resolved.find(b => b.id === 2).status).toBe('won');
    expect(resolved.find(b => b.id === 2).payout).toBe(200);
  });

  test('double resolution — no pending bets, returns unchanged', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 200, pick: 'away', status: 'pending' },
    ];
    const first = resolveMatchBets(bets, 'home');
    const second = resolveMatchBets(first, 'home');
    expect(second).toEqual(first);
  });

  test('large group — proportional split stays correct', () => {
    const bets = [];
    for (let i = 0; i < 10; i++) {
      bets.push({ id: i, user_id: `w${i}`, amount: 100, pick: 'home', status: 'pending' });
    }
    for (let i = 10; i < 20; i++) {
      bets.push({ id: i, user_id: `l${i}`, amount: 200, pick: 'away', status: 'pending' });
    }
    // Pool=3000, winning=1000. Each winner: (100/1000)*3000 = 300
    const resolved = resolveMatchBets(bets, 'home');
    resolved.filter(b => b.status === 'won').forEach(w => expect(w.payout).toBe(300));
    resolved.filter(b => b.status === 'lost').forEach(l => expect(l.payout).toBeNull());
  });

  test('single bet — winner gets stake back', () => {
    const bets = [{ id: 1, user_id: 'a', amount: 500, pick: 'draw', status: 'pending' }];
    const resolved = resolveMatchBets(bets, 'draw');
    expect(resolved[0].payout).toBe(500);
    expect(resolved[0].status).toBe('won');
  });

  test('single bet — only loser present means all bets refunded', () => {
    const bets = [{ id: 1, user_id: 'a', amount: 500, pick: 'draw', status: 'pending' }];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved[0].status).toBe('cancelled');
  });

  test('resolve empty array returns empty', () => {
    expect(resolveMatchBets([], 'home')).toEqual([]);
  });

  test('only cancelled bets — no change', () => {
    const bets = [{ id: 1, user_id: 'a', amount: 100, pick: 'home', status: 'cancelled' }];
    expect(resolveMatchBets(bets, 'home')).toEqual(bets);
  });
});

// =============================================================================
// 6. FULL LIFECYCLE SCENARIOS
// =============================================================================

describe('full lifecycle scenarios', () => {
  test('place → cancel → place again — net correct', () => {
    let bets = [];
    bets.push({ amount: 2000, status: 'pending', payout: null });
    expect(computeBalance(bets)).toBe(-2000);

    bets = bets.map(b => ({ ...b, status: 'cancelled' }));
    expect(computeBalance(bets)).toBe(0);

    bets.push({ amount: 4000, status: 'pending', payout: null });
    expect(computeBalance(bets)).toBe(-4000);
  });

  test('bet → win → place another larger bet', () => {
    let bets = [];
    bets.push({ amount: 100, status: 'won', payout: 500 });
    // net: -100 + 500 = +400
    expect(computeBalance(bets)).toBe(400);

    bets.push({ amount: 10000, status: 'pending', payout: null });
    // net: 400 - 10000 = -9600
    expect(computeBalance(bets)).toBe(-9600);
  });

  test('place → resolve (lose) — net goes negative', () => {
    let bets = [];
    bets.push({ amount: 4000, status: 'lost', payout: null });
    expect(computeBalance(bets)).toBe(-4000);

    // No balance cap — can place another bet even with negative net
    const validation = validateBetPlacement({ pick: 'home', amount: 5000 });
    expect(validation.valid).toBe(true);
  });

  test('multiple matches — net is global across all', () => {
    const bets = [
      { amount: 1000, status: 'pending', payout: null },
      { amount: 2000, status: 'pending', payout: null },
      { amount: 500,  status: 'won',     payout: 1500 },
    ];
    // -1000 -2000 -500 +1500 = -2000
    expect(computeBalance(bets)).toBe(-2000);
  });

  test('cancel on one match doesnt affect net from other matches', () => {
    const bets = [
      { amount: 1000, status: 'pending',   payout: null, match_id: 'm1' },
      { amount: 2000, status: 'pending',   payout: null, match_id: 'm2' },
    ];
    const afterCancel = bets.map(b =>
      b.match_id === 'm1' ? { ...b, status: 'cancelled' } : b
    );
    expect(computeBalance(afterCancel)).toBe(-2000);
  });

  test('user with complex history — stress test', () => {
    const bets = [
      { amount: 500,  status: 'won',       payout: 1500 },
      { amount: 300,  status: 'lost',      payout: null },
      { amount: 200,  status: 'cancelled', payout: null },
      { amount: 400,  status: 'pending',   payout: null },
      { amount: 1000, status: 'cancelled', payout: null },
      { amount: 100,  status: 'won',       payout: 250  },
      { amount: 100,  status: 'won',       payout: 250  },
    ];
    // -500 +1500 -300 -400 -100+250 -100+250 = 600
    expect(computeBalance(bets)).toBe(600);
  });

  test('zero-sum invariant across group — all nets sum to 0', () => {
    // In a parimutuel pool, what's lost by some equals what's won by others
    const bets = [
      // User A: bet 100, lost
      { user_id: 'a', amount: 100, status: 'lost',  payout: null },
      // User B: bet 200, won 300 (got A's 100 + their 200 back)
      { user_id: 'b', amount: 200, status: 'won',   payout: 300 },
    ];
    const netA = bets.filter(b => b.user_id === 'a').reduce((s, b) => {
      if (b.status !== 'cancelled') s -= b.amount;
      if (b.status === 'won') s += (b.payout || 0);
      return s;
    }, 0);
    const netB = bets.filter(b => b.user_id === 'b').reduce((s, b) => {
      if (b.status !== 'cancelled') s -= b.amount;
      if (b.status === 'won') s += (b.payout || 0);
      return s;
    }, 0);
    // A: -100. B: -200+300 = +100. Sum = 0.
    expect(netA + netB).toBe(0);
  });
});

// =============================================================================
// 7. BOUNDARY & EDGE CASES
// =============================================================================

describe('boundary and edge cases', () => {
  test('computeBalance with undefined payout on won bet treats as 0', () => {
    const bets = [{ amount: 100, status: 'won', payout: undefined }];
    expect(computeBalance(bets)).toBe(-100);
  });

  test('amount=1 smallest bet', () => {
    const bets = [{ amount: 1, status: 'pending', payout: null }];
    expect(computeBalance(bets)).toBe(-1);
  });

  test('won payout exactly doubles stake', () => {
    const bets = [{ amount: 500, status: 'won', payout: 1000 }];
    expect(computeBalance(bets)).toBe(500);
  });

  test('resolve — winner payout can be less than stake (high competition)', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 900, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 100, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    expect(resolved.find(b => b.id === 1).payout).toBe(1000);
  });

  test('payout always >= stake for sole winner', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 50,   pick: 'draw', status: 'pending' },
      { id: 2, user_id: 'b', amount: 1000, pick: 'home', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'draw');
    expect(resolved.find(b => b.id === 1).payout).toBe(1050);
    expect(resolved.find(b => b.id === 1).payout).toBeGreaterThanOrEqual(50);
  });

  test('uneven split worst-case truncation', () => {
    const bets = [
      { id: 1, user_id: 'a', amount: 1, pick: 'home', status: 'pending' },
      { id: 2, user_id: 'b', amount: 1, pick: 'home', status: 'pending' },
      { id: 3, user_id: 'c', amount: 1, pick: 'home', status: 'pending' },
      { id: 4, user_id: 'd', amount: 100, pick: 'away', status: 'pending' },
    ];
    const resolved = resolveMatchBets(bets, 'home');
    // Pool=103, winning=3. Each: floor(1/3*103)=34
    resolved.filter(b => b.status === 'won').forEach(w => expect(w.payout).toBe(34));
  });
});
