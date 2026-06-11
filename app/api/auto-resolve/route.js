import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FIFA_MATCHES_URL, TEAM_CODE_ALIAS } from '@/lib/schedule-sync';
import { MATCHES } from '@/lib/data';

function buildLookup() {
  const lookup = {};
  for (const m of MATCHES) lookup[`${m.group}|${m.home}|${m.away}`] = m.id;
  return lookup;
}

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName?.[0]?.Description;
  return g ? g.replace('Group ', '').trim() : null;
}

function teamCode(team) {
  const c = team?.Abbreviation;
  return (c && TEAM_CODE_ALIAS[c]) || c;
}

function determineWinner(fifaMatch) {
  const homeScore = fifaMatch.HomeTeamScore;
  const awayScore = fifaMatch.AwayTeamScore;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

export async function GET() {
  if (!supabase) return NextResponse.json({ resolved: [] });

  let fifaResults;
  try {
    const res = await fetch(FIFA_MATCHES_URL);
    if (!res.ok) return NextResponse.json({ resolved: [], error: `FIFA ${res.status}` });
    const data = await res.json();
    fifaResults = data.Results || [];
  } catch (e) {
    return NextResponse.json({ resolved: [], error: e.message });
  }

  const lookup = buildLookup();

  // Find finished matches from FIFA
  const finished = [];
  for (const fm of fifaResults) {
    // MatchStatus 0 = finished
    if (fm.MatchStatus !== 0) continue;
    const group = groupLetter(fm);
    if (!group) continue;
    const key = `${group}|${teamCode(fm.Home)}|${teamCode(fm.Away)}`;
    const matchId = lookup[key];
    if (!matchId) continue;
    const winner = determineWinner(fm);
    if (!winner) continue;
    finished.push({ matchId, winner });
  }

  if (finished.length === 0) return NextResponse.json({ resolved: [] });

  // Check which of these still have pending bets
  const matchIds = finished.map(f => f.matchId);
  const { data: pendingBets } = await supabase
    .from('bets')
    .select('match_id')
    .in('match_id', matchIds)
    .eq('status', 'pending')
    .limit(1);

  const unresolvedIds = new Set((pendingBets || []).map(b => b.match_id));
  const toResolve = finished.filter(f => unresolvedIds.has(f.matchId));

  if (toResolve.length === 0) return NextResponse.json({ resolved: [] });

  // Resolve each match
  const resolved = [];
  for (const { matchId, winner } of toResolve) {
    const { error } = await supabase.rpc('resolve_match', {
      p_match_id: matchId,
      p_winner: winner,
    });
    if (!error) resolved.push(matchId);
  }

  return NextResponse.json({ resolved });
}
