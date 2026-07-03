import { NextResponse } from 'next/server';

const FIFA_CALENDAR = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const FIFA_LIVE = 'https://api.fifa.com/api/v3/live/football/17/285023';

const MESSI_ID = 229397;
const RONALDO_ID = 201200;

export const dynamic = 'force-dynamic';

export async function GET() {
  const empty = { messi: { goals: [], assists: 0 }, ronaldo: { goals: [], assists: 0 } };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const calRes = await fetch(FIFA_CALENDAR, { signal: controller.signal, cache: 'no-store' }).catch(() => null);
    clearTimeout(timer);
    if (!calRes?.ok) return NextResponse.json(empty, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } });

    const calData = await calRes.json();
    const results = calData.Results || [];

    // Find all ARG and POR matches that have been played
    const targetMatches = results.filter(m => {
      const home = m.Home?.Abbreviation;
      const away = m.Away?.Abbreviation;
      const hasScore = m.HomeTeamScore != null;
      return hasScore && (home === 'ARG' || away === 'ARG' || home === 'POR' || away === 'POR');
    });

    // Fetch match details in parallel — no Next.js cache, 6s timeout per match
    const details = await Promise.all(
      targetMatches.map(m => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        return fetch(`${FIFA_LIVE}/${m.IdStage}/${m.IdMatch}`, { signal: ctrl.signal, cache: 'no-store' })
          .then(r => { clearTimeout(t); return r.ok ? r.json() : null; })
          .catch(() => { clearTimeout(t); return null; });
      })
    );

    const messi = { goals: [], assists: 0 };
    const ronaldo = { goals: [], assists: 0 };

    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      if (!d) continue;
      const m = targetMatches[i];
      const homeAbbr = m.Home?.Abbreviation;
      const awayAbbr = m.Away?.Abbreviation;

      for (const side of ['HomeTeam', 'AwayTeam']) {
        const team = d[side];
        if (!team) continue;
        const abbr = side === 'HomeTeam' ? homeAbbr : awayAbbr;

        const goals = team.Goals || [];
        for (const g of goals) {
          const playerId = typeof g.IdPlayer === 'string' ? parseInt(g.IdPlayer) : g.IdPlayer;
          const assistId = typeof g.IdAssistPlayer === 'string' ? parseInt(g.IdAssistPlayer) : g.IdAssistPlayer;

          if (playerId === MESSI_ID && abbr === 'ARG') {
            messi.goals.push({
              minute: g.Minute,
              type: g.Type === 1 ? 'penalty' : 'open_play',
              vs: abbr === homeAbbr ? awayAbbr : homeAbbr,
              matchId: m.IdMatch,
            });
          }
          if (playerId === RONALDO_ID && abbr === 'POR') {
            ronaldo.goals.push({
              minute: g.Minute,
              type: g.Type === 1 ? 'penalty' : 'open_play',
              vs: abbr === homeAbbr ? awayAbbr : homeAbbr,
              matchId: m.IdMatch,
            });
          }
          if (assistId === MESSI_ID && abbr === 'ARG') messi.assists++;
          if (assistId === RONALDO_ID && abbr === 'POR') ronaldo.assists++;
        }
      }
    }

    return NextResponse.json({ messi, ronaldo }, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json(empty);
  }
}
