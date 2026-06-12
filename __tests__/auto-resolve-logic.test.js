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
