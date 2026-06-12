import { NextResponse } from 'next/server';
import supabaseAnon from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { FIFA_MATCHES_URL } from '@/lib/schedule-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const db = supabaseAdmin || supabaseAnon;

const FIFA_LIVE_BASE = 'https://api.fifa.com/api/v3/live/football/17/285023';

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName?.[0]?.Description;
  return g ? g.replace('Group ', '').trim() : null;
}

function determineWinner(fifaMatch) {
  const homeScore = fifaMatch.HomeTeamScore;
  const awayScore = fifaMatch.AwayTeamScore;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

// Extract scorer player IDs from a live-endpoint response, excluding own goals.
// Own goal detection: if a goal's IdTeam doesn't match the scorer's team in the
// Players array, the player accidentally scored for the other side → exclude.
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
    const scorerId    = String(goal.IdPlayer);
    const benefitTeam = String(goal.IdTeam || '');
    const scorerTeam  = playerTeam[scorerId];
    if (scorerTeam && scorerTeam === benefitTeam) {
      scorers.add(scorerId);
    }
  }
  return [...scorers];
}

// matchId IS the FIFA match ID after migration; fifa_id_stage needed for URL.
async function settleGoalscorer(matchId, fifaIdStage) {
  if (!fifaIdStage) return null;
  if (!db) return null;

  const { data: pending } = await db
    .from('bets')
    .select('id')
    .eq('kind', 'goalscorer')
    .eq('match_id', matchId)
    .eq('status', 'pending')
    .limit(1);
  if (!pending?.length) return null;

  let liveData;
  try {
    const url = `${FIFA_LIVE_BASE}/${fifaIdStage}/${matchId}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `FIFA live ${res.status}` };
    liveData = await res.json();
  } catch (e) {
    return { error: e.message };
  }

  const scorerIds = extractScorerIds(liveData);
  const { data, error } = await db.rpc('settle_goalscorer', {
    p_match_id:           matchId,
    p_scoring_player_ids: scorerIds.length > 0 ? scorerIds : null,
  });
  if (error) return { error: error.message };
  return data;
}

export async function GET() {
  if (!db) return NextResponse.json({ resolved: [] });

  let fifaResults;
  try {
    const res = await fetch(FIFA_MATCHES_URL, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ resolved: [], error: `FIFA ${res.status}` });
    const data = await res.json();
    fifaResults = data.Results || [];
  } catch (e) {
    return NextResponse.json({ resolved: [], error: e.message });
  }

  const finished = [];
  for (const fm of fifaResults) {
    if (fm.MatchStatus !== 0) continue;
    const group = groupLetter(fm);
    if (!group) continue; // skip knockout matches for now
    const matchId = fm.IdMatch ? String(fm.IdMatch) : null;
    if (!matchId) continue;
    const winner = determineWinner(fm);
    if (!winner) continue;
    finished.push({
      matchId,
      winner,
      fifa_id_stage: fm.IdStage ? String(fm.IdStage) : null,
    });
  }

  if (finished.length === 0) return NextResponse.json({ resolved: [] });

  const matchIds = finished.map(f => f.matchId);
  const { data: pendingBets } = await db
    .from('bets')
    .select('match_id')
    .in('match_id', matchIds)
    .eq('status', 'pending')
    .limit(1);

  const unresolvedIds = new Set((pendingBets || []).map(b => b.match_id));
  const toResolve = finished.filter(f => unresolvedIds.has(f.matchId));

  if (toResolve.length === 0) return NextResponse.json({ resolved: [] });

  const resolved = [];
  const goalscorer = [];

  for (const { matchId, winner, fifa_id_stage } of toResolve) {
    const { error } = await db.rpc('resolve_match', {
      p_match_id: matchId,
      p_winner:   winner,
    });
    if (!error) {
      resolved.push(matchId);

      const gsResult = await settleGoalscorer(matchId, fifa_id_stage);
      if (gsResult && !gsResult.error) goalscorer.push({ matchId, ...gsResult });
    }
  }

  return NextResponse.json({ resolved, goalscorer });
}
