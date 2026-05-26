import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const matchId = searchParams.get('match_id');
  if (!supabase) {
    return NextResponse.json([]);
  }

  let query = supabase.from('bets').select('*').order('created_at', { ascending: false });

  if (userId) query = query.eq('user_id', userId);
  if (matchId) query = query.eq('match_id', matchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  
  if (!supabase) {
    return NextResponse.json({ error: 'Betting requires database. Set NEXT_PUBLIC_SUPABASE_URL.' }, { status: 503 });
  }

  try {
    const { userId, matchId, pick, amount } = await request.json();

    if (!userId || !matchId || !pick || !amount) {
      return NextResponse.json({ error: 'Missing required fields: userId, matchId, pick, amount' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('place_bet', {
      p_user_id: userId,
      p_match_id: matchId,
      p_pick: pick,
      p_amount: amount,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Insufficient balance')) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }
      if (msg.includes('Already bet on this side')) {
        return NextResponse.json({ error: 'You already have a bet on this side. Cancel first to change amount.' }, { status: 409 });
      }
      if (msg.includes('Invalid pick') || msg.includes('Amount must be positive')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      if (msg.includes('User not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (msg.includes('Match already resolved')) {
        return NextResponse.json({ error: 'Match already resolved — betting closed' }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
