import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import supabaseAnon from '@/lib/supabase';
import { MATCHES, TEAM } from '@/lib/data';
import { TEAM_CODE_ALIAS } from '@/lib/schedule-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FIFA_LIVE_BASE = 'https://api.fifa.com/api/v3/live/football/17/285023';
const POSITION_LABELS = { 0: 'GK', 1: 'DEF', 2: 'MID', 3: 'FWD' };

// Reverse TEAM_CODE_ALIAS so we can look up our code from a FIFA abbreviation.
const FIFA_ABBREV_TO_CODE = { ...TEAM_CODE_ALIAS };
for (const code of Object.keys(TEAM)) FIFA_ABBREV_TO_CODE[code] = code;

function parsePlayers(liveData, matchId, homeCode, awayCode) {
  const homeTeamId = liveData.Home?.IdTeam ? String(liveData.Home.IdTeam) : null;
  // Try both flat Players[] and nested Home/Away.Players[]
  const allPlayers = Array.isArray(liveData.Players)
    ? liveData.Players
    : [
        ...(liveData.Home?.Players || []),
        ...(liveData.Away?.Players || []),
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
      jersey_num: p.JerseyNum != null ? String(p.JerseyNum) : null,
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

  // 2. Need to fetch from FIFA — look up FIFA IDs
  const { data: schedRow } = await db
    .from('match_schedule')
    .select('fifa_id_stage, fifa_id_match')
    .eq('id', matchId)
    .single();

  if (!schedRow?.fifa_id_stage || !schedRow?.fifa_id_match) {
    return NextResponse.json(
      { error: 'Player list not yet available (FIFA IDs not synced)', players: { home: [], away: [] } },
      { status: 202 }
    );
  }

  const staticMatch = MATCHES.find(m => m.id === matchId);
  if (!staticMatch) {
    return NextResponse.json({ error: 'Unknown match' }, { status: 404 });
  }

  // 3. Fetch live endpoint
  let liveData;
  try {
    const url = `${FIFA_LIVE_BASE}/${schedRow.fifa_id_stage}/${schedRow.fifa_id_match}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `FIFA API ${res.status}`, players: { home: [], away: [] } }, { status: 502 });
    }
    liveData = await res.json();
  } catch (e) {
    return NextResponse.json({ error: e.message, players: { home: [], away: [] } }, { status: 502 });
  }

  const players = parsePlayers(liveData, matchId, staticMatch.home, staticMatch.away);

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
