import { NextResponse } from 'next/server';
import supabaseAnon from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { FIFA_MATCHES_URL, TEAM_CODE_ALIAS } from '@/lib/schedule-sync';
import { MATCHES, GROUPS } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const db = supabaseAdmin || supabaseAnon;

// FIFA competition/season — same as the calendar URL
const FIFA_LIVE_BASE = 'https://api.fifa.com/api/v3/live/football/17/285023';

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
    const scorerId     = String(goal.IdPlayer);
    const benefitTeam  = String(goal.IdTeam || '');
    const scorerTeam   = playerTeam[scorerId];
    // Regular goal: scorer's team matches the team credited with the goal
    if (scorerTeam && scorerTeam === benefitTeam) {
      scorers.add(scorerId);
    }
    // Own goal (scorerTeam !== benefitTeam): excluded from winning picks
  }
  return [...scorers];
}

// Compute the top 8 third-place qualifiers from all finished FIFA match data.
// Returns an array of 8 team codes, or null if not all 12 groups are complete.
function computeThirdPlaceQualifiers(fifaResults) {
  const groupStats = {};

  for (const fm of fifaResults) {
    if (fm.MatchStatus !== 0) continue;
    const g = groupLetter(fm);
    if (!g) continue;
    const hc = teamCode(fm.Home);
    const ac = teamCode(fm.Away);
    if (!hc || !ac) continue;
    const hg = fm.HomeTeamScore;
    const ag = fm.AwayTeamScore;
    if (hg == null || ag == null) continue;

    if (!groupStats[g]) groupStats[g] = {};
    if (!groupStats[g][hc]) groupStats[g][hc] = { code: hc, pts: 0, gf: 0, ga: 0 };
    if (!groupStats[g][ac]) groupStats[g][ac] = { code: ac, pts: 0, gf: 0, ga: 0 };

    groupStats[g][hc].gf += hg; groupStats[g][hc].ga += ag;
    groupStats[g][ac].gf += ag; groupStats[g][ac].ga += hg;

    if (hg > ag)      { groupStats[g][hc].pts += 3; }
    else if (ag > hg) { groupStats[g][ac].pts += 3; }
    else              { groupStats[g][hc].pts += 1; groupStats[g][ac].pts += 1; }
  }

  // Need all 12 groups computed with at least 3 teams
  const groupIds = GROUPS.map(g => g.id);
  for (const gid of groupIds) {
    if (!groupStats[gid] || Object.keys(groupStats[gid]).length < 3) return null;
  }

  const thirds = [];
  for (const gid of groupIds) {
    const sorted = Object.values(groupStats[gid]).sort((a, b) =>
      b.pts - a.pts ||
      (b.gf - b.ga) - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.code.localeCompare(b.code)
    );
    thirds.push({ ...sorted[2], group: gid });
  }

  thirds.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.group.localeCompare(b.group)
  );

  return thirds.slice(0, 8).map(t => t.code);
}

