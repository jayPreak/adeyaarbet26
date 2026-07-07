import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS, getMatch, getTeam, fmtKnockoutStage } from '@/lib/data';
import { computeBalance, computeRealisedBalance } from '@/lib/ledger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    .select('user_id, amount, status, payout, match_id, pick, kind, created_at, resolved_at')
    .limit(5000);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const betsByUser = {};
  for (const b of bets) {
    if (b.match_id !== '_topup') {
      (betsByUser[b.user_id] = betsByUser[b.user_id] || []).push(b);
    }
  }

  // Group all pending bets by match_id to compute potential returns
  const poolsByMatch = {};
  for (const b of bets) {
    if (b.match_id === '_topup' || b.status !== 'pending') continue;
    if (!poolsByMatch[b.match_id]) poolsByMatch[b.match_id] = { total: 0, bySide: {} };
    poolsByMatch[b.match_id].total += b.amount;
    const side = b.pick;
    poolsByMatch[b.match_id].bySide[side] = (poolsByMatch[b.match_id].bySide[side] || 0) + b.amount;
  }

  const result = profiles
    .filter(p => betsByUser[p.id]?.some(b => b.status !== 'cancelled'))
    .map(p => {
      const userBets = betsByUser[p.id];
      const balance = computeBalance(userBets);
      const realisedBalance = computeRealisedBalance(userBets);
      const activeBets = userBets.filter(b => b.status === 'pending');
      const allPlaced = userBets.filter(b => b.status !== 'cancelled');
      const totalStaked = allPlaced.reduce((sum, b) => sum + b.amount, 0);
      const betCount = allPlaced.length;
      const matchesBet = new Set(allPlaced.map(b => b.match_id)).size;

      // Best-case: if every bet wins, what's the max payout
      let maxReturn = 0;
      for (const b of activeBets) {
        const pool = poolsByMatch[b.match_id];
        if (pool && pool.bySide[b.pick]) {
          maxReturn += Math.floor((b.amount / pool.bySide[b.pick]) * pool.total);
        }
      }

      // Win rate + streak
      const resolved = userBets
        .filter(b => b.status === 'won' || b.status === 'lost')
        .sort((a, b) => ((a.resolved_at || a.created_at) || '').localeCompare((b.resolved_at || b.created_at) || ''));
      const wins = resolved.filter(b => b.status === 'won').length;
      const winRate = resolved.length >= 3 ? Math.round(100 * wins / resolved.length) : null;
      let winStreak = 0, maxStreak = 0;
      for (const b of resolved) {
        if (b.status === 'won') { winStreak++; if (winStreak > maxStreak) maxStreak = winStreak; }
        else winStreak = 0;
      }

      // Top individual bets (biggest by amount, include outcome)
      const allNonCancelled = userBets
        .filter(b => b.status !== 'cancelled')
        .sort((a, b) => b.amount - a.amount);
      const topBets = allNonCancelled.map(b => {
        let matchLabel = b.match_id;
        let pickLabel = b.pick;
        const m = getMatch(b.match_id);
        const stageTag = fmtKnockoutStage(b.match_id);
        if (m) {
          const h = getTeam(m.home);
          const a = getTeam(m.away);
          matchLabel = `${h?.code || '?'} vs ${a?.code || '?'}`;
          if (b.pick === 'home') pickLabel = h?.name || b.pick;
          else if (b.pick === 'away') pickLabel = a?.name || b.pick;
          else pickLabel = 'Draw';
        } else if (b.match_id === 'CUP_WINNER') {
          matchLabel = 'Cup Winner';
          const pt = getTeam(b.pick);
          if (pt) pickLabel = pt.name;
        } else if (b.match_id === 'CONTINENT') {
          matchLabel = 'Continent';
        } else if (b.match_id?.startsWith('HT_')) {
          matchLabel = 'Halftime';
          pickLabel = b.pick?.toUpperCase();
        } else if (stageTag) {
          matchLabel = stageTag;
          pickLabel = b.pick === 'home' ? 'Home' : b.pick === 'away' ? 'Away' : 'Draw';
        }
        return {
          matchLabel,
          pickLabel,
          amount: b.amount,
          status: b.status,
          payout: b.payout || 0,
          profit: b.status === 'won' ? (b.payout || 0) - b.amount : b.status === 'lost' ? -b.amount : 0,
        };
      });

      // Chart points: cumulative P&L for sparkline
      let cumPnL = 0;
      const chartPoints = resolved.map(b => {
        cumPnL += b.status === 'won' ? (b.payout || 0) - b.amount : -b.amount;
        return cumPnL;
      });

      return { ...p, balance, realisedBalance, totalStaked, betCount, matchesBet, maxReturn, winRate, winStreak: maxStreak, topBets, chartPoints };
    });

  result.sort((a, b) => b.totalStaked - a.totalStaked);

  // Biggest wins: individual resolved bets ranked by profit (payout - stake)
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
  const biggestWins = bets
    .filter(b => b.status === 'won' && b.payout > 0 && b.match_id !== '_topup')
    .map(b => {
      let matchLabel = b.match_id;
      let pickLabel = b.pick;
      const m = getMatch(b.match_id);
      const stageTag = fmtKnockoutStage(b.match_id);
      if (m) {
        const h = getTeam(m.home);
        const a = getTeam(m.away);
        matchLabel = `${h.code} vs ${a.code}`;
        if (b.pick === 'home') pickLabel = h.name;
        else if (b.pick === 'away') pickLabel = a.name;
        else pickLabel = 'Draw';
      } else if (b.match_id === 'CUP_WINNER') {
        matchLabel = 'Cup Winner';
        const pt = getTeam(b.pick);
        if (pt) pickLabel = pt.name;
      } else if (stageTag) {
        matchLabel = stageTag;
        pickLabel = b.pick === 'home' ? 'Home' : b.pick === 'away' ? 'Away' : 'Draw';
      }
      return {
        userId: b.user_id,
        displayName: profileMap[b.user_id]?.display_name || profileMap[b.user_id]?.username || '?',
        avatarUrl: profileMap[b.user_id]?.avatar_url || null,
        matchId: b.match_id,
        matchLabel,
        pickLabel,
        kind: b.kind || 'match',
        stake: b.amount,
        payout: b.payout,
        profit: b.payout - b.amount,
        resolvedAt: b.resolved_at || b.created_at,
      };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20);

  const biggestLosses = bets
    .filter(b => b.status === 'lost' && b.match_id !== '_topup')
    .map(b => {
      let matchLabel = b.match_id;
      let pickLabel = b.pick;
      const m = getMatch(b.match_id);
      const stageTag = fmtKnockoutStage(b.match_id);
      if (m) {
        const h = getTeam(m.home);
        const a = getTeam(m.away);
        matchLabel = `${h.code} vs ${a.code}`;
        if (b.pick === 'home') pickLabel = h.name;
        else if (b.pick === 'away') pickLabel = a.name;
        else pickLabel = 'Draw';
      } else if (b.match_id === 'CUP_WINNER') {
        matchLabel = 'Cup Winner';
        const pt = getTeam(b.pick);
        if (pt) pickLabel = pt.name;
      } else if (stageTag) {
        matchLabel = stageTag;
        pickLabel = b.pick === 'home' ? 'Home' : b.pick === 'away' ? 'Away' : 'Draw';
      }
      return {
        userId: b.user_id,
        displayName: profileMap[b.user_id]?.display_name || profileMap[b.user_id]?.username || '?',
        avatarUrl: profileMap[b.user_id]?.avatar_url || null,
        matchId: b.match_id,
        matchLabel,
        pickLabel,
        kind: b.kind || 'match',
        amount: b.amount,
        resolvedAt: b.resolved_at || b.created_at,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  return NextResponse.json({ rankings: result, biggestWins, biggestLosses });
}
