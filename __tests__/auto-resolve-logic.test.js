/**
 * Tests for the auto-resolve route's pure logic:
 * - determineWinner: FIFA scores → 'home' | 'away' | 'draw' | null
 * - extractScorerIds: live data → scorer IDs (own goals excluded)
 *
 * These functions are inline in the route file, so we duplicate/extract the logic here
 * to test independently without needing HTTP/Supabase.
 */

// Extracted from app/api/auto-resolve/route.js
function determineWinner(fifaMatch) {
  const homeScore = fifaMatch.HomeTeamScore;
  const awayScore = fifaMatch.AwayTeamScore;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

function extractScorerIds(liveData) {
  const allPlayers = Array.isArray(liveData.Players)
    ? liveData.Players
    : [
        ...(liveData.Home?.Players || []),
        ...(liveData.Away?.Players || []),
      ];

  const playerTeam = {};
  for (const p of allPlayers) {
    if (p.IdPlayer) playerTeam[String(p.IdPlayer)] = String(p.IdTeam || '');
  }

  const scorers = new Set();
  for (const goal of liveData.Goals || []) {
    if (!goal.IdPlayer) continue;
    const scorerId = String(goal.IdPlayer);
    const benefitTeam = String(goal.IdTeam || '');
    const scorerTeam = playerTeam[scorerId];
    if (scorerTeam && scorerTeam === benefitTeam) {
      scorers.add(scorerId);
    }
  }
  return [...scorers];
}

describe('determineWinner', () => {
  test('home win (2-0)', () => {
    expect(determineWinner({ HomeTeamScore: 2, AwayTeamScore: 0 })).toBe('home');
  });

  test('away win (1-3)', () => {
    expect(determineWinner({ HomeTeamScore: 1, AwayTeamScore: 3 })).toBe('away');
  });

  test('draw (1-1)', () => {
    expect(determineWinner({ HomeTeamScore: 1, AwayTeamScore: 1 })).toBe('draw');
  });

  test('0-0 draw', () => {
    expect(determineWinner({ HomeTeamScore: 0, AwayTeamScore: 0 })).toBe('draw');
  });

  test('null when scores missing', () => {
    expect(determineWinner({ HomeTeamScore: null, AwayTeamScore: 2 })).toBeNull();
    expect(determineWinner({ HomeTeamScore: 1, AwayTeamScore: null })).toBeNull();
    expect(determineWinner({})).toBeNull();
  });

  test('null when scores undefined', () => {
    expect(determineWinner({ HomeTeamScore: undefined, AwayTeamScore: 0 })).toBeNull();
  });

  test('high-scoring match (5-4)', () => {
    expect(determineWinner({ HomeTeamScore: 5, AwayTeamScore: 4 })).toBe('home');
  });
});

describe('extractScorerIds', () => {
  test('regular goals — returns scorer IDs', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [{ IdPlayer: '201', IdTeam: 'T2' }] },
      Goals: [
        { IdPlayer: '101', IdTeam: 'T1' }, // regular goal by home player
        { IdPlayer: '201', IdTeam: 'T2' }, // regular goal by away player
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toContain('101');
    expect(ids).toContain('201');
    expect(ids).toHaveLength(2);
  });

  test('own goal excluded — scorer team != benefit team', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [{ IdPlayer: '201', IdTeam: 'T2' }] },
      Goals: [
        { IdPlayer: '201', IdTeam: 'T1' }, // own goal: player 201 (team T2) scored for T1
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toHaveLength(0);
  });

  test('mix of regular and own goals', () => {
    const liveData = {
      Home: { Players: [
        { IdPlayer: '101', IdTeam: 'T1' },
        { IdPlayer: '102', IdTeam: 'T1' },
      ]},
      Away: { Players: [{ IdPlayer: '201', IdTeam: 'T2' }] },
      Goals: [
        { IdPlayer: '101', IdTeam: 'T1' }, // regular
        { IdPlayer: '102', IdTeam: 'T2' }, // own goal: player 102 (T1) credited to T2
        { IdPlayer: '201', IdTeam: 'T2' }, // regular
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toContain('101');
    expect(ids).toContain('201');
    expect(ids).not.toContain('102');
    expect(ids).toHaveLength(2);
  });

  test('duplicate scorer — appears only once', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [] },
      Goals: [
        { IdPlayer: '101', IdTeam: 'T1' },
        { IdPlayer: '101', IdTeam: 'T1' }, // brace
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toEqual(['101']);
  });

  test('no goals — empty array', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [{ IdPlayer: '201', IdTeam: 'T2' }] },
      Goals: [],
    };
    expect(extractScorerIds(liveData)).toEqual([]);
  });

  test('missing Goals field — empty array', () => {
    const liveData = {
      Home: { Players: [] },
      Away: { Players: [] },
    };
    expect(extractScorerIds(liveData)).toEqual([]);
  });

  test('flat Players array format (alternative FIFA response shape)', () => {
    const liveData = {
      Players: [
        { IdPlayer: '101', IdTeam: 'T1' },
        { IdPlayer: '201', IdTeam: 'T2' },
      ],
      Goals: [
        { IdPlayer: '101', IdTeam: 'T1' },
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toEqual(['101']);
  });

  test('goal with missing IdPlayer — skipped', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [] },
      Goals: [
        { IdPlayer: null, IdTeam: 'T1' },
        { IdTeam: 'T1' }, // no IdPlayer at all
        { IdPlayer: '101', IdTeam: 'T1' }, // valid
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toEqual(['101']);
  });

  test('unknown scorer (not in Players array) — excluded', () => {
    const liveData = {
      Home: { Players: [{ IdPlayer: '101', IdTeam: 'T1' }] },
      Away: { Players: [] },
      Goals: [
        { IdPlayer: '999', IdTeam: 'T1' }, // player 999 not in Players
      ],
    };
    const ids = extractScorerIds(liveData);
    expect(ids).toHaveLength(0);
  });
});

