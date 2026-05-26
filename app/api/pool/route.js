import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('match_id');

  if (!supabase) {
    if (matchId) return NextResponse.json({ matchId, total: 0, bettorCount: 0, bySide: { home: 0, away: 0, draw: 0 }, bets: [] });
    return NextResponse.json({});
  }

  // If no match_id, return all active pools (matches with pending bets) + all profiles
  if (!matchId) {
    const [betsRes, profilesRes] = await Promise.all([
      supabase.from('bets').select('match_id, user_id, pick, amount, profiles(display_name, avatar_url)').eq('status', 'pending'),
      supabase.from('profiles').select('id, display_name, avatar_url'),
    ]);

    if (betsRes.error) return NextResponse.json({ error: betsRes.error.message }, { status: 500 });

    const allUsers = (profilesRes.data || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }));
    const bets = betsRes.data || [];

    if (!bets.length) return NextResponse.json({ pools: {}, allUsers });

    const grouped = {};
    for (const b of bets) {
      (grouped[b.match_id] = grouped[b.match_id] || []).push(b);
    }

    const pools = {};
    for (const [mid, mBets] of Object.entries(grouped)) {
      const total = mBets.reduce((s, b) => s + b.amount, 0);
      const bySide = { home: 0, away: 0, draw: 0 };
      mBets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });
      pools[mid] = {
        matchId: mid,
        total,
        bettorCount: new Set(mBets.map(b => b.user_id)).size,
        bySide,
        bets: mBets.map(b => ({
          user_id: b.user_id,
          display_name: b.profiles?.display_name || 'Unknown',
          pick: b.pick,
          amount: b.amount,
          possible_win: Math.floor((b.amount / (bySide[b.pick] || 1)) * total),
        })),
      };
    }
    return NextResponse.json({ pools, allUsers });
  }

  const { data: bets, error } = await supabase
    .from('bets')
    .select('user_id, pick, amount, profiles(display_name)')
    .eq('match_id', matchId)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = bets.reduce((s, b) => s + b.amount, 0);
  const bettorCount = new Set(bets.map(b => b.user_id)).size;
  const bySide = { home: 0, away: 0, draw: 0 };
  bets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });

  const enriched = bets.map(b => {
    const sidePool = bySide[b.pick] || 1;
    const possibleWin = Math.floor((b.amount / sidePool) * total);
    return {
      user_id: b.user_id,
      display_name: b.profiles?.display_name || 'Unknown',
      pick: b.pick,
      amount: b.amount,
      possible_win: possibleWin,
    };
  });

  return NextResponse.json({ matchId, total, bettorCount, bySide, bets: enriched });
}
