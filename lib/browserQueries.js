/**
 * Direct-Supabase browser query helpers. Each mirrors an /api/* route so
 * callers can swap the fetch() for a fast-path Supabase read (~50ms) and
 * fall back to the API when the browser client is unavailable.
 */
import supabaseBrowser from '@/lib/supabase-browser';
import { getMatch, getTeam, fmtKnockoutStage } from '@/lib/data';
import { computeBalance, computeRealisedBalance } from '@/lib/ledger';
import { computeSettlement, computeNetPositions, normalizeToZeroSum } from '@/lib/settlement';
import { dedupedFetch } from '@/lib/queryCache';

export async function fetchActivityDirect({ limit = 20, offset = 0, matchId = null } = {}) {
  if (!supabaseBrowser) return null;
  const key = `activity:${matchId || 'global'}:${offset}:${limit}`;
  return dedupedFetch(key, async () => {
    let query = supabaseBrowser
      .from('activity')
      .select('*, profiles(username, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (matchId) query = query.contains('payload', { match_id: matchId });
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    return matchId
      ? rows.filter(d => !d.payload?.kind || d.payload.kind === 'match' || d.payload.kind === 'penalty')
      : rows;
  });
}

export async function fetchLeaderboardDirect() {
  if (!supabaseBrowser) return null;
  return dedupedFetch('leaderboard', _fetchLeaderboardDirect);
}

async function _fetchLeaderboardDirect() {
  const [profilesRes, betsRes] = await Promise.all([
    supabaseBrowser.from('profiles').select('id, username, display_name, avatar_url').range(0, 999),
    supabaseBrowser
      .from('bets')
      .select('id, user_id, match_id, pick, amount, status, payout, kind, created_at, resolved_at')
      .neq('match_id', '_topup')
      .neq('status', 'cancelled')
      .range(0, 9999),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (betsRes.error) throw betsRes.error;
  return computeLeaderboard(profilesRes.data || [], betsRes.data || []);
}

// Pure — mirrors /api/leaderboard exactly.
export function computeLeaderboard(profiles, bets) {
  const betsByUser = {};
  for (const b of bets) {
    if (b.match_id !== '_topup') (betsByUser[b.user_id] = betsByUser[b.user_id] || []).push(b);
  }

  const poolsByMatch = {};
  for (const b of bets) {
    if (b.match_id === '_topup' || b.status !== 'pending') continue;
    if (!poolsByMatch[b.match_id]) poolsByMatch[b.match_id] = { total: 0, bySide: {} };
    poolsByMatch[b.match_id].total += b.amount;
    poolsByMatch[b.match_id].bySide[b.pick] = (poolsByMatch[b.match_id].bySide[b.pick] || 0) + b.amount;
  }

  const labelBet = (b) => {
    let matchLabel = b.match_id;
    let pickLabel = b.pick;
    const m = getMatch(b.match_id);
    const stageTag = fmtKnockoutStage(b.match_id);
    if (m) {
      const h = getTeam(m.home); const a = getTeam(m.away);
      matchLabel = `${h?.code || '?'} vs ${a?.code || '?'}`;
      if (b.pick === 'home') pickLabel = h?.name || b.pick;
      else if (b.pick === 'away') pickLabel = a?.name || b.pick;
      else pickLabel = 'Draw';
    } else if (b.match_id === 'CUP_WINNER') {
      matchLabel = 'Cup Winner';
      const pt = getTeam(b.pick); if (pt) pickLabel = pt.name;
    } else if (b.match_id === 'CONTINENT') {
      matchLabel = 'Continent';
    } else if (b.match_id?.startsWith('HT_')) {
      matchLabel = 'Halftime'; pickLabel = b.pick?.toUpperCase();
    } else if (stageTag) {
      matchLabel = stageTag;
      pickLabel = b.pick === 'home' ? 'Home' : b.pick === 'away' ? 'Away' : 'Draw';
    }
    return { matchLabel, pickLabel };
  };

  const rankings = profiles
    .filter(p => betsByUser[p.id]?.length)
    .map(p => {
      const userBets = betsByUser[p.id];
      const balance = computeBalance(userBets);
      const realisedBalance = computeRealisedBalance(userBets);
      const activeBets = userBets.filter(b => b.status === 'pending');
      const allPlaced = userBets;
      const totalStaked = allPlaced.reduce((sum, b) => sum + b.amount, 0);
      const betCount = allPlaced.length;
      const matchesBet = new Set(allPlaced.map(b => b.match_id)).size;

      let maxReturn = 0;
      for (const b of activeBets) {
        const pool = poolsByMatch[b.match_id];
        if (pool && pool.bySide[b.pick]) {
          maxReturn += Math.floor((b.amount / pool.bySide[b.pick]) * pool.total);
        }
      }

      const resolved = userBets
        .filter(b => b.status === 'won' || b.status === 'lost')
        .sort((a, b) => ((a.resolved_at || a.created_at) || '').localeCompare((b.resolved_at || b.created_at) || ''));
      const wins = resolved.filter(b => b.status === 'won').length;
      const winRate = resolved.length >= 3 ? Math.round(100 * wins / resolved.length) : null;
      let winStreak = 0, maxStreak = 0;
      for (const b of resolved) {
        if (b.status === 'won') { winStreak++; if (winStreak > maxStreak) maxStreak = winStreak; }
        else winStreak = 0;
      }

      const topBets = [...allPlaced]
        .sort((a, b) => b.amount - a.amount)
        .map(b => {
          const { matchLabel, pickLabel } = labelBet(b);
          return {
            matchLabel, pickLabel,
            amount: b.amount,
            status: b.status,
            payout: b.payout || 0,
            profit: b.status === 'won' ? (b.payout || 0) - b.amount : b.status === 'lost' ? -b.amount : 0,
          };
        });

      let cumPnL = 0;
      const chartPoints = resolved.map(b => {
        cumPnL += b.status === 'won' ? (b.payout || 0) - b.amount : -b.amount;
        return cumPnL;
      });

      return { ...p, balance, realisedBalance, totalStaked, betCount, matchesBet, maxReturn, winRate, winStreak: maxStreak, topBets, chartPoints };
    });

  // Normalize realisedBalance to zero-sum so displayed net win/loss matches
  // what the "Settlement Plan" pays out (parimutuel rounding parity).
  const normalized = normalizeToZeroSum(
    rankings.map(r => ({ id: r.id, net: r.realisedBalance }))
  );
  const normMap = Object.fromEntries(normalized.map(n => [n.id, n.net]));
  for (const r of rankings) {
    if (Object.prototype.hasOwnProperty.call(normMap, r.id)) {
      r.realisedBalance = normMap[r.id];
    } else {
      r.realisedBalance = 0;
    }
  }

  rankings.sort((a, b) => b.totalStaked - a.totalStaked);

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const mapForBiggest = (b) => {
    const { matchLabel, pickLabel } = labelBet(b);
    return {
      userId: b.user_id,
      displayName: profileMap[b.user_id]?.display_name || profileMap[b.user_id]?.username || '?',
      avatarUrl: profileMap[b.user_id]?.avatar_url || null,
      matchId: b.match_id,
      matchLabel,
      pickLabel,
      kind: b.kind || 'match',
      resolvedAt: b.resolved_at || b.created_at,
    };
  };

  const biggestWins = bets
    .filter(b => b.status === 'won' && b.payout > 0 && b.match_id !== '_topup')
    .map(b => ({ ...mapForBiggest(b), stake: b.amount, payout: b.payout, profit: b.payout - b.amount }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20);

  const biggestLosses = bets
    .filter(b => b.status === 'lost' && b.match_id !== '_topup')
    .map(b => ({ ...mapForBiggest(b), amount: b.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  return { rankings, biggestWins, biggestLosses };
}

export async function fetchSettlementDirect() {
  if (!supabaseBrowser) return null;
  return dedupedFetch('settlement', _fetchSettlementDirect);
}

async function _fetchSettlementDirect() {
  const [profilesRes, betsRes] = await Promise.all([
    supabaseBrowser.from('profiles').select('id, username, display_name').range(0, 999),
    supabaseBrowser
      .from('bets')
      .select('user_id, amount, status, payout, match_id')
      .neq('match_id', '_topup')
      .neq('status', 'cancelled')
      .range(0, 9999),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (betsRes.error) throw betsRes.error;

  const resolvedMap = {};
  const ledgerMap = {};
  for (const b of (betsRes.data || [])) {
    ledgerMap[b.user_id] = ledgerMap[b.user_id] || { spent: 0, won: 0 };
    ledgerMap[b.user_id].spent += b.amount;
    if (b.status === 'won') ledgerMap[b.user_id].won += (b.payout || 0);
    if (b.status === 'won' || b.status === 'lost') {
      resolvedMap[b.user_id] = resolvedMap[b.user_id] || { spent: 0, won: 0 };
      resolvedMap[b.user_id].spent += b.amount;
      if (b.status === 'won') resolvedMap[b.user_id].won += (b.payout || 0);
    }
  }

  const withBalance = (map) => (profilesRes.data || []).map(p => ({
    ...p,
    balance: (map[p.id]?.won || 0) - (map[p.id]?.spent || 0),
  }));

  const resolvedProfiles = withBalance(resolvedMap);
  const ledgerProfiles = withBalance(ledgerMap);

  const resolvedPositions = normalizeToZeroSum(computeNetPositions(resolvedProfiles));
  const ledgerPositions = normalizeToZeroSum(computeNetPositions(ledgerProfiles));

  return {
    transactions: computeSettlement(resolvedProfiles),
    positions: resolvedPositions,
    resolved: {
      transactions: computeSettlement(resolvedProfiles),
      positions: resolvedPositions,
    },
    withPending: {
      transactions: computeSettlement(ledgerProfiles),
      positions: ledgerPositions,
    },
  };
}
