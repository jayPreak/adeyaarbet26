import { NextResponse } from 'next/server';

const FIFA_CALENDAR = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const FIFA_TIMELINE = 'https://api.fifa.com/api/v3/timelines/17/285023';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const calRes = await fetch(FIFA_CALENDAR, { signal: ctrl.signal, next: { revalidate: 60 } });
    clearTimeout(timer);
    if (!calRes.ok) return NextResponse.json({ events: [], match: null });

    const calData = await calRes.json();
    const results = calData.Results || [];

    // Status 3 = live, 0 = finished, 1 = upcoming, 12 = half-time
    const live = results.filter(m => m.MatchStatus === 3 || m.MatchStatus === 12);
    const finished = results
      .filter(m => m.MatchStatus === 0 && m.HomeTeamScore != null)
      .sort((a, b) => new Date(b.Date) - new Date(a.Date));

    const target = live[0] || finished[0];
    if (!target) return NextResponse.json({ events: [], match: null });

    const match = {
      home: target.Home?.Abbreviation || 'TBD',
      away: target.Away?.Abbreviation || 'TBD',
      homeName: target.Home?.ShortClubName || target.Home?.Abbreviation || 'TBD',
      awayName: target.Away?.ShortClubName || target.Away?.Abbreviation || 'TBD',
      homeScore: target.HomeTeamScore,
      awayScore: target.AwayTeamScore,
      status: target.MatchStatus === 3 || target.MatchStatus === 12 ? 'live' : 'finished',
      minute: target.MatchTime || null,
      date: target.Date,
      stageId: target.IdStage,
      matchId: target.IdMatch,
    };

    const ctrl2 = new AbortController();
    const timer2 = setTimeout(() => ctrl2.abort(), 5000);
    const tlRes = await fetch(
      `${FIFA_TIMELINE}/${target.IdStage}/${target.IdMatch}?language=en`,
      { signal: ctrl2.signal, next: { revalidate: 30 } }
    );
    clearTimeout(timer2);

    if (!tlRes.ok) return NextResponse.json({ events: [], match });

    const tlData = await tlRes.json();
    const rawEvents = tlData.Event || [];

    const events = rawEvents
      .filter(e => e.EventDescription?.length > 0)
      .map(e => ({
        id: e.EventId,
        minute: e.MatchMinute || '',
        type: e.Type,
        typeLabel: e.TypeLocalized?.[0]?.Description || '',
        description: e.EventDescription[0]?.Description || '',
        homeGoals: e.HomeGoals,
        awayGoals: e.AwayGoals,
        timestamp: e.Timestamp,
      }))
      .reverse();

    return NextResponse.json({ events, match });
  } catch {
    return NextResponse.json({ events: [], match: null });
  }
}