// Extracted from app/api/auto-resolve/route.js
// Mirrors GROUPS structure: 12 groups (A-L), 4 teams each
const TEAM_CODE_ALIAS = { KSA: 'SAU' };

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName?.[0]?.Description;
  return g ? g.replace('Group ', '').trim() : null;
}
function teamCode(team) {
  const c = team?.Abbreviation;
  return (c && TEAM_CODE_ALIAS[c]) || c;
}

// Minimal GROUPS stub — just the group IDs and 4 team codes each
const GROUPS = [
  { id: 'A', teams: [{ code: 'MEX' }, { code: 'CZE' }, { code: 'KOR' }, { code: 'RSA' }] },
  { id: 'B', teams: [{ code: 'CAN' }, { code: 'SUI' }, { code: 'BIH' }, { code: 'QAT' }] },
  { id: 'C', teams: [{ code: 'BRA' }, { code: 'SCO' }, { code: 'MAR' }, { code: 'HAI' }] },
  { id: 'D', teams: [{ code: 'USA' }, { code: 'TUR' }, { code: 'PAR' }, { code: 'AUS' }] },
  { id: 'E', teams: [{ code: 'GER' }, { code: 'ECU' }, { code: 'CIV' }, { code: 'CUW' }] },
  { id: 'F', teams: [{ code: 'NED' }, { code: 'SWE' }, { code: 'TUN' }, { code: 'JPN' }] },
  { id: 'G', teams: [{ code: 'BEL' }, { code: 'EGY' }, { code: 'IRN' }, { code: 'NZL' }] },
  { id: 'H', teams: [{ code: 'ESP' }, { code: 'CPV' }, { code: 'SAU' }, { code: 'URU' }] },
  { id: 'I', teams: [{ code: 'FRA' }, { code: 'NOR' }, { code: 'SEN' }, { code: 'IRQ' }] },
  { id: 'J', teams: [{ code: 'ARG' }, { code: 'AUT' }, { code: 'ALG' }, { code: 'JOR' }] },
  { id: 'K', teams: [{ code: 'POR' }, { code: 'COL' }, { code: 'COD' }, { code: 'UZB' }] },
  { id: 'L', teams: [{ code: 'ENG' }, { code: 'CRO' }, { code: 'GHA' }, { code: 'PAN' }] },
];

