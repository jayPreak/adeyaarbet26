import supabaseBrowser from '@/lib/supabase-browser';
import { cupWinnerDeadlineFromKickoffs } from '@/lib/cup-winner';
import { normalizeToZeroSum } from '@/lib/settlement';

const SPECIAL_KINDS = ['continent', 'h2h', 'r32_loser', 'r32_winner', 'final_four', 'total_goals', 'ko_cup_winner', 'cup_winner'];

// Fetch everything /api/init returns except FIFA data, directly from Supabase.
// Returns the same shape as /api/init GET so BettingContext can consume it
// identically. FIFA (fifaMatches, knockout) stays server-side for CORS.
export async function fetchInitDirect(userId) {
  if (!supabaseBrowser) return null;

  const [betsRes, schedRes, poolRes, profilesRes, cupWinnerRes, challengesRes] = await Promise.all([
    userId
      ? supabaseBrowser
          .from('bets')
          .select('*')
          .eq('user_id', userId)
          .neq('match_id', '_topup')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabaseBrowser.from('match_schedule').select('id, kickoff_ts'),
    supabaseBrowser
      .from('bets')
      .select('id, match_id, user_id, pick, amount, status, payout, kind, created_at, profiles(display_name, avatar_url)')
      .neq('match_id', '_topup')
      .neq('status', 'cancelled'),
    supabaseBrowser.from('profiles').select('id, display_name, avatar_url'),
    userId
      ? supabaseBrowser
          .from('bets')
          .select('*')
          .eq('user_id', userId)
          .eq('kind', 'cup_winner')
          .eq('status', 'pending')
          .limit(1)
      : Promise.resolve({ data: [] }),
    userId
      ? supabaseBrowser
          .from('challenges')
          .select('id, match_id, status, challenger_id, opponent_id')
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .in('status', ['open', 'accepted'])
      : Promise.resolve({ data: [] }),
  ]);

  const schedule = {};
  for (const row of (schedRes.data || [])) {
    if (!/^\d+$/.test(row.id)) schedule[row.id] = row.kickoff_ts;
  }
  const cupWinnerDeadlineTs = cupWinnerDeadlineFromKickoffs(
    (schedRes.data || []).filter(r => !/^\d+$/.test(r.id))
  );

  const allUsers = (profilesRes.data || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }));
  const allBets = poolRes.data || [];

  // Build poolMap (match kind = 'match' + 'penalty' rollup)
  const grouped = {};
  for (const b of allBets) {
    (grouped[b.match_id] = grouped[b.match_id] || []).push(b);
  }

  const pools = {};
  for (const [mid, mBetsAll] of Object.entries(grouped)) {
    const matchBets = mBetsAll.filter(b => b.kind === 'match');
    const penaltyBets = mBetsAll.filter(b => b.kind === 'penalty');
    const mBets = matchBets;

    const matchTotal = matchBets.reduce((s, b) => s + b.amount, 0);
    const penaltyTotal = penaltyBets.reduce((s, b) => s + b.amount, 0);
    const total = matchTotal + penaltyTotal;

    const bySide = { home: 0, away: 0, draw: 0 };
    matchBets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });

    const isResolved =
      matchBets.some(b => b.status === 'won' || b.status === 'lost') ||
      penaltyBets.some(b => b.status === 'won' || b.status === 'lost');

    pools[mid] = {
      matchId: mid,
      total,
      penaltyTotal,
      bettorCount: new Set(mBets.map(b => b.user_id)).size,
      bySide,
      resolved: isResolved,
      refunded: false,
      bets: mBets.map(b => ({
        user_id: b.user_id,
        display_name: b.profiles?.display_name || 'Unknown',
        avatar_url: b.profiles?.avatar_url || null,
        pick: b.pick,
        amount: b.amount,
        status: b.status,
        payout: b.payout || null,
        possible_win: isResolved
          ? (b.status === 'won' ? (b.payout || 0) : 0)
          : Math.floor((b.amount / (bySide[b.pick] || 1)) * total),
      })),
    };
  }

  const totalInPlay = allBets.reduce((s, b) => s + b.amount, 0);
  const totalBets = allBets.length;

  // Special pools per kind
  const specialPools = {};
  for (const k of SPECIAL_KINDS) {
    const kBets = allBets.filter(b => b.kind === k);
    const hasSettled = kBets.some(b => b.status === 'won' || b.status === 'lost');
    const allRefunded = !hasSettled && kBets.length > 0 && kBets.every(b => b.status === 'cancelled');
    const settled = hasSettled || allRefunded;
    // allBets already excludes cancelled — so kBets is effectively nonCancelled.
    const poolBets = settled ? kBets : kBets.filter(b => b.status === 'pending');
    const total = poolBets.reduce((s, b) => s + b.amount, 0);
    const bettorCount = new Set(poolBets.map(b => b.user_id)).size;
    const byOption = {};
    for (const b of poolBets) { byOption[b.pick] = (byOption[b.pick] || 0) + b.amount; }
    const picks = poolBets.map(b => ({
      userId: b.user_id,
      displayName: b.profiles?.display_name || '?',
      avatarUrl: b.profiles?.avatar_url || null,
      pick: b.pick,
      amount: b.amount,
    }));
    const myBets = userId
      ? kBets
          .filter(b => b.user_id === userId && (settled || b.status === 'pending'))
          .map(b => ({ id: b.id, pick: b.pick, amount: b.amount, status: b.status, payout: b.payout }))
      : [];
    specialPools[k] = { pool: { total, bettorCount, byOption, settled, refunded: allRefunded }, picks, myBets };
  }

  // Settlement positions (normalized to zero-sum) — used as the canonical
  // "Net Win/Loss" everywhere so display always matches the settlement plan.
  const balByUser = {};
  for (const b of allBets) {
    if (b.status !== 'won' && b.status !== 'lost') continue;
    balByUser[b.user_id] = (balByUser[b.user_id] || 0);
    if (b.status === 'won') balByUser[b.user_id] += (b.payout || 0) - b.amount;
    else if (b.status === 'lost') balByUser[b.user_id] -= b.amount;
  }
  const rawPositions = Object.entries(balByUser).map(([id, net]) => ({ id, net }));
  const normalized = normalizeToZeroSum(rawPositions);
  const settlementByUser = {};
  for (const p of normalized) settlementByUser[p.id] = p.net;
  // Users whose raw net was 0 are dropped by normalizeToZeroSum — fill zeros.
  for (const uid of Object.keys(balByUser)) {
    if (settlementByUser[uid] === undefined) settlementByUser[uid] = 0;
  }
  const mySettlementNet = userId ? (settlementByUser[userId] ?? 0) : 0;

  return {
    bets: betsRes.data || [],
    schedule,
    cupWinnerDeadlineTs,
    // fifaMatches + knockout intentionally omitted — fetched server-side.
    pools,
    allUsers,
    myCupWinnerBet: cupWinnerRes.data?.[0] || null,
    totalInPlay,
    totalBets,
    challenges: challengesRes.data || [],
    specialPools,
    settlementByUser,
    mySettlementNet,
  };
}

// FIFA data still needs to go through the server (CORS). Fire-and-forget from
// the caller — non-blocking.
export async function fetchFifaData() {
  try {
    const res = await fetch('/api/init');
    if (!res.ok) return null;
    const data = await res.json();
    return { fifaMatches: data.fifaMatches || [], knockout: data.knockout || [] };
  } catch {
    return null;
  }
}
