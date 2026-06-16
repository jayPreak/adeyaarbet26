import {
  nameToCode, resolveMatchId, extractDecimalOdds,
  impliedProbsFromDecimal, buildMarketOddsMap,
} from '@/lib/market-odds';
import { MATCHES } from '@/lib/data';

describe('market-odds mapping', () => {
  test('nameToCode resolves names + aliases', () => {
    expect(nameToCode('Mexico')).toBe('MEX');
    expect(nameToCode('  south korea ')).toBe('KOR');
    expect(nameToCode('USA')).toBe('USA');
    expect(nameToCode('Czechia')).toBe('CZE');
    expect(nameToCode('Atlantis')).toBeNull();
    expect(nameToCode(null)).toBeNull();
  });

  test('resolveMatchId finds a real match in both orientations', () => {
    const m = MATCHES[0]; // A1: MEX vs RSA
    expect(resolveMatchId(m.home, m.away)).toEqual({ id: m.id, flipped: false });
    expect(resolveMatchId(m.away, m.home)).toEqual({ id: m.id, flipped: true });
    expect(resolveMatchId('MEX', 'CAN')).toBeNull(); // not a fixture
  });

  test('extractDecimalOdds averages bookmaker prices', () => {
    const ev = {
      home_team: 'Mexico', away_team: 'South Africa',
      bookmakers: [
        { markets: [{ key: 'h2h', outcomes: [
          { name: 'Mexico', price: 1.8 }, { name: 'South Africa', price: 4.0 }, { name: 'Draw', price: 3.5 },
        ] }] },
        { markets: [{ key: 'h2h', outcomes: [
          { name: 'Mexico', price: 2.0 }, { name: 'South Africa', price: 4.4 }, { name: 'Draw', price: 3.7 },
        ] }] },
      ],
    };
    const o = extractDecimalOdds(ev);
    expect(o.home).toBeCloseTo(1.9);
    expect(o.away).toBeCloseTo(4.2);
    expect(o.draw).toBeCloseTo(3.6);
  });

  test('impliedProbsFromDecimal removes vig and sums to ~1', () => {
    const p = impliedProbsFromDecimal({ home: 2.0, away: 4.0, draw: 4.0 });
    const sum = p.home + p.away + p.draw;
    expect(sum).toBeCloseTo(1);
    expect(p.home).toBeGreaterThan(p.away);
  });

  test('buildMarketOddsMap keys by static match id and flips when needed', () => {
    const m = MATCHES[0]; // A1: home=MEX (Mexico), away=RSA (South Africa)
    // Feed lists them reversed → flipped, so odds must swap back.
    const events = [{
      home_team: 'South Africa', away_team: 'Mexico',
      commence_time: '2026-06-11T19:00:00Z',
      bookmakers: [{ markets: [{ key: 'h2h', outcomes: [
        { name: 'South Africa', price: 4.0 }, { name: 'Mexico', price: 1.8 }, { name: 'Draw', price: 3.5 },
      ] }] }],
    }];
    const map = buildMarketOddsMap(events);
    expect(map[m.id]).toBeDefined();
    // after un-flipping, home (Mexico) should be the short price
    expect(map[m.id].home).toBeCloseTo(1.8);
    expect(map[m.id].away).toBeCloseTo(4.0);
    expect(map[m.id].probs.home).toBeGreaterThan(map[m.id].probs.away);
  });

  test('unknown teams are skipped, not crashed', () => {
    const map = buildMarketOddsMap([{ home_team: 'Atlantis', away_team: 'Wakanda', bookmakers: [] }]);
    expect(map).toEqual({});
  });
});
