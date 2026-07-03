import { NextResponse } from 'next/server';
import supabaseAnon from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const db = supabaseAdmin || supabaseAnon;

// GET — all duels, newest first (whole friend group can see everything)
export async function GET() {
  if (!db) return NextResponse.json({ challenges: [] });

  const { data, error } = await db
    .from('challenges')
    .select(`
      id, match_id, challenger_id, opponent_id, challenger_pick, amount,
      status, winner_id, created_at, resolved_at,
      challenger:profiles!challenges_challenger_id_fkey(display_name, avatar_url),
      opponent:profiles!challenges_opponent_id_fkey(display_name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenges: data || [] });
}

// POST — create a duel: {userId, opponentId, matchId, pick, amount}
export async function POST(request) {
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await request.json();
  const { userId, opponentId, matchId, pick, amount } = body;

  if (!userId || !opponentId || !matchId || !pick || !amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { error: authError } = await verifyUser(userId);
  if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db.rpc('create_challenge', {
    p_challenger: userId,
    p_opponent: opponentId,
    p_match_id: matchId,
    p_pick: pick,
    p_amount: amount,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// PUT — act on a duel: {userId, challengeId, action: 'accept' | 'decline' | 'cancel'}
export async function PUT(request) {
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await request.json();
  const { userId, challengeId, action } = body;

  if (!userId || !challengeId || !['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const { error: authError } = await verifyUser(userId);
  if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rpcName = action === 'accept' ? 'accept_challenge'
    : action === 'decline' ? 'decline_challenge'
    : 'cancel_challenge';

  const { data, error } = await db.rpc(rpcName, {
    p_user_id: userId,
    p_challenge_id: challengeId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
