import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS } from '@/lib/data';
import { computeBalance, STARTING_BALANCE } from '@/lib/ledger';


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
    .select('user_id, amount, status, payout, match_id');

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // Group bets by user, compute balance via shared ledger formula
  const betsByUser = {};
  const realBetsByUser = {};
  for (const b of bets) {
    (betsByUser[b.user_id] = betsByUser[b.user_id] || []).push(b);
    if (b.match_id !== '_topup') {
      (realBetsByUser[b.user_id] = realBetsByUser[b.user_id] || []).push(b);
    }
  }

  const result = profiles.map(p => {
    const pnl = computeBalance(realBetsByUser[p.id] || []);
    const wallet = STARTING_BALANCE + computeBalance(betsByUser[p.id] || []);
    return { ...p, balance: pnl, wallet };
  });

  result.sort((a, b) => b.balance - a.balance);
  return NextResponse.json(result);
}
