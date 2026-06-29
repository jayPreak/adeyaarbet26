import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import supabaseAnon from '@/lib/supabase';
import { MATCHES, TEAM } from '@/lib/data';
import { TEAM_CODE_ALIAS } from '@/lib/schedule-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FIFA_LIVE_BASE = 'https://api.fifa.com/api/v3/live/football/17/285023';
const FIFA_ALL_MATCHES = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const POSITION_LABELS = { 0: 'GK', 1: 'DEF', 2: 'MID', 3: 'FWD' };

// Knockout stage prefix → FIFA stage ID
const KO_STAGE_TO_FIFA_ID = {
  R32: '289287', R16: '289288', QF: '289289', SF: '289290', FIN: '289291', '3RD': '289292',
};

// Reverse TEAM_CODE_ALIAS so we can look up our code from a FIFA abbreviation.
const FIFA_ABBREV_TO_CODE = { ...TEAM_CODE_ALIAS };
for (const code of Object.keys(TEAM)) FIFA_ABBREV_TO_CODE[code] = code;
function normCode(c) { return TEAM_CODE_ALIAS[c] || c; }

// Find FIFA stage+match IDs by fetching the FIFA all-matches calendar.
// For group-stage matches, finds by team codes. For knockout, finds by stage+position.
async function findFifaIds(matchId, staticMatch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(FIFA_ALL_MATCHES, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.Results ?? [];

    if (staticMatch) {
      const m = results.find(r =>
        normCode(r.Home?.Abbreviation) === staticMatch.home &&
        normCode(r.Away?.Abbreviation) === staticMatch.away
      );
      return m ? { idStage: String(m.IdStage), idMatch: String(m.IdMatch) } : null;
    }

    // Knockout: "R32-2" → 2nd match in R32 sorted by date
    const ko = matchId.match(/^(R32|R16|QF|SF|FIN|3RD)-(\d+)$/);
    if (!ko) return null;
    const fifaStageId = KO_STAGE_TO_FIFA_ID[ko[1]];
    if (!fifaStageId) return null;
    const stageMatches = results
      .filter(r => String(r.IdStage) === fifaStageId)
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));
    const m = stageMatches[parseInt(ko[2], 10) - 1];
    return m ? { idStage: String(m.IdStage), idMatch: String(m.IdMatch) } : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function parsePlayers(liveData, matchId, homeCode, awayCode) {
  const homeTeamId = liveData.HomeTeam?.IdTeam ? String(liveData.HomeTeam.IdTeam) : null;
  // FIFA live endpoint uses HomeTeam/AwayTeam (not Home/Away)
  const allPlayers = Array.isArray(liveData.Players)
    ? liveData.Players
    : [
        ...(liveData.HomeTeam?.Players || []),
        ...(liveData.AwayTeam?.Players || []),
      ];

  const players = [];
  for (const p of allPlayers) {
    if (!p.IdPlayer) continue;
    const fifaTeamId = p.IdTeam ? String(p.IdTeam) : null;
    const teamCode = fifaTeamId && homeTeamId && fifaTeamId === homeTeamId
      ? homeCode
      : awayCode;
    const name =
      p.PlayerName?.[0]?.Description ||
      p.ShortName?.[0]?.Description ||
      'Unknown';
    players.push({
      match_id: matchId,
      player_id: String(p.IdPlayer),
      player_name: name,
      team_code: teamCode,
      jersey_num: p.ShirtNumber != null ? String(p.ShirtNumber) : null,
      position: p.Position != null ? p.Position : null,
    });
  }
  return players;
}

export async function GET(request, { params }) {
  const { matchId } = await params;
  const db = supabaseAdmin || supabaseAnon;
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  // 1. Check cache
  const { data: cached } = await db
    .from('match_players')
    .select('*')
    .eq('match_id', matchId);

  if (cached && cached.length > 0) {
    return NextResponse.json(groupPlayers(cached));
  }

  // 2. Look up FIFA IDs dynamically (works for both group-stage and knockout matches)
  const staticMatch = MATCHES.find(m => m.id === matchId);
  const isKnockout = !staticMatch && /^(R32|R16|QF|SF|FIN|3RD)-\d+$/.test(matchId);
  if (!staticMatch && !isKnockout) {
    return NextResponse.json({ error: 'Unknown match' }, { status: 404 });
  }

  const fifaIds = await findFifaIds(matchId, staticMatch || null);
  if (!fifaIds) {
    return NextResponse.json(
      { error: 'Player list not yet available', players: { home: [], away: [] } },
      { status: 202 }
    );
  }

  // 3. Fetch live endpoint
  let liveData;
  try {
    const url = `${FIFA_LIVE_BASE}/${fifaIds.idStage}/${fifaIds.idMatch}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `FIFA API ${res.status}`, players: { home: [], away: [] } }, { status: 502 });
    }
    liveData = await res.json();
  } catch (e) {
    return NextResponse.json({ error: e.message, players: { home: [], away: [] } }, { status: 502 });
  }

  // For knockout matches, derive team codes from live FIFA data
  const homeCode = staticMatch?.home || normCode(liveData.HomeTeam?.Abbreviation) || 'HOME';
  const awayCode = staticMatch?.away || normCode(liveData.AwayTeam?.Abbreviation) || 'AWAY';
  const players = parsePlayers(liveData, matchId, homeCode, awayCode);

  if (players.length === 0) {
    return NextResponse.json({ players: { home: [], away: [] } });
  }

  // 4. Cache using service-role client (supabaseAdmin bypasses RLS)
  if (supabaseAdmin) {
    await supabaseAdmin
      .from('match_players')
      .upsert(players, { onConflict: 'match_id,player_id' });
  }

  return NextResponse.json(groupPlayers(players));
}

function groupPlayers(rows) {
  // Sort: FWD (3) → MID (2) → DEF (1) → GK (0) — descending by position
  const sorted = [...rows].sort((a, b) => {
    const pa = a.position != null ? a.position : -1;
    const pb = b.position != null ? b.position : -1;
    return pb - pa;
  });

  const home = [];
  const away = [];
  // Figure out home/away from first non-empty group; we can't know statically
  // but rows have team_code from the MATCHES lookup during population
  const teams = [...new Set(sorted.map(p => p.team_code))];
  const [homeCode, awayCode] = teams;

  for (const p of sorted) {
    const enriched = { ...p, position_label: POSITION_LABELS[p.position] || '' };
    if (p.team_code === homeCode) home.push(enriched);
    else away.push(enriched);
  }
  return { players: { home, away, homeCode, awayCode } };
}
