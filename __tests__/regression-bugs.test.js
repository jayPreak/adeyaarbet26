/**
 * Regression tests for bugs found during the FIFA ID contamination fix,
 * leaderboard/settlement display fixes, and special bets work.
 *
 * Each test prevents a specific bug from recurring.
 */

import { mapFifaToSchedule, TEAM_CODE_ALIAS } from '@/lib/schedule-sync';
import { getMatch, getMatchKickoffTs, MATCHES } from '@/lib/data';
import { computeBalance, computeRealisedBalance, resolveMatchBets } from '@/lib/ledger';
import { SPECIALS, getSpecial, getSpecialByMatchId } from '@/lib/specials';

// =============================================================================
// 1. FIFA ID CONTAMINATION — schedule sync must never output numeric IDs
// =============================================================================

describe('FIFA ID contamination prevention', () => {
  const sampleFifaMatches = [
    { GroupName: [{ Locale: 'en-GB', Description: 'Group A' }], Home: { Abbreviation: 'MEX' }, Away: { Abbreviation: 'RSA' }, Date: '2026-06-11T19:00:00Z' },
    { GroupName: [{ Locale: 'en-GB', Description: 'Group B' }], Home: { Abbreviation: 'CAN' }, Away: { Abbreviation: 'BIH' }, Date: '2026-06-12T19:00:00Z' },
  ];

  test('mapFifaToSchedule output IDs are always static strings (never numeric)', () => {
    const { schedule } = mapFifaToSchedule(sampleFifaMatches);
    for (const entry of schedule) {
      expect(entry.id).toMatch(/^[A-L]\d+$/);
      expect(/^\d+$/.test(entry.id)).toBe(false);
    }
  });

  test('all MATCHES entries have valid static IDs (letter + number)', () => {
    for (const m of MATCHES) {
      expect(m.id).toMatch(/^[A-L]\d+$/);
    }
  });

  test('getMatch returns undefined for FIFA numeric IDs', () => {
    expect(getMatch('400021443')).toBeUndefined();
    expect(getMatch('400021500')).toBeUndefined();
    expect(getMatch('123456789')).toBeUndefined();
  });

  test('getMatch returns valid match for all static IDs', () => {
    expect(getMatch('A1')).toBeDefined();
    expect(getMatch('A1').home).toBe('MEX');
    expect(getMatch('B1')).toBeDefined();
    expect(getMatch('L6')).toBeDefined();
  });

  test('KSA alias maps correctly to SAU for schedule sync', () => {
    expect(TEAM_CODE_ALIAS.KSA).toBe('SAU');
  });
});

// =============================================================================
// 2. kickoffTs ISO vs epoch — getMatchKickoffTs must always return epoch ms
// =============================================================================

describe('kickoffTs normalization', () => {
  test('ISO string → epoch ms', () => {
    const iso = '2026-06-11T19:00:00+00:00';
    const result = getMatchKickoffTs({ kickoffTs: iso });
    expect(typeof result).toBe('number');
    expect(result).toBe(new Date(iso).getTime());
  });

  test('epoch ms number passes through', () => {
    const epoch = new Date('2026-06-11T19:00:00Z').getTime();
    const result = getMatchKickoffTs({ kickoffTs: epoch });
    expect(result).toBe(epoch);
  });

  test('null/missing returns null (not NaN, not undefined)', () => {
    expect(getMatchKickoffTs({})).toBeNull();
    expect(getMatchKickoffTs({ kickoffTs: null })).toBeNull();
    expect(getMatchKickoffTs({ kickoffTs: undefined })).toBeNull();
  });

  test('ISO string direct comparison with number fails — must use getMatchKickoffTs', () => {
    const iso = '2026-06-11T19:00:00+00:00';
    const epoch = new Date(iso).getTime();
    // Direct comparison of ISO string to number doesn't work reliably
    // getMatchKickoffTs ensures we always get a number for safe comparison
    const ms = getMatchKickoffTs({ kickoffTs: iso });
    expect(typeof ms).toBe('number');
    expect(ms).toBe(epoch);
    expect(ms < epoch + 1).toBe(true);
  });
});

// =============================================================================
// 3. BALANCE COMPUTATION — _topup handling
// =============================================================================

