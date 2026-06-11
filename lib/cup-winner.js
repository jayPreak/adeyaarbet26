import supabase from '@/lib/supabase';
import { KICKOFF_TS } from '@/lib/countdown';

export const CUP_WINNER_DEADLINE_TS = KICKOFF_TS - 30 * 1000;
export const CUP_WINNER_MATCH_ID = 'CUP_WINNER';

// Cup-winner betting closes 30s before the first match. Given match_schedule rows
// (each with a `kickoff_ts` ISO string), returns that deadline in epoch ms, or null
// if there are no rows. Single source of the displayed deadline rule.
export function cupWinnerDeadlineFromKickoffs(rows) {
  if (!rows || !rows.length) return null;
  const min = Math.min(...rows.map((r) => new Date(r.kickoff_ts).getTime()));
  return min - 30 * 1000;
}

export function isCupWinnerOpen(now = Date.now()) {
  return now < CUP_WINNER_DEADLINE_TS;
}

export async function placeCupWinnerBet(userId, teamCode, amount) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase.rpc('place_cup_winner_bet', {
    p_user_id: userId,
    p_team_code: teamCode,
    p_amount: amount,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelCupWinnerBet(userId) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase.rpc('cancel_cup_winner_bet', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyCupWinnerBet(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'cup_winner')
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCupWinnerPool() {
  if (!supabase) return { byTeam: {}, total: 0, bettorCount: 0 };
  const { data, error } = await supabase
    .from('bets')
    .select('user_id, pick, amount, status')
    .eq('kind', 'cup_winner')
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  const byTeam = {};
  let total = 0;
  const bettors = new Set();
  for (const b of data) {
    byTeam[b.pick] = (byTeam[b.pick] || 0) + b.amount;
    total += b.amount;
    bettors.add(b.user_id);
  }
  return { byTeam, total, bettorCount: bettors.size };
}
