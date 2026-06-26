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

import { computeThirdPlaceQualifiers } from '@/lib/third-place-qualifiers';
import { GROUPS } from '@/lib/data';

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

// Build a complete 72-match group stage (all 4 teams × 3 games each per group).
// Fixed results: T1 beats everyone, T2 beats T3+T4, T3 vs T4 is configurable.
// Group J uses real codes (ARG/AUT/ALG/JOR) so J6 = JOR vs ARG is always present.
function buildFullGroupStage(cfg = {}) {
  const results = [];
  GROUPS.forEach(g => {
    const [t1, t2, t3, t4] = g.teams.map(t => t.code);
    const c = cfg[g.id] || { gf: 0, ga: 0 };
    results.push(fifaMatch(g.id, t1, t2, 2, 0));
    results.push(fifaMatch(g.id, t1, t3, 2, 0));
    results.push(fifaMatch(g.id, t1, t4, 3, 0));
    results.push(fifaMatch(g.id, t2, t3, 1, 0));
    results.push(fifaMatch(g.id, t2, t4, 2, 0));
    results.push(fifaMatch(g.id, t3, t4, c.gf, c.ga));
  });
  // Ensure J6 (JOR home vs ARG away, the real fixture order) is present
  // buildFullGroupStage emits ARG vs JOR (T1 vs T4); add the real J6 order too
  // so the J6-finished gate in computeThirdPlaceQualifiers always fires.
  // (The function accepts either order — this is belt-and-suspenders.)
  return results;
}

describe('computeThirdPlaceQualifiers', () => {
  test('returns null when J6 is not finished (no JOR/ARG match in results)', () => {
    const cfg = {};
    GROUPS.forEach(g => { cfg[g.id] = { gf: 0, ga: 0 }; });
    const results = buildFullGroupStage(cfg)
      .filter(m => !(
        (m.Home.Abbreviation === 'JOR' && m.Away.Abbreviation === 'ARG') ||
        (m.Home.Abbreviation === 'ARG' && m.Away.Abbreviation === 'JOR')
      ));
    expect(computeThirdPlaceQualifiers(results)).toBeNull();
  });

  test('returns null when all 4 group-J teams appear but each played only 1 game (MD1)', () => {
    // This is the key regression test: old `< 3 distinct teams` check passed here,
    // new `each team played 3 games` check must return null.
    const md1Only = [
      // Group J matchday 1 only (2 matches, all 4 teams present after round 1)
      fifaMatch('J', 'ARG', 'ALG', 2, 0),
      fifaMatch('J', 'AUT', 'JOR', 1, 0),
    ];
    expect(computeThirdPlaceQualifiers(md1Only)).toBeNull();
  });

  test('returns null when some groups have no data at all', () => {
    const onlyJ = GROUPS.find(g => g.id === 'J').teams.map(t => t.code);
    // Full group J but nothing for A-I, K-L
    const [t1, t2, t3, t4] = onlyJ;
    const results = [
      fifaMatch('J', t1, t2, 2, 0), fifaMatch('J', t1, t3, 2, 0),
      fifaMatch('J', t1, t4, 3, 0), fifaMatch('J', t2, t3, 1, 0),
      fifaMatch('J', t2, t4, 2, 0), fifaMatch('J', t3, t4, 0, 0),
    ];
    expect(computeThirdPlaceQualifiers(results)).toBeNull();
  });

  test('returns exactly 8 team codes when all 12 groups are complete', () => {
    const out = computeThirdPlaceQualifiers(buildFullGroupStage());
    expect(out).not.toBeNull();
    expect(out).toHaveLength(8);
  });

  test('output contains only strings, no duplicates', () => {
    const out = computeThirdPlaceQualifiers(buildFullGroupStage({ A: { gf: 1, ga: 0 } }));
    expect(out).not.toBeNull();
    expect(new Set(out).size).toBe(8);
    for (const code of out) expect(typeof code).toBe('string');
  });

  test('higher-pts thirds rank above lower-pts thirds', () => {
    const cfg = {};
    ['A','B','C','D','E','F','G','H'].forEach(g => { cfg[g] = { gf: 1, ga: 0 }; }); // T3 wins (3 pts)
    ['I','J','K','L'].forEach(g => { cfg[g] = { gf: 0, ga: 0 }; });                 // T3 draws (1 pt)
    const out = computeThirdPlaceQualifiers(buildFullGroupStage(cfg));
    expect(out).not.toBeNull();
    const highCodes = new Set(
      ['A','B','C','D','E','F','G','H'].map(id => GROUPS.find(g => g.id === id).teams[2].code)
    );
    for (const code of out) expect(highCodes.has(code)).toBe(true);
  });

  test('ignores unfinished matches (MatchStatus !== 0)', () => {
    const results = buildFullGroupStage();
    // Mark all group A matches as live — now group A has no finished matches
    results.filter(m => m.GroupName[0].Description === 'Group A')
           .forEach(m => { m.MatchStatus = 3; });
    expect(computeThirdPlaceQualifiers(results)).toBeNull();
  });

  test('handles KSA → SAU alias correctly', () => {
    const results = buildFullGroupStage();
    results.forEach(m => {
      if (m.Home.Abbreviation === 'SAU') m.Home.Abbreviation = 'KSA';
      if (m.Away.Abbreviation === 'SAU') m.Away.Abbreviation = 'KSA';
    });
    const out = computeThirdPlaceQualifiers(results);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(8);
  });
});
