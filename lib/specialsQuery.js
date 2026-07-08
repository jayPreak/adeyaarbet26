import supabaseBrowser from '@/lib/supabase-browser';

/**
 * Compute pool + picks + myBets from a raw list of bets for a single kind.
 * Mirrors the shape returned by /api/special-bet GET so callers can swap
 * transparently.
 *
 * bets: rows already filtered to one kind (all statuses). Each row must have
 * user_id, pick, amount, status, payout, and optionally profiles(display_name, avatar_url).
 */
export function computeSpecialsData(bets, userId) {
  const allBets = bets || [];
  const hasSettled = allBets.some(b => b.status === 'won' || b.status === 'lost');
  const allRefunded = !hasSettled && allBets.length > 0 && allBets.every(b => b.status === 'cancelled');
  const settled = hasSettled || allRefunded;
  const nonCancelled = allBets.filter(b => b.status !== 'cancelled');
  const poolBets = settled ? nonCancelled : nonCancelled.filter(b => b.status === 'pending');

  const total = poolBets.reduce((s, b) => s + b.amount, 0);
  const bettorCount = new Set(poolBets.map(b => b.user_id)).size;

  const byOption = {};
  for (const b of poolBets) {
    byOption[b.pick] = (byOption[b.pick] || 0) + b.amount;
  }

  const picks = poolBets.map(b => ({
    userId: b.user_id,
    displayName: b.profiles?.display_name || '?',
    avatarUrl: b.profiles?.avatar_url || null,
    pick: b.pick,
    amount: b.amount,
  }));

  const myBets = userId
    ? allBets
        .filter(b => b.user_id === userId && (settled || b.status === 'pending'))
        .map(b => ({ id: b.id, pick: b.pick, amount: b.amount, status: b.status, payout: b.payout }))
    : [];

  return { pool: { total, bettorCount, byOption, settled, refunded: allRefunded }, picks, myBets };
}

/**
 * Fetch a single kind directly from Supabase and return the same shape as
 * /api/special-bet GET { pool, picks, myBets }.
 * Returns null if supabaseBrowser is unavailable so callers can fall back.
 */
export async function fetchSpecialDirect({ matchId, kind, userId }) {
  if (!supabaseBrowser) return null;
  const { data, error } = await supabaseBrowser
    .from('bets')
    .select('id, user_id, pick, amount, status, payout, profiles(display_name, avatar_url)')
    .eq('match_id', matchId)
    .eq('kind', kind);
  if (error) throw error;
  return computeSpecialsData(data, userId);
}