describe('balance computation with _topup bets', () => {
  test('_topup bets are counted in raw balance (they add to wallet)', () => {
    const bets = [
      { match_id: '_topup', amount: 1000, status: 'won', payout: 1000 },
      { match_id: 'A1', amount: 500, status: 'pending', payout: null },
    ];
    // topup adds 1000 payout, A1 bet costs 500 → net = 1000 - 500 - 1000 = -500
    // Wait — computeBalance: net = SUM(payout where won) - SUM(amount where not cancelled)
    // = 1000 - (1000 + 500) = -500
    const bal = computeBalance(bets);
    expect(bal).toBe(-500);
  });

  test('cancelled bets do not affect balance', () => {
    const bets = [
      { match_id: 'A1', amount: 300, status: 'cancelled', payout: null },
      { match_id: 'A2', amount: 200, status: 'pending', payout: null },
    ];
    expect(computeBalance(bets)).toBe(-200);
  });
});

// =============================================================================
// 4. LEADERBOARD — totalStaked must count all-time, not just pending
// =============================================================================

describe('leaderboard totalStaked calculation', () => {
  // Simulates the leaderboard logic from app/api/leaderboard/route.js
  function computeTotalStaked(bets) {
    const allPlaced = bets.filter(b => b.status !== 'cancelled' && b.match_id !== '_topup');
    return allPlaced.reduce((sum, b) => sum + b.amount, 0);
  }

  test('includes won + lost + pending bets (not just pending)', () => {
    const bets = [
      { match_id: 'A1', amount: 500, status: 'won', payout: 1000 },
      { match_id: 'A2', amount: 300, status: 'lost', payout: null },
      { match_id: 'A3', amount: 200, status: 'pending', payout: null },
      { match_id: 'A4', amount: 100, status: 'cancelled', payout: null },
    ];
    expect(computeTotalStaked(bets)).toBe(1000); // 500 + 300 + 200
  });

  test('excludes _topup from totalStaked', () => {
    const bets = [
      { match_id: '_topup', amount: 5000, status: 'won', payout: 5000 },
      { match_id: 'B1', amount: 400, status: 'pending', payout: null },
    ];
    expect(computeTotalStaked(bets)).toBe(400);
  });

  test('empty bets = 0 staked', () => {
    expect(computeTotalStaked([])).toBe(0);
  });
});

// =============================================================================
// 5. SPECIAL BETS — formatPick must return human-readable strings
// =============================================================================

describe('formatPick never returns raw slugs for known picks', () => {
  test('cup_winner: known team codes return full names', () => {
    const s = getSpecial('cup_winner');
    expect(s.formatPick('FRA')).toBe('France');
    expect(s.formatPick('BRA')).toBe('Brazil');
    expect(s.formatPick('ENG')).toBe('England');
    // Unknown falls back to code
    expect(s.formatPick('ZZZZZ')).toBe('ZZZZZ');
  });

  test('continent: confederation codes return labels', () => {
    const s = getSpecial('continent');
    expect(s.formatPick('UEFA')).toBe('Europe (UEFA)');
    expect(s.formatPick('CAF')).toBe('Africa (CAF)');
  });

  test('h2h: messi/ronaldo slugs return readable names', () => {
    const s = getSpecial('h2h');
    expect(s.formatPick('messi')).toContain('Messi');
    expect(s.formatPick('ronaldo')).toContain('Ronaldo');
  });

});

// =============================================================================
// 6. SPECIAL BETS — deadlines and resolution timestamps
// =============================================================================

