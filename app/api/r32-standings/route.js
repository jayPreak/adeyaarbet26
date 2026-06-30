import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabase) return NextResponse.json({ standings: [] });

  const { data: bets, error } = await supabase
    .from('bets')
    .select('user_id, match_id, pick, amount, status, payout, kind, profiles(display_name, avatar_url)')
    .like('match_id', 'R32-%')
    .eq('kind', 'match')
    .neq('status', 'cancelled');

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
  }

  for (const u of Object.values(byUser)) {
    u.net = u.won - u.lost;
  }

  const standings = Object.values(byUser).sort((a, b) => a.net - b.net);

  return NextResponse.json({ standings });
}
