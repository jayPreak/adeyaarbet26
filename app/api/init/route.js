import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { cupWinnerDeadlineFromKickoffs } from '@/lib/cup-winner';

export const dynamic = 'force-dynamic';

const FIFA_URL = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';
const GROUP_STAGE_ID = '289273';
const TEAM_CODE_ALIAS = { KSA: 'SAU' };
const STAGE_MAP = {
  '289287': 'R32', '289288': 'R16', '289289': 'QF',
  '289290': 'SF', '289291': '3rd', '289292': 'Final',
};

function normalize(code) { return code ? (TEAM_CODE_ALIAS[code] || code) : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: 'No database' }, { status: 503 });

  // Fire all DB queries + FIFA fetch in parallel
  const fifaController = new AbortController();
  const fifaTimer = setTimeout(() => fifaController.abort(), 1200);

  const [betsRes, schedRes, poolRes, profilesRes, cupWinnerRes, fifaRes, challengesRes] = await Promise.all([
    // User bets
    userId
      ? db.from('bets').select('*').eq('user_id', userId).neq('match_id', '_topup').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Schedule
    db.from('match_schedule').select('id, kickoff_ts'),
    // All non-cancelled bets for pool computation (cancelled excluded to stay under PostgREST max-rows)
    db.from('bets').select('match_id, user_id, pick, amount, status, payout, kind, created_at, profiles(display_name, avatar_url)').neq('match_id', '_topup').neq('status', 'cancelled'),
    // Profiles
    db.from('profiles').select('id, display_name, avatar_url'),
    // Cup winner bet
    userId
      ? db.from('bets').select('*').eq('user_id', userId).eq('kind', 'cup_winner').eq('status', 'pending').limit(1)
      : Promise.resolve({ data: [] }),
    // FIFA data — 2s timeout, non-blocking (null on failure)
    fetch(FIFA_URL, { signal: fifaController.signal, next: { revalidate: 120 } })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
    // Challenges involving this user (for duel indicators)
    userId
      ? db.from('challenges').select('id, match_id, status, challenger_id, opponent_id').or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`).in('status', ['open', 'accepted'])
      : Promise.resolve({ data: [] }),
  ]);

  clearTimeout(fifaTimer);

  // Build schedule map
  const schedule = {};
  for (const row of (schedRes.data || [])) {
    if (!/^\d+$/.test(row.id)) schedule[row.id] = row.kickoff_ts;
  }
  const cupWinnerDeadlineTs = cupWinnerDeadlineFromKickoffs((schedRes.data || []).filter(r => !/^\d+$/.test(r.id)));

  // Build FIFA group matches + knockout
  let fifaMatches = [];
  let knockout = [];
  if (fifaRes?.Results) {
    fifaMatches = fifaRes.Results.filter(m => m.IdStage === GROUP_STAGE_ID);
    knockout = fifaRes.Results
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
  }

  // Build pool map
  const allUsers = (profilesRes.data || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }));
  const allBets = poolRes.data || [];
  const now = Date.now();
  const finishedMatches = new Set((schedRes.data || []).filter(s => s.kickoff_ts && new Date(s.kickoff_ts).getTime() < now - 2 * 60 * 60 * 1000).map(s => s.id));

  const grouped = {};
  for (const b of allBets) {
    (grouped[b.match_id] = grouped[b.match_id] || []).push(b);
  }

  const pools = {};
  for (const [mid, mBetsAll] of Object.entries(grouped)) {
    const matchBets = mBetsAll.filter(b => b.kind === 'match');
    const penaltyBets = mBetsAll.filter(b => b.kind === 'penalty');
    // Query already excludes cancelled, so active = all returned
    const activeMatchBets = matchBets;
    const activePenaltyBets = penaltyBets;
    const isRefunded = false;

    const mBets = activeMatchBets;

    const matchTotal = activeMatchBets.reduce((s, b) => s + b.amount, 0);
    const penaltyTotal = activePenaltyBets.reduce((s, b) => s + b.amount, 0);
    const total = isRefunded ? mBets.reduce((s, b) => s + b.amount, 0) : matchTotal + penaltyTotal;

    const bySide = { home: 0, away: 0, draw: 0 };
    activeMatchBets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });

    const isResolved = activeMatchBets.some(b => b.status === 'won' || b.status === 'lost')
                    || activePenaltyBets.some(b => b.status === 'won' || b.status === 'lost');

    pools[mid] = {
      matchId: mid, total,
      penaltyTotal: isRefunded ? 0 : penaltyTotal,
      bettorCount: new Set(mBets.map(b => b.user_id)).size,
      bySide: isRefunded
        ? (() => { const s = { home: 0, away: 0, draw: 0 }; mBets.forEach(b => { s[b.pick] = (s[b.pick] || 0) + b.amount; }); return s; })()
        : bySide,
      resolved: isResolved || isRefunded,
      refunded: isRefunded,
      bets: mBets.map(b => ({
        user_id: b.user_id,
        display_name: b.profiles?.display_name || 'Unknown',
        avatar_url: b.profiles?.avatar_url || null,
        pick: b.pick, amount: b.amount, status: b.status,
        payout: b.payout || null,
        possible_win: isRefunded ? 0 : isResolved
          ? (b.status === 'won' ? (b.payout || 0) : 0)
          : Math.floor((b.amount / (bySide[b.pick] || 1)) * total),
      })),
    };
  }

  // Total in play: sum of all non-cancelled, non-topup bets (matches leaderboard's "total staked")
  const nonCancelledBets = allBets.filter(b => b.match_id !== '_topup' && b.status !== 'cancelled');
  const totalInPlay = nonCancelledBets.reduce((s, b) => s + b.amount, 0);
  const totalBets = nonCancelledBets.length;

  // Special pools — computed from allBets so specials page doesn't need extra API calls
  const specialKinds = ['continent', 'h2h', 'r32_loser', 'r32_winner', 'final_four', 'total_goals', 'ko_cup_winner', 'cup_winner'];
  const specialPools = {};
  for (const k of specialKinds) {
    const kBets = allBets.filter(b => b.kind === k);
    const hasSettled = kBets.some(b => b.status === 'won' || b.status === 'lost');
    const allRefunded = !hasSettled && kBets.length > 0 && kBets.every(b => b.status === 'cancelled');
    const settled = hasSettled || allRefunded;
    const nonCancK = kBets.filter(b => b.status !== 'cancelled');
    const poolBets = settled ? nonCancK : nonCancK.filter(b => b.status === 'pending');
    const total = poolBets.reduce((s, b) => s + b.amount, 0);
    const bettorCount = new Set(poolBets.map(b => b.user_id)).size;
    const byOption = {};
    for (const b of poolBets) { byOption[b.pick] = (byOption[b.pick] || 0) + b.amount; }
    const picks = poolBets.map(b => ({ userId: b.user_id, displayName: b.profiles?.display_name || '?', avatarUrl: b.profiles?.avatar_url || null, pick: b.pick, amount: b.amount }));
    const myBets = userId
      ? kBets.filter(b => b.user_id === userId && (settled || b.status === 'pending')).map(b => ({ id: b.id, pick: b.pick, amount: b.amount, status: b.status, payout: b.payout }))
      : [];
    specialPools[k] = { pool: { total, bettorCount, byOption, settled, refunded: allRefunded }, picks, myBets };
  }

  return NextResponse.json({
    bets: betsRes.data || [],
    schedule,
    cupWinnerDeadlineTs,
    fifaMatches,
    knockout,
    pools,
    allUsers,
    myCupWinnerBet: cupWinnerRes.data?.[0] || null,
    totalInPlay,
    totalBets,
    challenges: challengesRes.data || [],
    specialPools,
  });
}
