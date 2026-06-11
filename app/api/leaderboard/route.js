import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS } from '@/lib/data';
import { computeBalance } from '@/lib/ledger';


export async function GET() {
  if (!supabase) {
    const mock = FRIENDS.map(f => ({
      id: f.id,
      username: f.id,
      display_name: f.name,
      balance: 0,
    }));
    return NextResponse.json(mock);
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url');

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: bets, error: bErr } = await supabase
    .from('bets')
    .select('user_id, amount, status, payout, match_id, pick, kind');

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const betsByUser = {};
  for (const b of bets) {
    if (b.match_id !== '_topup') {
      (betsByUser[b.user_id] = betsByUser[b.user_id] || []).push(b);
    }
  }

  // Group all pending bets by match_id to compute potential returns
  const poolsByMatch = {};
  for (const b of bets) {
    if (b.match_id === '_topup' || b.status !== 'pending') continue;
    if (!poolsByMatch[b.match_id]) poolsByMatch[b.match_id] = { total: 0, bySide: {} };
    poolsByMatch[b.match_id].total += b.amount;
    const side = b.pick;
    poolsByMatch[b.match_id].bySide[side] = (poolsByMatch[b.match_id].bySide[side] || 0) + b.amount;
  }

  const result = profiles
    .filter(p => betsByUser[p.id]?.some(b => b.status !== 'cancelled'))
    .map(p => {
      const userBets = betsByUser[p.id];
      const balance = computeBalance(userBets);
      const activeBets = userBets.filter(b => b.status === 'pending');
      const totalStaked = activeBets.reduce((sum, b) => sum + b.amount, 0);
      const betCount = activeBets.length;
      const matchesBet = new Set(activeBets.map(b => b.match_id)).size;

      // Best-case: if every bet wins, what's the max payout
      let maxReturn = 0;
      for (const b of activeBets) {
        const pool = poolsByMatch[b.match_id];
        if (pool && pool.bySide[b.pick]) {
          maxReturn += Math.floor((b.amount / pool.bySide[b.pick]) * pool.total);
        }
      }

      return { ...p, balance, totalStaked, betCount, matchesBet, maxReturn };
    });

  result.sort((a, b) => b.totalStaked - a.totalStaked);

  // Biggest wins: individual resolved bets ranked by profit (payout - stake)
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const biggestWins = bets
    .filter(b => b.status === 'won' && b.payout > 0 && b.match_id !== '_topup')
    .map(b => ({
      userId: b.user_id,
      displayName: profileMap[b.user_id]?.display_name || profileMap[b.user_id]?.username || '?',
      avatarUrl: profileMap[b.user_id]?.avatar_url || null,
      matchId: b.match_id,
      pick: b.pick,
      kind: b.kind || 'match',
      stake: b.amount,
      payout: b.payout,
      profit: b.payout - b.amount,
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20);

  return NextResponse.json({ rankings: result, biggestWins });
}
