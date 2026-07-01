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
  '289290': 'SF', '289291': 'Final', '289292': '3rd',
};

function normalize(code) { return code ? (TEAM_CODE_ALIAS[code] || code) : null; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  const db = supabaseAdmin || supabase;
  if (!db) return NextResponse.json({ error: 'No database' }, { status: 503 });

  // Fire all DB queries + FIFA fetch in parallel
  const fifaController = new AbortController();
  const fifaTimer = setTimeout(() => fifaController.abort(), 4000);

  const [betsRes, schedRes, poolRes, profilesRes, cupWinnerRes, fifaRes] = await Promise.all([
    // User bets
    userId
      ? db.from('bets').select('*').eq('user_id', userId).neq('match_id', '_topup').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Schedule
    db.from('match_schedule').select('id, kickoff_ts'),
    // All bets for pool computation
    db.from('bets').select('match_id, user_id, pick, amount, status, payout, kind, created_at, profiles(display_name, avatar_url)'),
    // Profiles
    db.from('profiles').select('id, display_name, avatar_url'),
    // Cup winner bet
    userId
      ? db.from('bets').select('*').eq('user_id', userId).eq('kind', 'cup_winner').eq('status', 'pending').limit(1)
      : Promise.resolve({ data: [] }),
    // FIFA data
    fetch(FIFA_URL, { signal: fifaController.signal, next: { revalidate: 120 } })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
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
    if (b.match_id === '_topup') continue;
    (grouped[b.match_id] = grouped[b.match_id] || []).push(b);
  }

  const pools = {};
  for (const [mid, mBetsAll] of Object.entries(grouped)) {
    const matchBets = mBetsAll.filter(b => b.kind === 'match');
    const penaltyBets = mBetsAll.filter(b => b.kind === 'penalty');
    const activeMatchBets = matchBets.filter(b => b.status !== 'cancelled');
    const activePenaltyBets = penaltyBets.filter(b => b.status !== 'cancelled');
    const isRefunded = activeMatchBets.length === 0 && matchBets.length > 0 && finishedMatches.has(mid);

    let mBets;
    if (isRefunded) {
      const latest = {};
      for (const b of matchBets) {
        const key = `${b.user_id}|${b.pick}`;
        if (!latest[key] || (b.created_at || '') > (latest[key].created_at || '')) latest[key] = b;
      }
      mBets = Object.values(latest);
    } else {
      mBets = activeMatchBets;
    }

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

  // Total in play: sum of all non-cancelled, non-topup bets (pending)
  const totalInPlay = allBets
    .filter(b => b.match_id !== '_topup' && b.status === 'pending')
    .reduce((s, b) => s + b.amount, 0);
  const totalBets = allBets
    .filter(b => b.match_id !== '_topup' && b.status !== 'cancelled')
    .length;

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
  });
}
