import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET ?match_id=A1&user_id=xxx  → pool + my bet for a specific match
// GET ?summary=true&user_id=xxx → aggregate stats across all matches (for Specials card)
export async function GET(request) {
  if (!supabase) {
    return NextResponse.json({ myBet: null, pool: { byPlayer: {}, total: 0, bettorCount: 0 }, picks: [] });
  }

  const { searchParams } = new URL(request.url);
  const matchId  = searchParams.get('match_id');
  const userId   = searchParams.get('user_id');
  const summary  = searchParams.get('summary') === 'true';

  if (summary) {
    // Aggregate across all matches
    const { data: allBets, error } = await supabase
      .from('bets')
      .select('user_id, match_id, pick, amount')
      .eq('kind', 'goalscorer')
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let total = 0;
    const bettors = new Set();
    const byMatch = {};
    for (const b of allBets || []) {
      total += b.amount;
      bettors.add(b.user_id);
      byMatch[b.match_id] = (byMatch[b.match_id] || 0) + b.amount;
    }
    return NextResponse.json({ total, bettorCount: bettors.size, byMatch });
  }

  if (!matchId) {
    return NextResponse.json({ error: 'match_id required' }, { status: 400 });
  }

  // Per-match pool + picks (with player names from match_players)
  const poolQuery = supabase
    .from('bets')
    .select('id, user_id, pick, amount, created_at, profiles(display_name, avatar_url)')
    .eq('kind', 'goalscorer')
    .eq('match_id', matchId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const myBetQuery = userId
    ? supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId)
        .eq('kind', 'goalscorer')
        .eq('match_id', matchId)
        .eq('status', 'pending')
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const playersQuery = supabase
    .from('match_players')
    .select('player_id, player_name, team_code, jersey_num')
    .eq('match_id', matchId);

  const [poolRes, myBetRes, playersRes] = await Promise.all([poolQuery, myBetQuery, playersQuery]);

  if (poolRes.error) return NextResponse.json({ error: poolRes.error.message }, { status: 500 });

  // Build player name lookup
  const playerNames = {};
  for (const p of playersRes.data || []) playerNames[p.player_id] = p;

  const byPlayer = {};
  let total = 0;
  const bettors = new Set();
  const picks = [];

  for (const b of poolRes.data || []) {
    byPlayer[b.pick] = (byPlayer[b.pick] || 0) + b.amount;
    total += b.amount;
    bettors.add(b.user_id);
    const player = playerNames[b.pick];
    picks.push({
      user_id: b.user_id,
      display_name: b.profiles?.display_name || 'Unknown',
      avatar_url: b.profiles?.avatar_url || null,
      pick: b.pick,
      player_name: player?.player_name || b.pick,
      player_team: player?.team_code || null,
      amount: b.amount,
      created_at: b.created_at,
    });
  }

  let myBet = myBetRes.data || null;
  if (myBet) {
    const player = playerNames[myBet.pick];
    myBet = { ...myBet, player_name: player?.player_name || myBet.pick };
  }

  return NextResponse.json({
    myBet,
    pool: { byPlayer, total, bettorCount: bettors.size },
    picks,
    playerNames,
  });
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ error: 'Betting requires database.' }, { status: 503 });

  try {
    const { userId, matchId, playerId, amount } = await request.json();
    if (!userId || !matchId || !playerId || !amount) {
      return NextResponse.json({ error: 'Missing required fields: userId, matchId, playerId, amount' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('place_goalscorer_bet', {
      p_user_id:   userId,
      p_match_id:  matchId,
      p_player_id: playerId,
      p_amount:    amount,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Bet exceeds maximum'))         return NextResponse.json({ error: msg }, { status: 400 });
      if (msg.includes('Betting closed'))              return NextResponse.json({ error: 'Betting closed for this match' }, { status: 400 });
      if (msg.includes('Unknown match'))               return NextResponse.json({ error: msg }, { status: 400 });
      if (msg.includes('Amount must be positive'))     return NextResponse.json({ error: msg }, { status: 400 });
      if (msg.includes('Already bet on this player'))  return NextResponse.json({ error: msg }, { status: 409 });
      if (msg.includes('Match already resolved'))      return NextResponse.json({ error: msg }, { status: 409 });
      if (msg.includes('User not found'))              return NextResponse.json({ error: msg }, { status: 404 });
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
    const { userId, matchId } = await request.json();
    if (!userId || !matchId) return NextResponse.json({ error: 'Missing userId, matchId' }, { status: 400 });

    const { data, error } = await supabase.rpc('cancel_goalscorer_bet', {
      p_user_id:  userId,
      p_match_id: matchId,
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Betting closed'))             return NextResponse.json({ error: 'Betting closed for this match' }, { status: 400 });
      if (msg.includes('No active goalscorer bet'))   return NextResponse.json({ error: msg }, { status: 404 });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
