import { NextResponse } from 'next/server';
import supabaseAnon from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { FIFA_MATCHES_URL, TEAM_CODE_ALIAS } from '@/lib/schedule-sync';
import { MATCHES, GROUPS, BRACKET } from '@/lib/data';
import { computeThirdPlaceQualifiers } from '@/lib/third-place-qualifiers';
import { scorelineBucket, overUnderPick, pensPick } from '@/lib/props';

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

// Returns 'home' | 'away' | 'draw' | null.
// For knockout matches (isKnockout=true) a draw is impossible: if the score is
// level and penalty scores haven't been reported yet, return null so the match
// stays pending and is retried on a later run — otherwise resolve_match would be
// called with 'draw', find no winning side, and irreversibly refund the pool.
function determineWinner(fifaMatch, isKnockout = false) {
  const homeScore = fifaMatch.HomeTeamScore;
  const awayScore = fifaMatch.AwayTeamScore;
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  // Tied after 90/120 min — check penalty shootout scores
  const homePen = fifaMatch.HomeTeamPenaltyScore;
  const awayPen = fifaMatch.AwayTeamPenaltyScore;
  if (homePen != null && awayPen != null) {
    if (homePen > awayPen) return 'home';
    if (awayPen > homePen) return 'away';
    // Level on penalties too — unresolvable; don't guess.
    return isKnockout ? null : 'draw';
  }
  // Score level but no penalty data yet: a knockout can't end drawn, so wait.
  if (isKnockout) return null;
  return 'draw';
}

