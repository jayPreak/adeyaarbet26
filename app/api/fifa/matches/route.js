const FIFA_URL = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const GROUP_STAGE_ID = '289273';
const TEAM_CODE_ALIAS = { KSA: 'SAU' };
const STAGE_MAP = {
  '289287': 'R32', '289288': 'R16', '289289': 'QF',
  '289290': 'SF', '289291': '3rd', '289292': 'Final',
};

function normalize(code) { return code ? (TEAM_CODE_ALIAS[code] || code) : null; }

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shape = searchParams.get('shape');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let data = null;
  try {
    const res = await fetch(FIFA_URL, { signal: controller.signal, next: { revalidate: 300 } });
    if (res.ok) data = await res.json();
  } catch { /* timeout / network — return empty */ }
  clearTimeout(timer);

  // Legacy shape (raw Results) — keeps back-compat if anything still calls this.
  if (shape !== 'split') {
    return Response.json(data?.Results ?? []);
  }

  // Split shape — matches the {fifaMatches, knockout} format /api/init used to
  // return so BettingContext can consume it identically.
  const results = data?.Results || [];
  const fifaMatches = results.filter(m => m.IdStage === GROUP_STAGE_ID);
  const knockout = results
    .filter(m => m.IdStage !== GROUP_STAGE_ID)
    .map(m => ({
      id: m.IdMatch,
      stage: STAGE_MAP[m.IdStage] || m.IdStage,
      date: m.Date,
      matchNumber: m.MatchNumber ?? null,
      home: normalize(m.Home?.Abbreviation),
      away: normalize(m.Away?.Abbreviation),
      homeScore: m.HomeTeamScore,
      awayScore: m.AwayTeamScore,
      homePen: m.HomeTeamPenaltyScore,
      awayPen: m.AwayTeamPenaltyScore,
      status: m.MatchStatus,
      placeholderA: m.PlaceHolderA,
      placeholderB: m.PlaceHolderB,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return Response.json({ fifaMatches, knockout });
}
