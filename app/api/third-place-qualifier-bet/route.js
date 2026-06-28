import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MATCH_ID = 'THIRD_QUALIFIERS';
const KIND = 'third_place_qualifiers';
const DEADLINE_TS = new Date('2026-06-26T18:59:00Z').getTime();

export async function GET(request) {
  if (!supabase) return NextResponse.json({ myBet: null, pool: null, picks: [] });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  const { data: bets, error } = await supabase
    .from('bets')
    .select('id, user_id, pick, amount, status, payout, profiles(display_name, avatar_url)')
    .eq('match_id', MATCH_ID)
    .eq('kind', KIND);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activeBets = (bets || []).filter(b => b.status === 'pending' || b.status === 'cancelled');
  const uniqueByUser = {};
  for (const b of activeBets) {
    if (!uniqueByUser[b.user_id] || b.status === 'pending') {
      uniqueByUser[b.user_id] = b;
    }
  }
  const displayBets = Object.values(uniqueByUser);
  const total = displayBets.reduce((s, b) => s + b.amount, 0);
  const bettorCount = displayBets.length;

  const picks = displayBets.map(b => ({
    userId: b.user_id,
    displayName: b.profiles?.display_name || '?',
    avatarUrl: b.profiles?.avatar_url || null,
    pick: b.pick,
    amount: b.amount,
    status: b.status,
  }));

  const myBet = userId
    ? (displayBets.find(b => b.user_id === userId) || null)
    : null;

  // Hide individual picks until the deadline has passed to prevent copying
  const deadlinePassed = Date.now() > DEADLINE_TS;

  return NextResponse.json({
    myBet: myBet ? { id: myBet.id, pick: myBet.pick, amount: myBet.amount } : null,
    pool: { total, bettorCount },
    picks: deadlinePassed ? picks : [],
    deadlinePassed,
  });
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await request.json();
  const { userId, picks, amount } = body;

  if (!userId || !picks || !amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (!Array.isArray(picks) || picks.length !== 8) {
    return NextResponse.json({ error: 'Must pick exactly 8 teams' }, { status: 400 });
  }
  if (Date.now() > DEADLINE_TS) {
    return NextResponse.json({ error: 'Betting is closed' }, { status: 400 });
  }

  const { error: authError } = await verifyUser(userId);
  if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pick = [...picks].sort().join(',');

  // place_special_bet with p_multi_pick=false atomically cancels any existing
  // pending bet for this (user, match_id, kind) before inserting the new one.
  const { data, error } = await supabase.rpc('place_special_bet', {
    p_user_id: userId,
    p_match_id: MATCH_ID,
    p_kind: KIND,
    p_pick: pick,
    p_amount: amount,
    p_multi_pick: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request) {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await request.json();
  const { userId, betId } = body;

  if (!userId || !betId) {
    return NextResponse.json({ error: 'userId and betId required' }, { status: 400 });
  }

  const { error: authError } = await verifyUser(userId);
  if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('cancel_special_bet_by_id', {
    p_user_id: userId,
    p_bet_id: betId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