async function settleGoalscorer(matchId, schedRow) {
  if (!schedRow?.fifa_id_stage || !schedRow?.fifa_id_match) return null;
  if (!db) return null;

  // Only proceed if there are pending goalscorer bets for this match
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
    const url = `${FIFA_LIVE_BASE}/${schedRow.fifa_id_stage}/${schedRow.fifa_id_match}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { error: `FIFA live ${res.status}` };
    liveData = await res.json();
  } catch (e) {
    return { error: e.message };
  }

  const scorerIds = extractScorerIds(liveData);
  const { data, error } = await db.rpc('settle_goalscorer', {
    p_match_id:            matchId,
    p_scoring_player_ids:  scorerIds.length > 0 ? scorerIds : null,
  });
  if (error) return { error: error.message };
  return data;
}

export async function GET() {
  if (!db) return NextResponse.json({ resolved: [] });

  // Apply participation penalties for any matches where betting has just closed.
  // Must run BEFORE resolve_match so penalty amounts are included in the pool.
  // The RPC is idempotent — safe to call on every auto-resolve invocation.
  let penaltiesResult = null;
  try {
    const { data } = await db.rpc('apply_all_pending_penalties');
    penaltiesResult = data;
  } catch {
    // non-fatal — proceed with match resolution regardless
  }

  let fifaResults;
  try {
    const res = await fetch(FIFA_MATCHES_URL, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ resolved: [], penalties: penaltiesResult, error: `FIFA ${res.status}` });
    const data = await res.json();
    fifaResults = data.Results || [];
  } catch (e) {
    return NextResponse.json({ resolved: [], penalties: penaltiesResult, error: e.message });
  }

  const lookup = buildLookup();

  const finished = [];
  for (const fm of fifaResults) {
    if (fm.MatchStatus !== 0) continue;
    const group = groupLetter(fm);
    if (!group) continue;
    const key = `${group}|${teamCode(fm.Home)}|${teamCode(fm.Away)}`;
    const matchId = lookup[key];
    if (!matchId) continue;
    const winner = determineWinner(fm);
    if (!winner) continue;
    finished.push({
      matchId,
      winner,
      fifa_id_stage: fm.IdStage ? String(fm.IdStage) : null,
      fifa_id_match: fm.IdMatch ? String(fm.IdMatch) : null,
    });
  }

  if (finished.length === 0) return NextResponse.json({ resolved: [], penalties: penaltiesResult });

  const matchIds = finished.map(f => f.matchId);
  // Check for pending bets on match kind only — penalty bets will also be
  // pending but we don't want them to re-trigger resolution of settled matches.
  const { data: pendingBets } = await db
    .from('bets')
    .select('match_id')
    .in('match_id', matchIds)
    .eq('kind', 'match')
    .eq('status', 'pending');

  const unresolvedIds = new Set((pendingBets || []).map(b => b.match_id));
  const toResolve = finished.filter(f => unresolvedIds.has(f.matchId));

  if (toResolve.length === 0) return NextResponse.json({ resolved: [], penalties: penaltiesResult });

  const resolved = [];
  const goalscorer = [];
  const errors = [];

  for (const { matchId, winner, fifa_id_stage, fifa_id_match } of toResolve) {
    try {
      const { error } = await db.rpc('resolve_match', {
        p_match_id: matchId,
        p_winner:   winner,
      });
      if (error) {
        errors.push({ matchId, stage: 'resolve_match', error: error.message });
        continue;
      }
      resolved.push(matchId);

      // Settle goalscorer bets for the same match
      const gsResult = await settleGoalscorer(matchId, { fifa_id_stage, fifa_id_match });
      if (gsResult && !gsResult.error) goalscorer.push({ matchId, ...gsResult });
      else if (gsResult?.error) errors.push({ matchId, stage: 'goalscorer', error: gsResult.error });
    } catch (e) {
      errors.push({ matchId, stage: 'resolve', error: e.message });
    }
  }

  // After J6 (Jordan vs Argentina, last group game) settles, resolve third-place qualifier bets.
  let thirdPlaceResult = null;
  if (resolved.includes('J6') && db) {
    const { data: pending } = await db
      .from('bets')
      .select('id')
      .eq('match_id', 'THIRD_QUALIFIERS')
      .eq('kind', 'third_place_qualifiers')
      .eq('status', 'pending')
      .limit(1);

    if (pending?.length) {
      const winningTeams = computeThirdPlaceQualifiers(fifaResults);
      if (winningTeams) {
        const { data, error } = await db.rpc('settle_third_place_qualifiers', {
          p_winning_teams: winningTeams,
        });
        if (error) errors.push({ matchId: 'THIRD_QUALIFIERS', stage: 'third_place_qualifiers', error: error.message });
        else thirdPlaceResult = data;
      }
    }
  }

  return NextResponse.json({ resolved, goalscorer, penalties: penaltiesResult, ...(thirdPlaceResult ? { thirdPlace: thirdPlaceResult } : {}), ...(errors.length ? { errors } : {}) });
}
