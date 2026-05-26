import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// POST /api/admin/topup { userId, amount, secret }
// Adds funds by inserting a won "topup" bet (ledger-compatible).
// Protected by ADMIN_SECRET env var.
export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId, amount, secret } = await request.json();
    const adminSecret = process.env.ADMIN_SECRET || 'adeyaar-topup-2026';

    if (secret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'userId and positive amount required' }, { status: 400 });
    }

    // Insert a "topup" bet that's already won with payout = amount
    // This adds to the ledger: net += payout (amount) - amount (amount) = 0...
    // Actually we need: net += payout. So status=won, amount=0, payout=amount.
    const { data, error } = await supabase
      .from('bets')
      .insert({
        user_id: userId,
        match_id: '_topup',
        pick: 'home',
        amount: 0,
        status: 'won',
        payout: amount,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, added: amount, bet_id: data.id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
