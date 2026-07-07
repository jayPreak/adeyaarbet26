import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('match_id');

  if (!supabase) {
    if (matchId) return NextResponse.json({ matchId, total: 0, bettorCount: 0, bySide: { home: 0, away: 0, draw: 0 }, bets: [] });
    return NextResponse.json({});
  }

  // If no match_id, return all pools (pending + resolved) + all profiles
  if (!matchId) {
    const [betsRes, profilesRes, schedRes] = await Promise.all([
      supabase.from('bets').select('match_id, user_id, pick, amount, status, payout, kind, created_at, profiles(display_name, avatar_url)').limit(5000),
      supabase.from('profiles').select('id, display_name, avatar_url'),
      supabase.from('match_schedule').select('id, kickoff_ts'),
    ]);

    if (betsRes.error) return NextResponse.json({ error: betsRes.error.message }, { status: 500 });

    const allUsers = (profilesRes.data || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }));
    const bets = betsRes.data || [];
    const now = Date.now();
    const finishedMatches = new Set((schedRes.data || []).filter(s => s.kickoff_ts && new Date(s.kickoff_ts).getTime() < now - 2 * 60 * 60 * 1000).map(s => s.id));

    if (!bets.length) return NextResponse.json({ pools: {}, allUsers });

    const grouped = {};
    for (const b of bets) {
      if (b.match_id === '_topup') continue;
      (grouped[b.match_id] = grouped[b.match_id] || []).push(b);
    }

    const pools = {};
    for (const [mid, allBets] of Object.entries(grouped)) {
      // Separate real match bets from penalty bets
      const matchBets   = allBets.filter(b => b.kind === 'match');
      const penaltyBets = allBets.filter(b => b.kind === 'penalty');

      const activeMatchBets   = matchBets.filter(b => b.status !== 'cancelled');
      const activePenaltyBets = penaltyBets.filter(b => b.status !== 'cancelled');

      // Only mark as "refunded" if the match is finished (kickoff > 2h ago) AND all match bets are cancelled.
      const isRefunded = activeMatchBets.length === 0 && matchBets.length > 0 && finishedMatches.has(mid);

      let mBets;
      if (isRefunded) {
        const latest = {};
        for (const b of matchBets) {
          const key = `${b.user_id}|${b.pick}`;
          if (!latest[key] || (b.created_at || '') > (latest[key].created_at || '')) latest[key] = b;
        }
        mBets = Object.values(latest);
      } else {
        mBets = activeMatchBets;
      }

      const matchTotal   = activeMatchBets.reduce((s, b) => s + b.amount, 0);
      const penaltyTotal = activePenaltyBets.reduce((s, b) => s + b.amount, 0);
      // Total pool includes penalties — they inflate winner payouts
      const total = isRefunded
        ? mBets.reduce((s, b) => s + b.amount, 0)
        : matchTotal + penaltyTotal;

      const bySide = { home: 0, away: 0, draw: 0 };
      activeMatchBets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });

      const isResolved = activeMatchBets.some(b => b.status === 'won' || b.status === 'lost')
                      || activePenaltyBets.some(b => b.status === 'won' || b.status === 'lost');

      pools[mid] = {
        matchId: mid,
        total,
        penaltyTotal: isRefunded ? 0 : penaltyTotal,
        // bettorCount and bets[] only reflect real match bets (not penalties)
        bettorCount: new Set(mBets.map(b => b.user_id)).size,
        bySide: isRefunded
          ? (() => { const s = { home: 0, away: 0, draw: 0 }; mBets.forEach(b => { s[b.pick] = (s[b.pick] || 0) + b.amount; }); return s; })()
          : bySide,
        resolved: isResolved || isRefunded,
        refunded: isRefunded,
        bets: mBets.map(b => ({
          user_id: b.user_id,
          display_name: b.profiles?.display_name || 'Unknown',
          avatar_url: b.profiles?.avatar_url || null,
          pick: b.pick,
          amount: b.amount,
          status: b.status,
          payout: b.payout || null,
          possible_win: isRefunded
            ? 0
            : isResolved
              ? (b.status === 'won' ? (b.payout || 0) : 0)
              : Math.floor((b.amount / (bySide[b.pick] || 1)) * total),
        })),
      };
    }
    return NextResponse.json({ pools, allUsers });
  }

  // Single match pool — include penalty totals but exclude penalty bets from display
  const { data: bets, error } = await supabase
    .from('bets')
    .select('user_id, pick, amount, kind, profiles(display_name)')
    .eq('match_id', matchId)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matchBets   = (bets || []).filter(b => b.kind !== 'penalty');
  const penaltyBets = (bets || []).filter(b => b.kind === 'penalty');

  const penaltyTotal = penaltyBets.reduce((s, b) => s + b.amount, 0);
  const matchTotal   = matchBets.reduce((s, b) => s + b.amount, 0);
  // Total pool = match stakes + penalty amounts
  const total = matchTotal + penaltyTotal;

  const bettorCount = new Set(matchBets.map(b => b.user_id)).size;
  const bySide = { home: 0, away: 0, draw: 0 };
  matchBets.forEach(b => { bySide[b.pick] = (bySide[b.pick] || 0) + b.amount; });

  const enriched = matchBets.map(b => {
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

  return NextResponse.json({ matchId, total, penaltyTotal, bettorCount, bySide, bets: enriched });
}