// Extract scorer player IDs from a live-endpoint response, excluding own goals.
// Own goal detection: if a goal's IdTeam doesn't match the scorer's team in the
// Players array, the player accidentally scored for the other side → exclude.
function extractScorerIds(liveData) {
  const allPlayers = Array.isArray(liveData.Players)
    ? liveData.Players
    : [
        ...(liveData.HomeTeam?.Players || []),
        ...(liveData.AwayTeam?.Players || []),
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

export async function GET(request) {
  if (!db) return NextResponse.json({ resolved: [] });

  // Apply participation penalties. This is EXPENSIVE (Supabase query stats
  // showed 220ms avg, 5.8s max × 8000 calls) and was blocking every user's
  // auto-resolve. Now: only run when explicitly asked (nightly cron) via
  // ?penalties=true. On regular user invocations we skip it — penalties
  // only matter for matches that just closed, and the nightly cron catches
  // them within 24h which is fine for a friend group betting app.
  const { searchParams } = new URL(request.url);
  const runPenalties = searchParams.get('penalties') === 'true';
  let penaltiesResult = null;
  if (runPenalties) {
    try {
      const { data } = await db.rpc('apply_all_pending_penalties');
      penaltiesResult = data;
    } catch (e) {
      // non-fatal — proceed with match resolution regardless
      console.error('[auto-resolve] apply_all_pending_penalties failed:', e?.message || e);
    }
  } else {
    // Fire-and-forget: kick off penalties in the background but don't wait.
    // If the process dies before it completes, the nightly cron cleans up.
    db.rpc('apply_all_pending_penalties')
      .then(({ data }) => { penaltiesResult = data; })
      .catch((e) => console.error('[auto-resolve] background penalties failed:', e?.message || e));
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

  // Build knockout lookup: map FIFA stage IDs to our static ID prefixes
  const KNOCKOUT_STAGE_MAP = {
    '289287': 'R32',
    '289288': 'R16',
    '289289': 'QF',
    '289290': 'SF',
    '289291': '3RD',
    '289292': 'FIN',
  };

  const finished = [];
  // Collect ALL knockout matches per stage (finished or not) so the index-based
  // static-ID assignment matches how the schedule seed and UI number them: they
  // index every match in a stage by date. Indexing only the finished matches
  // would shift the numbering whenever results arrive out of date-order (FIFA
  // API lag) and settle the wrong match's pool.
  const knockoutByStage = {};

  for (const fm of fifaResults) {
    const group = groupLetter(fm);
    if (group) {
      // Group match — only process finished ones
      if (fm.MatchStatus !== 0) continue;
      const key = `${group}|${teamCode(fm.Home)}|${teamCode(fm.Away)}`;
      const matchId = lookup[key];
      if (!matchId) continue;
      const winner = determineWinner(fm);
      if (!winner) continue;
      finished.push({
        matchId,
        winner,
        homeScore: fm.HomeTeamScore,
        awayScore: fm.AwayTeamScore,
        wentToPens: fm.HomeTeamPenaltyScore != null && fm.AwayTeamPenaltyScore != null,
        fifa_id_stage: fm.IdStage ? String(fm.IdStage) : null,
        fifa_id_match: fm.IdMatch ? String(fm.IdMatch) : null,
      });
    } else {
      // Knockout match — collect regardless of status for stable index-based IDs.
      // Require a Date so ordering matches the schedule seed (see schedule-sync).
      const prefix = KNOCKOUT_STAGE_MAP[fm.IdStage];
      if (!prefix || !fm.Date) continue;
      if (!knockoutByStage[prefix]) knockoutByStage[prefix] = [];
      knockoutByStage[prefix].push(fm);
    }
  }

  // Sort each stage by date, assign static IDs by index over ALL matches in the
  // stage, then resolve only the ones that have actually finished.
  for (const [prefix, matches] of Object.entries(knockoutByStage)) {
    matches.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    for (let i = 0; i < matches.length; i++) {
      const fm = matches[i];
      if (fm.MatchStatus !== 0) continue; // only resolve finished matches
      const staticId = `${prefix}-${i + 1}`;
      const winner = determineWinner(fm, true); // knockout: no draws
      if (!winner) continue;
      finished.push({
        matchId: staticId,
        winner,
        homeScore: fm.HomeTeamScore,
        awayScore: fm.AwayTeamScore,
        wentToPens: fm.HomeTeamPenaltyScore != null && fm.AwayTeamPenaltyScore != null,
        fifa_id_stage: fm.IdStage ? String(fm.IdStage) : null,
        fifa_id_match: fm.IdMatch ? String(fm.IdMatch) : null,
      });
    }
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
  // Props/duels settle independently below, so don't early-return here even
  // when every match-kind pool is already resolved.
  const toResolve = finished.filter(f => unresolvedIds.has(f.matchId));

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

  // ── Match props (scoreline / over_under / pens) + duels ────────────
  // Settled for every finished match with pending bets, independent of the
  // match pool — so a FIFA hiccup on one run gets retried on the next.
  const props = [];
  const finishedById = Object.fromEntries(finished.map(f => [f.matchId, f]));
  const finishedIds = Object.keys(finishedById);
  if (finishedIds.length > 0) {
    const { data: pendingProps } = await db
      .from('bets')
      .select('match_id, kind')
      .in('match_id', finishedIds)
      .in('kind', ['scoreline', 'over_under', 'pens'])
      .eq('status', 'pending');

    const toSettle = new Set((pendingProps || []).map(b => `${b.kind}|${b.match_id}`));
    for (const key of toSettle) {
      const [kind, matchId] = key.split('|');
      const f = finishedById[matchId];
      const winnerPick =
        kind === 'scoreline' ? scorelineBucket(f.homeScore, f.awayScore) :
        kind === 'over_under' ? overUnderPick(f.homeScore, f.awayScore) :
        pensPick(f.wentToPens);
      if (!winnerPick) continue;
      try {
        const { data, error } = await db.rpc('settle_special', {
          p_match_id: matchId,
          p_kind: kind,
          p_winner: winnerPick,
        });
        if (error) errors.push({ matchId, stage: kind, error: error.message });
        else props.push({ matchId, kind, winner: winnerPick, ...data });
      } catch (e) {
        errors.push({ matchId, stage: kind, error: e.message });
      }
    }

    // Duels: settle accepted, expire unaccepted
    const { data: openChallenges } = await db
      .from('challenges')
      .select('match_id')
      .in('match_id', finishedIds)
      .in('status', ['open', 'accepted']);

    const duelMatchIds = [...new Set((openChallenges || []).map(c => c.match_id))];
    for (const matchId of duelMatchIds) {
      try {
        const { data, error } = await db.rpc('settle_challenges', {
          p_match_id: matchId,
          p_winner: finishedById[matchId].winner,
        });
        if (error) errors.push({ matchId, stage: 'challenges', error: error.message });
        else props.push({ matchId, kind: 'challenge', ...data });
      } catch (e) {
        errors.push({ matchId, stage: 'challenges', error: e.message });
      }
    }
  }

  // Settle third-place qualifier bets once J6 (last group game) is fully resolved.
  // Triggered on every auto-resolve run where pending qualifier bets exist AND J6
  // has no pending match bets (i.e. it has already been settled). This makes it
  // idempotent — if computeThirdPlaceQualifiers() returns null on the first run
  // (FIFA payload incomplete) it will retry on subsequent page loads.
  let thirdPlaceResult = null;
  if (db) {
    const [{ data: pendingQuals }, { data: pendingJ6 }] = await Promise.all([
      db.from('bets').select('id').eq('match_id', 'THIRD_QUALIFIERS').eq('kind', 'third_place_qualifiers').eq('status', 'pending').limit(1),
      db.from('bets').select('id').eq('match_id', 'J6').eq('kind', 'match').eq('status', 'pending').limit(1),
    ]);

    if (pendingQuals?.length && pendingJ6?.length === 0) {
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

  return NextResponse.json({ resolved, goalscorer, penalties: penaltiesResult, ...(props.length ? { props } : {}), ...(thirdPlaceResult ? { thirdPlace: thirdPlaceResult } : {}), ...(errors.length ? { errors } : {}) });
}