function computeThirdPlaceQualifiers(fifaResults) {
  const groupStats = {};
  for (const fm of fifaResults) {
    if (fm.MatchStatus !== 0) continue;
    const g = groupLetter(fm);
    if (!g) continue;
    const hc = teamCode(fm.Home);
    const ac = teamCode(fm.Away);
    if (!hc || !ac) continue;
    const hg = fm.HomeTeamScore;
    const ag = fm.AwayTeamScore;
    if (hg == null || ag == null) continue;
    if (!groupStats[g]) groupStats[g] = {};
    if (!groupStats[g][hc]) groupStats[g][hc] = { code: hc, pts: 0, gf: 0, ga: 0 };
    if (!groupStats[g][ac]) groupStats[g][ac] = { code: ac, pts: 0, gf: 0, ga: 0 };
    groupStats[g][hc].gf += hg; groupStats[g][hc].ga += ag;
    groupStats[g][ac].gf += ag; groupStats[g][ac].ga += hg;
    if (hg > ag)      { groupStats[g][hc].pts += 3; }
    else if (ag > hg) { groupStats[g][ac].pts += 3; }
    else              { groupStats[g][hc].pts += 1; groupStats[g][ac].pts += 1; }
  }
  const groupIds = GROUPS.map(g => g.id);
  for (const gid of groupIds) {
    if (!groupStats[gid] || Object.keys(groupStats[gid]).length < 3) return null;
  }
  const thirds = [];
  for (const gid of groupIds) {
    const sorted = Object.values(groupStats[gid]).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.code.localeCompare(b.code)
    );
    thirds.push({ ...sorted[2], group: gid });
  }
  thirds.sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.group.localeCompare(b.group)
  );
  return thirds.slice(0, 8).map(t => t.code);
}

// Helper: build a fake finished FIFA match object
function fifaMatch(group, homeCode, awayCode, homeScore, awayScore) {
  return {
    MatchStatus: 0,
    GroupName: [{ Description: `Group ${group}` }],
    Home: { Abbreviation: homeCode },
    Away: { Abbreviation: awayCode },
    HomeTeamScore: homeScore,
    AwayTeamScore: awayScore,
  };
}

// Build a complete 36-match group stage where each group's 4 teams play 3 matches.
// Teams within group: T1 > T2 > T3 > T4 by construction (T1 beats all, etc.)
// We control GD to predictably rank the 12 thirds.
function buildFullGroupStage(thirdPlaceScores) {
  // thirdPlaceScores: { groupId: { pts, gf, ga } } for the 3rd team — we'll
  // engineer the results to hit those totals.
  // Simpler: just give T3 a fixed record that matches pts/gf/ga targets.
  // We construct: T1 beats T2 (2-0), T1 beats T3 (2-0), T1 beats T4 (3-0),
  //               T2 beats T3 (1-0), T2 beats T4 (2-0), T3 vs T4 configurable.
  const results = [];
  GROUPS.forEach(g => {
    const [t1, t2, t3, t4] = g.teams.map(t => t.code);
    const cfg = thirdPlaceScores[g.id] || { win: false, gf: 1, ga: 1 }; // default draw
    results.push(fifaMatch(g.id, t1, t2, 2, 0));
    results.push(fifaMatch(g.id, t1, t3, 2, 0));
    results.push(fifaMatch(g.id, t1, t4, 3, 0));
    results.push(fifaMatch(g.id, t2, t3, 1, 0));
    results.push(fifaMatch(g.id, t2, t4, 2, 0));
    // T3 vs T4: let caller configure
    if (cfg.win) {
      results.push(fifaMatch(g.id, t3, t4, cfg.gf, cfg.ga));
    } else {
      results.push(fifaMatch(g.id, t3, t4, cfg.gf, cfg.ga));
    }
  });
  return results;
}

