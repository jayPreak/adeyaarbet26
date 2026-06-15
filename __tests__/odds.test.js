import { sideOdds, poolOdds, fmtDecimalOdds, fmtImpliedProb } from '@/lib/odds';

describe('parimutuel odds', () => {
  test('even split → 2x odds, 50% each', () => {
    const pool = { total: 1000, bySide: { home: 500, away: 500, draw: 0 } };
    expect(sideOdds(pool, 'home').decimal).toBeCloseTo(2);
    expect(sideOdds(pool, 'home').impliedProb).toBeCloseTo(0.5);
    expect(sideOdds(pool, 'away').decimal).toBeCloseTo(2);
  });

  test('favourite (more money) → shorter odds, higher prob', () => {
    const pool = { total: 1000, bySide: { home: 800, away: 200, draw: 0 } };
    expect(sideOdds(pool, 'home').decimal).toBeCloseTo(1.25);
    expect(sideOdds(pool, 'home').impliedProb).toBeCloseTo(0.8);
    expect(sideOdds(pool, 'away').decimal).toBeCloseTo(5);
    expect(sideOdds(pool, 'away').impliedProb).toBeCloseTo(0.2);
  });

  test('side with no money → null (odds undefined)', () => {
    const pool = { total: 500, bySide: { home: 500, away: 0, draw: 0 } };
    expect(sideOdds(pool, 'away')).toBeNull();
    expect(sideOdds(pool, 'draw')).toBeNull();
  });

  test('empty / missing pool → null', () => {
    expect(sideOdds(null, 'home')).toBeNull();
    expect(sideOdds({ total: 0, bySide: { home: 0, away: 0, draw: 0 } }, 'home')).toBeNull();
  });

  test('adding a stake lengthens that side and reflects the new pool', () => {
    const pool = { total: 1000, bySide: { home: 500, away: 500, draw: 0 } };
    // add 500 to home: side=1000, total=1500 → 1.5x
    expect(sideOdds(pool, 'home', 500).decimal).toBeCloseTo(1.5);
    // betting the empty draw side from scratch is now well-defined
    const oneSided = { total: 500, bySide: { home: 500, away: 0, draw: 0 } };
    expect(sideOdds(oneSided, 'away', 100).decimal).toBeCloseTo(6); // 600/100
  });

  test('poolOdds returns all three sides', () => {
    const pool = { total: 1000, bySide: { home: 600, away: 400, draw: 0 } };
    const o = poolOdds(pool);
    expect(o.home.decimal).toBeCloseTo(1000 / 600);
    expect(o.away.decimal).toBeCloseTo(2.5);
    expect(o.draw).toBeNull();
  });

  test('formatters', () => {
    expect(fmtDecimalOdds({ decimal: 2.5 })).toBe('2.50x');
    expect(fmtDecimalOdds(null)).toBe('—');
    expect(fmtImpliedProb({ impliedProb: 0.4 })).toBe('40%');
    expect(fmtImpliedProb(null)).toBe('—');
  });
});
