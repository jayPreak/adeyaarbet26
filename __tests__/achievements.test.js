import { computeAchievements } from '@/lib/achievements';

const base = (over = {}) => ({
  id: 'u1',
  display_name: 'Test User',
  realisedBalance: 0,
  totalStaked: 0,
  betCount: 0,
  winRate: null,
  winStreak: 0,
  topBets: [],
  ...over,
});

describe('computeAchievements', () => {
  test('empty rankings → no achievements', () => {
    expect(computeAchievements([])).toEqual([]);
    expect(computeAchievements(null)).toEqual([]);
  });

  test('all-zero rankings earn nothing', () => {
    const out = computeAchievements([base(), base({ id: 'u2', display_name: 'Other' })]);
    expect(out).toEqual([]);
  });

  test('shark goes to highest positive realised balance', () => {
    const out = computeAchievements([
      base({ id: 'a', display_name: 'Alice', realisedBalance: 500 }),
      base({ id: 'b', display_name: 'Bob', realisedBalance: 1200 }),
    ]);
    const shark = out.find(x => x.id === 'shark');
    expect(shark.userId).toBe('b');
    expect(shark.userName).toBe('Bob');
  });

  test('donator goes to biggest loser only when negative', () => {
    const out = computeAchievements([
      base({ id: 'a', realisedBalance: 100 }),
      base({ id: 'b', display_name: 'Bob Loser', realisedBalance: -900 }),
    ]);
    const donor = out.find(x => x.id === 'donator');
    expect(donor.userId).toBe('b');
  });

  test('degenerate requires at least 5 bets', () => {
    const few = computeAchievements([base({ betCount: 4 })]);
    expect(few.find(x => x.id === 'degenerate')).toBeUndefined();
    const many = computeAchievements([base({ betCount: 23 })]);
    expect(many.find(x => x.id === 'degenerate')).toBeTruthy();
  });

  test('sniper requires winRate above 50 (winRate null self-gates)', () => {
    const low = computeAchievements([base({ winRate: 50 })]);
    expect(low.find(x => x.id === 'sniper')).toBeUndefined();
    const high = computeAchievements([base({ winRate: 75 })]);
    expect(high.find(x => x.id === 'sniper')).toBeTruthy();
    const nulls = computeAchievements([base({ winRate: null })]);
    expect(nulls.find(x => x.id === 'sniper')).toBeUndefined();
  });

  test('hot streak requires 3+ consecutive wins', () => {
    expect(computeAchievements([base({ winStreak: 2 })]).find(x => x.id === 'hot_streak')).toBeUndefined();
    expect(computeAchievements([base({ winStreak: 3 })]).find(x => x.id === 'hot_streak')).toBeTruthy();
  });

  test('big game hunter uses biggest single-bet profit; heartbreak the biggest single loss', () => {
    const out = computeAchievements([
      base({
        id: 'a', display_name: 'Alice',
        topBets: [
          { amount: 200, status: 'won', profit: 800 },
          { amount: 500, status: 'lost', profit: -500 },
        ],
      }),
      base({
        id: 'b', display_name: 'Bob',
        topBets: [
          { amount: 100, status: 'won', profit: 300 },
          { amount: 2000, status: 'lost', profit: -2000 },
        ],
      }),
    ]);
    expect(out.find(x => x.id === 'big_game').userId).toBe('a');
    expect(out.find(x => x.id === 'heartbreak').userId).toBe('b');
  });

  test('uses the provided money formatter in descriptions', () => {
    const out = computeAchievements(
      [base({ realisedBalance: 750 })],
      n => `₹${n}`,
    );
    expect(out.find(x => x.id === 'shark').description).toContain('₹750');
  });
});
