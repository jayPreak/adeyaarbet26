import { SPECIALS, getSpecial, getSpecialByMatchId, getConfederation, isSpecialBet, CONFEDERATION_OPTIONS } from '@/lib/specials';

describe('SPECIALS registry', () => {
  test('has all 3 specials defined', () => {
    expect(SPECIALS).toHaveLength(3);
    expect(SPECIALS.map(s => s.id)).toEqual(['cup_winner', 'continent', 'goalscorer']);
  });

  test('each special has required fields', () => {
    for (const s of SPECIALS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(typeof s.multiPick).toBe('boolean');
      expect(typeof s.formatPick).toBe('function');
    }
  });

  test('cup_winner is single-pick', () => {
    const cw = getSpecial('cup_winner');
    expect(cw.multiPick).toBe(false);
    expect(cw.matchId).toBe('CUP_WINNER');
    expect(cw.options.length).toBeGreaterThan(40);
  });


  test('continent has 6 confederations', () => {
    const cont = getSpecial('continent');
    expect(cont.multiPick).toBe(false);
    expect(cont.options).toHaveLength(6);
    expect(cont.options.map(o => o.value)).toEqual(['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']);
  });
});

describe('getSpecial / getSpecialByMatchId', () => {
  test('getSpecial returns correct special', () => {
    expect(getSpecial('cup_winner').id).toBe('cup_winner');
    expect(getSpecial('nonexistent')).toBeNull();
  });

  test('getSpecialByMatchId finds by matchId', () => {
    expect(getSpecialByMatchId('CUP_WINNER').id).toBe('cup_winner');
    expect(getSpecialByMatchId('CONTINENT').id).toBe('continent');
    expect(getSpecialByMatchId('UNKNOWN')).toBeNull();
  });
});

describe('getConfederation', () => {
  test('maps major teams to correct confederation', () => {
    expect(getConfederation('BRA')).toBe('CONMEBOL');
    expect(getConfederation('GER')).toBe('UEFA');
    expect(getConfederation('MEX')).toBe('CONCACAF');
    expect(getConfederation('NGA')).toBe('CAF');
    expect(getConfederation('JPN')).toBe('AFC');
    expect(getConfederation('NZL')).toBe('OFC');
  });

  test('returns null for unknown team', () => {
    expect(getConfederation('XXX')).toBeNull();
  });
});


describe('CONFEDERATION_OPTIONS', () => {
  test('each confederation has teams', () => {
    for (const conf of CONFEDERATION_OPTIONS) {
      expect(conf.value).toBeTruthy();
      expect(conf.label).toBeTruthy();
      expect(conf.teams.length).toBeGreaterThan(0);
    }
  });

  test('no team appears in two confederations', () => {
    const allTeams = CONFEDERATION_OPTIONS.flatMap(c => c.teams);
    const unique = new Set(allTeams);
    expect(unique.size).toBe(allTeams.length);
  });
});

describe('isSpecialBet', () => {
  test('identifies special bets correctly', () => {
    expect(isSpecialBet({ kind: 'cup_winner' })).toBe(true);
    expect(isSpecialBet({ kind: 'goalscorer' })).toBe(true);
    expect(isSpecialBet({ kind: 'continent' })).toBe(true);
    expect(isSpecialBet({ kind: 'match' })).toBe(false);
  });
});

describe('formatPick', () => {
  test('cup_winner formats team code to name', () => {
    const cw = getSpecial('cup_winner');
    expect(cw.formatPick('BRA')).toBe('Brazil');
    expect(cw.formatPick('ARG')).toBe('Argentina');
  });

  test('continent formats confederation code to label', () => {
    const cont = getSpecial('continent');
    expect(cont.formatPick('UEFA')).toBe('Europe (UEFA)');
    expect(cont.formatPick('CONMEBOL')).toBe('South America (CONMEBOL)');
    expect(cont.formatPick('UNKNOWN')).toBe('UNKNOWN');
  });
});
