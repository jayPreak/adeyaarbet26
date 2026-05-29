import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';

export async function GET(request) {
  if (!supabase) return NextResponse.json({ myBet: null, pool: { byTeam: {}, total: 0, bettorCount: 0 }, deadlineTs: CUP_WINNER_DEADLINE_TS });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  const poolQuery = supabase
    .from('bets')
    .select('user_id, pick, amount, status')
    .eq('kind', 'cup_winner')
    .eq('status', 'pending');

  const myBetQuery = userId
    ? supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId)
        .eq('kind', 'cup_winner')
        .eq('status', 'pending')
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [poolRes, myBetRes] = await Promise.all([poolQuery, myBetQuery]);

  if (poolRes.error) return NextResponse.json({ error: poolRes.error.message }, { status: 500 });
  if (myBetRes.error) return NextResponse.json({ error: myBetRes.error.message }, { status: 500 });

  const byTeam = {};
  let total = 0;
  const bettors = new Set();
  for (const b of poolRes.data || []) {
    byTeam[b.pick] = (byTeam[b.pick] || 0) + b.amount;
    total += b.amount;
    bettors.add(b.user_id);
  }

  return NextResponse.json({
    myBet: myBetRes.data || null,
    pool: { byTeam, total, bettorCount: bettors.size },
    deadlineTs: CUP_WINNER_DEADLINE_TS,
  });
}

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Betting requires database.' }, { status: 503 });
  }

  try {
    const { userId, teamCode, amount } = await request.json();
    if (!userId || !teamCode || !amount) {
      return NextResponse.json({ error: 'Missing required fields: userId, teamCode, amount' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('place_cup_winner_bet', {
      p_user_id: userId,
      p_team_code: teamCode,
      p_amount: amount,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Insufficient balance')) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      if (msg.includes('Cup winner betting closed')) return NextResponse.json({ error: 'Cup winner betting closed' }, { status: 400 });
      if (msg.includes('Invalid team code')) return NextResponse.json({ error: msg }, { status: 400 });
      if (msg.includes('Amount must be positive')) return NextResponse.json({ error: msg }, { status: 400 });
      if (msg.includes('Already on this team')) return NextResponse.json({ error: msg }, { status: 409 });
      if (msg.includes('User not found')) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request) {
  if (!supabase) return NextResponse.json({ error: 'Betting requires database.' }, { status: 503 });
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const { data, error } = await supabase.rpc('cancel_cup_winner_bet', { p_user_id: userId });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Cup winner betting closed')) return NextResponse.json({ error: 'Cup winner betting closed' }, { status: 400 });
      if (msg.includes('No active cup-winner bet')) return NextResponse.json({ error: msg }, { status: 404 });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
