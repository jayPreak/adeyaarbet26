import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS } from '@/lib/data';
import { computeSettlement, computeNetPositions } from '@/lib/settlement';

export async function GET() {
  if (!supabase) {
    const mock = FRIENDS.map(f => ({ id: f.id, display_name: f.name, balance: 0 }));
    return NextResponse.json({
      transactions: computeSettlement(mock),
      positions: computeNetPositions(mock),
    });
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name');

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: bets, error: bErr } = await supabase
    .from('bets')
    .select('user_id, amount, status, payout, match_id')
    .neq('match_id', '_topup');

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // Settlement only counts RESOLVED bets (won/lost), excludes pending, cancelled, and topups
  const balanceMap = {};
  for (const b of bets || []) {
    if (b.status !== 'won' && b.status !== 'lost') continue;
    if (!balanceMap[b.user_id]) balanceMap[b.user_id] = { spent: 0, won: 0 };
    balanceMap[b.user_id].spent += b.amount;
    if (b.status === 'won') balanceMap[b.user_id].won += (b.payout || 0);
  }

  const profilesWithBalance = (profiles || []).map(p => ({
    ...p,
    balance: (balanceMap[p.id]?.won || 0) - (balanceMap[p.id]?.spent || 0),
  }));

  return NextResponse.json({
    transactions: computeSettlement(profilesWithBalance),
    positions:    computeNetPositions(profilesWithBalance),
  });
}
