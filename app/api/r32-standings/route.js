import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabase) return NextResponse.json({ standings: [] });

  const { data: bets, error } = await supabase
    .from('bets')
    .select('user_id, match_id, pick, amount, status, payout, kind, created_at, profiles(display_name, avatar_url)')
    .eq('kind', 'match')
    .neq('status', 'cancelled')
    .or('match_id.like.R32-%,match_id.like.R16-%')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byUser = {};
  for (const b of (bets || [])) {
    if (!byUser[b.user_id]) {
      byUser[b.user_id] = {
        userId: b.user_id,
        displayName: b.profiles?.display_name || '?',
        avatarUrl: b.profiles?.avatar_url || null,
        staked: 0,
        won: 0,
        lost: 0,
        pending: 0,
        net: 0,
        bets: 0,
        history: [],
      };
    }
    const u = byUser[b.user_id];
    u.bets++;
    u.staked += b.amount;
    if (b.status === 'won') {
      u.won += (b.payout || 0) - b.amount;
    } else if (b.status === 'lost') {
      u.lost += b.amount;
    } else if (b.status === 'pending') {
      u.pending += b.amount;
    }
    u.history.push({
      matchId: b.match_id,
      pick: b.pick,
      amount: b.amount,
      status: b.status,
      payout: b.payout,
      createdAt: b.created_at,
    });
  }

  for (const u of Object.values(byUser)) {
    u.net = u.won - u.lost;
  }

  const standings = Object.values(byUser).sort((a, b) => a.net - b.net);

  // Count resolved vs total R32+R16 matches from bets data
  const matchIds = new Set((bets || []).map(b => b.match_id));
  const resolvedIds = new Set((bets || []).filter(b => b.status === 'won' || b.status === 'lost').map(b => b.match_id));
  const totalMatches = 24; // 16 R32 + 8 R16
  const resolvedMatches = resolvedIds.size;
  const bettedMatches = matchIds.size;

  return NextResponse.json(
    { standings, progress: { resolved: resolvedMatches, total: totalMatches, betted: bettedMatches } },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}
