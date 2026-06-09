import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS } from '@/lib/data';
import { computeSettlement, computeNetPositions } from '@/lib/settlement';

export async function GET() {
  if (!supabase) {
    const mock = FRIENDS.map(f => ({ id: f.id, display_name: f.name, balance: 0 }));
    return NextResponse.json({
      transactions: computeSettlement(mock),
      positions: computeNetPositions(mock),
    });
  }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name');

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: bets, error: bErr } = await supabase
    .from('bets')
    .select('user_id, amount, status, payout, match_id')
    .neq('match_id', '_topup');

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  // Two views:
  //   resolved      → only won/lost bets count ("if WC ended now, refund pending")
  //   withPending   → pending stakes also count ("current ledger exposure")
  const resolvedMap = {};
  const ledgerMap = {};
  for (const b of bets || []) {
    if (b.status === 'cancelled') continue;
    ledgerMap[b.user_id] = ledgerMap[b.user_id] || { spent: 0, won: 0 };
    ledgerMap[b.user_id].spent += b.amount;
    if (b.status === 'won') ledgerMap[b.user_id].won += (b.payout || 0);

    if (b.status === 'won' || b.status === 'lost') {
      resolvedMap[b.user_id] = resolvedMap[b.user_id] || { spent: 0, won: 0 };
      resolvedMap[b.user_id].spent += b.amount;
      if (b.status === 'won') resolvedMap[b.user_id].won += (b.payout || 0);
    }
  }

  const withBalance = (map) => (profiles || []).map(p => ({
    ...p,
    balance: (map[p.id]?.won || 0) - (map[p.id]?.spent || 0),
  }));

  const resolvedProfiles = withBalance(resolvedMap);
  const ledgerProfiles = withBalance(ledgerMap);

  return NextResponse.json({
    // Back-compat: top-level fields = resolved-only
    transactions: computeSettlement(resolvedProfiles),
    positions:    computeNetPositions(resolvedProfiles),
    resolved: {
      transactions: computeSettlement(resolvedProfiles),
      positions:    computeNetPositions(resolvedProfiles),
    },
    withPending: {
      transactions: computeSettlement(ledgerProfiles),
      positions:    computeNetPositions(ledgerProfiles),
    },
  });
}
