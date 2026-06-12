// Tests for group standings computation (same logic as BracketScreen)
// Extracted here to test the pure function without React

function computeGroupStandings(group, matches) {
  const stats = {};
  for (const t of group.teams) {
    stats[t.code] = { code: t.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }
  const groupMatches = matches.filter(m => m.group === group.id && m.status === 'finished' && m.score);
  for (const m of groupMatches) {
    const [hg, ag] = m.score;
    const h = stats[m.home], a = stats[m.away];
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += hg; h.ga += ag;
    a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; h.pts += 3; a.l++; }
    else if (hg < ag) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
  }
  return Object.values(stats).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

const GROUP_A = {
  id: 'A',
  teams: [
    { code: 'MEX' }, { code: 'CZE' }, { code: 'KOR' }, { code: 'RSA' },
  ],
};

describe('computeGroupStandings', () => {
  test('no finished matches — all 0 pts', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'upcoming', score: null },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    expect(standings.every(t => t.pts === 0)).toBe(true);
  });

  test('single home win — 3 pts for winner, 0 for loser', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'finished', score: [2, 0] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    expect(standings[0].code).toBe('MEX');
    expect(standings[0].pts).toBe(3);
    expect(standings[0].gf).toBe(2);
    expect(standings[0].ga).toBe(0);
    const rsa = standings.find(t => t.code === 'RSA');
    expect(rsa.pts).toBe(0);
    expect(rsa.gf).toBe(0);
    expect(rsa.ga).toBe(2);
  });

  test('draw gives 1 pt each', () => {
    const matches = [
      { group: 'A', home: 'KOR', away: 'CZE', status: 'finished', score: [1, 1] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    const kor = standings.find(t => t.code === 'KOR');
    const cze = standings.find(t => t.code === 'CZE');
    expect(kor.pts).toBe(1);
    expect(cze.pts).toBe(1);
  });

  test('goal difference used as tiebreaker', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'finished', score: [3, 0] },
      { group: 'A', home: 'KOR', away: 'CZE', status: 'finished', score: [1, 0] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    // Both MEX and KOR have 3 pts, but MEX has +3 GD vs KOR +1
    expect(standings[0].code).toBe('MEX');
    expect(standings[1].code).toBe('KOR');
  });

  test('multiple matches computed correctly', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'finished', score: [2, 0] },
      { group: 'A', home: 'KOR', away: 'CZE', status: 'finished', score: [2, 1] },
      { group: 'A', home: 'MEX', away: 'KOR', status: 'finished', score: [0, 0] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    const mex = standings.find(t => t.code === 'MEX');
    const kor = standings.find(t => t.code === 'KOR');
    expect(mex.pts).toBe(4); // 3 + 1
    expect(mex.p).toBe(2);
    expect(kor.pts).toBe(4); // 3 + 1
    // MEX: GD +2, KOR: GD +1 → MEX first
    expect(standings[0].code).toBe('MEX');
  });

  test('ignores matches from other groups', () => {
    const matches = [
      { group: 'B', home: 'CAN', away: 'SUI', status: 'finished', score: [3, 0] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    expect(standings.every(t => t.pts === 0)).toBe(true);
  });

  test('ignores non-finished matches', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'live', score: [1, 0] },
      { group: 'A', home: 'KOR', away: 'CZE', status: 'upcoming', score: null },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    expect(standings.every(t => t.pts === 0)).toBe(true);
  });

  test('away win awards 3 pts to away team', () => {
    const matches = [
      { group: 'A', home: 'MEX', away: 'RSA', status: 'finished', score: [0, 1] },
    ];
    const standings = computeGroupStandings(GROUP_A, matches);
    expect(standings[0].code).toBe('RSA');
    expect(standings[0].pts).toBe(3);
  });
});
