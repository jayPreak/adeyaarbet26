import { NextResponse } from 'next/server';

const FIFA_CALENDAR = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const FIFA_LIVE = 'https://api.fifa.com/api/v3/live/football/17/285023';

const MESSI_ID = 229397;
const RONALDO_ID = 201200;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const calRes = await fetch(FIFA_CALENDAR, { signal: controller.signal, next: { revalidate: 300 } }).catch(() => null);
    clearTimeout(timer);
    if (!calRes?.ok) return NextResponse.json({ messi: { goals: [], assists: 0 }, ronaldo: { goals: [], assists: 0 } });

    const calData = await calRes.json();
    const results = calData.Results || [];

    // Find all ARG and POR matches that have been played
    const targetMatches = results.filter(m => {
      const home = m.Home?.Abbreviation;
      const away = m.Away?.Abbreviation;
      const hasScore = m.HomeTeamScore != null;
      return hasScore && (home === 'ARG' || away === 'ARG' || home === 'POR' || away === 'POR');
    });

    // Fetch match details in parallel with individual timeouts
    const details = await Promise.all(
      targetMatches.map(m => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        return fetch(`${FIFA_LIVE}/${m.IdStage}/${m.IdMatch}`, { signal: ctrl.signal, next: { revalidate: 600 } })
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
          if (g.IdPlayer === MESSI_ID && abbr === 'ARG') {
            messi.goals.push({
              minute: g.Minute,
              type: g.Type === 1 ? 'penalty' : 'open_play',
              vs: abbr === homeAbbr ? awayAbbr : homeAbbr,
              matchId: m.IdMatch,
            });
          }
          if (g.IdPlayer === RONALDO_ID && abbr === 'POR') {
            ronaldo.goals.push({
              minute: g.Minute,
              type: g.Type === 1 ? 'penalty' : 'open_play',
              vs: abbr === homeAbbr ? awayAbbr : homeAbbr,
              matchId: m.IdMatch,
            });
          }
          // Count assists
          if (g.IdAssistPlayer === MESSI_ID && abbr === 'ARG') messi.assists++;
          if (g.IdAssistPlayer === RONALDO_ID && abbr === 'POR') ronaldo.assists++;
        }
      }
    }

    return NextResponse.json({ messi, ronaldo });
  } catch {
    return NextResponse.json({ messi: { goals: [] }, ronaldo: { goals: [] } });
  }
}
