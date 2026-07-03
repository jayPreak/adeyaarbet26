const FIFA_URL = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const TEAM_CODE_ALIAS = { KSA: 'SAU' };
const GROUP_STAGE_ID = '289273';

const STAGE_MAP = {
  '289287': 'R32',
  '289288': 'R16',
  '289289': 'QF',
  '289290': 'SF',
  '289291': 'Final',
  '289292': '3rd',
};

function normalize(code) {
  if (!code) return null;
  return TEAM_CODE_ALIAS[code] || code;
}

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(FIFA_URL, {
      signal: controller.signal,
      next: { revalidate: 120 },
    });
    clearTimeout(timer);
    if (!res.ok) return Response.json([], { status: res.status });
    const data = await res.json();

    const knockout = (data.Results ?? [])
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

    return Response.json(knockout);
  } catch {
    clearTimeout(timer);
    return Response.json([]);
  }
}