describe('special bet deadlines and resolution times', () => {
  test('h2h has deadlineTs (betting closes before tournament starts)', () => {
    const h2h = getSpecial('h2h');
    expect(h2h.deadlineTs).toBeTruthy();
    expect(new Date(h2h.deadlineTs).getTime()).toBeGreaterThan(0);
  });

  test('continent has deadlineTs (within 7 days of tournament start June 11)', () => {
    const cont = getSpecial('continent');
    expect(cont.deadlineTs).toBeTruthy();
    const deadline = new Date(cont.deadlineTs);
    const tournamentStart = new Date('2026-06-11T00:00:00Z');
    const diffDays = (deadline - tournamentStart) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(0);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  test('all specials except goalscorer have resolvesTs', () => {
    for (const s of SPECIALS) {
      if (s.id === 'goalscorer') {
        expect(s.resolvesTs).toBeFalsy();
      } else {
        expect(s.resolvesTs).toBeTruthy();
        expect(new Date(s.resolvesTs).getTime()).toBeGreaterThan(0);
      }
    }
  });

  test('resolvesTs is after deadlineTs for specials that have both', () => {
    for (const s of SPECIALS) {
      if (s.deadlineTs && s.resolvesTs) {
        expect(new Date(s.resolvesTs).getTime()).toBeGreaterThan(new Date(s.deadlineTs).getTime());
      }
    }
  });
});

// =============================================================================
// 7. MATCH ID SYSTEM — 72 group matches with correct format
// =============================================================================

describe('match ID system integrity', () => {
  test('exactly 72 group matches defined', () => {
    expect(MATCHES).toHaveLength(72);
  });

  test('each group has exactly 6 matches', () => {
    const groups = {};
    for (const m of MATCHES) {
      const g = m.id[0];
      groups[g] = (groups[g] || 0) + 1;
    }
    for (const [group, count] of Object.entries(groups)) {
      expect(count).toBe(6);
    }
  });

  test('match IDs are sequential within each group (X1..X6)', () => {
    const groups = {};
    for (const m of MATCHES) {
      const g = m.id[0];
      const num = parseInt(m.id.slice(1));
      (groups[g] = groups[g] || []).push(num);
    }
    for (const [group, nums] of Object.entries(groups)) {
      nums.sort((a, b) => a - b);
      expect(nums).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  test('every match has home and away team codes that exist in TEAM', () => {
    const { TEAM } = require('@/lib/data');
    for (const m of MATCHES) {
      expect(TEAM[m.home]).toBeDefined();
      expect(TEAM[m.away]).toBeDefined();
    }
  });
});

// =============================================================================
// 8. B4 DOUBLE-ACTIVE BETS BUG — multi-pending resettlement
// =============================================================================

describe('B4 resettlement — corrected parimutuel pool', () => {
  // B4 had an erroneous draw ₹250 (id=247) included in the pool.
  // Correct pool is 1200 (not 1450). Home won.

  const b4BetsWithBug = [
    { id: 247, user_id: 'jayesh',   amount: 250, pick: 'draw', status: 'pending' }, // erroneous
    { id: 294, user_id: 'pratyush', amount: 250, pick: 'draw', status: 'pending' },
    { id: 301, user_id: 'rahul',    amount: 50,  pick: 'home', status: 'pending' },
    { id: 308, user_id: 'rohan',    amount: 250, pick: 'home', status: 'pending' },
    { id: 315, user_id: 'vaper',    amount: 100, pick: 'home', status: 'pending' },
    { id: 409, user_id: 'manan',    amount: 100, pick: 'draw', status: 'pending' },
    { id: 412, user_id: 'boidu',    amount: 100, pick: 'home', status: 'pending' },
    { id: 423, user_id: 'jayesh',   amount: 100, pick: 'away', status: 'pending' }, // valid final
    { id: 450, user_id: 'ashin',    amount: 250, pick: 'home', status: 'pending' },
  ];

  const b4BetsCorrected = b4BetsWithBug.filter(b => b.id !== 247).map(b => ({ ...b }));

  test('bugged pool (1450) inflates home winner payouts', () => {
    const resolved = resolveMatchBets(b4BetsWithBug, 'home');
    const rahul = resolved.find(b => b.id === 301);
    expect(rahul.payout).toBe(96); // inflated — should be 80
    expect(rahul.status).toBe('won');
  });

  test('corrected pool (1200) gives accurate payouts', () => {
    const resolved = resolveMatchBets(b4BetsCorrected, 'home');
    expect(resolved.find(b => b.id === 301).payout).toBe(80);   // rahul
    expect(resolved.find(b => b.id === 308).payout).toBe(400);  // rohan
    expect(resolved.find(b => b.id === 315).payout).toBe(160);  // vaper
    expect(resolved.find(b => b.id === 412).payout).toBe(160);  // boidu
    expect(resolved.find(b => b.id === 450).payout).toBe(400);  // ashin
  });

  test('corrected pool — losers (draw, away) are marked lost', () => {
    const resolved = resolveMatchBets(b4BetsCorrected, 'home');
    expect(resolved.find(b => b.id === 294).status).toBe('lost'); // pratyush draw
    expect(resolved.find(b => b.id === 409).status).toBe('lost'); // manan draw
    expect(resolved.find(b => b.id === 423).status).toBe('lost'); // jayesh away
  });

  test('cancelling erroneous bet restores balance (cancelled bets excluded from computeBalance)', () => {
    // Jayesh has: draw ₹250 lost + away ₹100 lost (bug state)
    const bugBets = [
      { amount: 250, status: 'lost', payout: null },  // erroneous
      { amount: 100, status: 'lost', payout: null },  // valid
    ];
    expect(computeBalance(bugBets)).toBe(-350); // overcharged by 250

    // Fix: cancel the erroneous bet
    const fixedBets = [
      { amount: 250, status: 'cancelled', payout: null }, // repaired
      { amount: 100, status: 'lost', payout: null },
    ];
    expect(computeBalance(fixedBets)).toBe(-100); // correct
  });
});
