import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!supabase) return NextResponse.json({ pool: null, myBets: [] });

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('match_id');
  const kind = searchParams.get('kind');
  const userId = searchParams.get('user_id');
  const summary = searchParams.get('summary');

  if (!matchId || !kind) {
    return NextResponse.json({ error: 'match_id and kind required' }, { status: 400 });
  }

  // Halftime summary: aggregate across all HT_* pools
  if (matchId === 'HT_ALL' && summary === 'true') {
    const { data: bets, error } = await supabase
      .from('bets')
      .select('id, user_id, match_id, pick, amount, status, profiles(display_name, avatar_url)')
      .eq('kind', 'halftime')
      .neq('status', 'cancelled');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const pending = (bets || []).filter(b => b.status === 'pending');
    const totalPool = pending.reduce((s, b) => s + b.amount, 0);
    const totalBettors = new Set(pending.map(b => b.user_id)).size;
    const totalBets = pending.length;

    const performers = {};
    for (const b of pending) {
      if (!performers[b.match_id]) performers[b.match_id] = { total: 0, bettors: new Set(), byOption: {}, picks: [] };
      performers[b.match_id].total += b.amount;
      performers[b.match_id].bettors.add(b.user_id);
      performers[b.match_id].byOption[b.pick] = (performers[b.match_id].byOption[b.pick] || 0) + b.amount;
      performers[b.match_id].picks.push({
        userId: b.user_id,
        displayName: b.profiles?.display_name || '?',
        avatarUrl: b.profiles?.avatar_url || null,
        pick: b.pick,
        amount: b.amount,
      });
    }
    const performerData = {};
    for (const [mid, data] of Object.entries(performers)) {
      performerData[mid] = { total: data.total, bettorCount: data.bettors.size, byOption: data.byOption, picks: data.picks };
    }

    return NextResponse.json({ totalPool, totalBettors, totalBets, performers: performerData });
  }

  const { data: bets, error } = await supabase
    .from('bets')
    .select('id, user_id, pick, amount, status, payout, profiles(display_name, avatar_url)')
    .eq('match_id', matchId)
    .eq('kind', kind)
    .neq('status', 'cancelled');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = (bets || []).filter(b => b.status === 'pending');
  const total = pending.reduce((s, b) => s + b.amount, 0);
  const bettorCount = new Set(pending.map(b => b.user_id)).size;

  const byOption = {};
  for (const b of pending) {
    byOption[b.pick] = (byOption[b.pick] || 0) + b.amount;
  }

  const picks = pending.map(b => ({
    userId: b.user_id,
    displayName: b.profiles?.display_name || '?',
    avatarUrl: b.profiles?.avatar_url || null,
    pick: b.pick,
    amount: b.amount,
  }));

  const myBets = userId
    ? pending.filter(b => b.user_id === userId).map(b => ({ id: b.id, pick: b.pick, amount: b.amount }))
    : [];

  return NextResponse.json({ pool: { total, bettorCount, byOption }, picks, myBets });
}

export async function POST(request) {
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await request.json();
  const { userId, matchId, kind, pick, amount, multiPick } = body;

  if (!userId || !matchId || !kind || !pick || !amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('place_special_bet', {
    p_user_id: userId,
    p_match_id: matchId,
    p_kind: kind,
    p_pick: pick,
    p_amount: amount,
    p_multi_pick: multiPick || false,
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

  const { data, error } = await supabase.rpc('cancel_special_bet_by_id', {
    p_user_id: userId,
    p_bet_id: betId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