describe('computeThirdPlaceQualifiers', () => {
  test('returns null when fewer than 3 teams recorded in any group', () => {
    // Only 2 matches for group A — only 2 teams appear
    const partial = [
      fifaMatch('A', 'MEX', 'CZE', 2, 0),
      fifaMatch('A', 'MEX', 'KOR', 1, 0),
    ];
    expect(computeThirdPlaceQualifiers(partial)).toBeNull();
  });

  test('returns null when some groups have no data at all', () => {
    // All of group A's 3 rounds but nothing for B-L
    const onlyA = [
      fifaMatch('A', 'MEX', 'CZE', 2, 0),
      fifaMatch('A', 'MEX', 'KOR', 1, 0),
      fifaMatch('A', 'MEX', 'RSA', 1, 0),
      fifaMatch('A', 'CZE', 'KOR', 2, 1),
      fifaMatch('A', 'CZE', 'RSA', 2, 0),
      fifaMatch('A', 'KOR', 'RSA', 1, 0),
    ];
    expect(computeThirdPlaceQualifiers(onlyA)).toBeNull();
  });

  test('returns exactly 8 team codes when all 12 groups are complete', () => {
    // Give every group identical T3 results (draw 0-0) so we get a valid ranking
    const cfg = {};
    GROUPS.forEach(g => { cfg[g.id] = { gf: 0, ga: 0 }; });
    const results = buildFullGroupStage(cfg);
    const out = computeThirdPlaceQualifiers(results);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(8);
  });

  test('output contains only team codes (strings), no duplicates', () => {
    const cfg = {};
    GROUPS.forEach(g => { cfg[g.id] = { gf: 1, ga: 0, win: true }; });
    const out = computeThirdPlaceQualifiers(buildFullGroupStage(cfg));
    expect(out).not.toBeNull();
    expect(new Set(out).size).toBe(8);
    for (const code of out) expect(typeof code).toBe('string');
  });

  test('higher-pts thirds rank above lower-pts thirds', () => {
    // Groups A–H: T3 wins T3vT4 (3 pts), Groups I–L: T3 draws (1 pt)
    const cfg = {};
    ['A','B','C','D','E','F','G','H'].forEach(g => { cfg[g] = { gf: 1, ga: 0, win: true }; });
    ['I','J','K','L'].forEach(g => { cfg[g] = { gf: 0, ga: 0 }; });
    const out = computeThirdPlaceQualifiers(buildFullGroupStage(cfg));
    expect(out).not.toBeNull();
    // All 8 spots should be from groups A-H (3-pt thirds beat 1-pt thirds)
    const highGroups = new Set(['A','B','C','D','E','F','G','H'].map(g => GROUPS.find(gr => gr.id === g).teams[2].code));
    for (const code of out) expect(highGroups.has(code)).toBe(true);
  });

  test('ignores unfinished matches (MatchStatus !== 0)', () => {
    const cfg = {};
    GROUPS.forEach(g => { cfg[g.id] = { gf: 1, ga: 0, win: true }; });
    const results = buildFullGroupStage(cfg);
    // Mark all group A matches as in-progress
    results.filter(m => groupLetter(m) === 'A').forEach(m => { m.MatchStatus = 3; });
    expect(computeThirdPlaceQualifiers(results)).toBeNull();
  });

  test('handles KSA → SAU alias', () => {
    const cfg = {};
    GROUPS.forEach(g => { cfg[g.id] = { gf: 0, ga: 0 }; });
    const results = buildFullGroupStage(cfg);
    // Replace the SAU entry in group H matches with KSA
    results.forEach(m => {
      if (m.Home.Abbreviation === 'SAU') m.Home.Abbreviation = 'KSA';
      if (m.Away.Abbreviation === 'SAU') m.Away.Abbreviation = 'KSA';
    });
    const out = computeThirdPlaceQualifiers(results);
    // Should resolve correctly (not fail due to unknown team)
    expect(out).not.toBeNull();
    expect(out).toHaveLength(8);
  });
});
