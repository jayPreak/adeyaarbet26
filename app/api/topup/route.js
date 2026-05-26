import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId, amount } = await request.json();

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!amount || amount <= 0 || amount > 50000) {
      return NextResponse.json({ error: 'Amount must be between 1 and 50,000' }, { status: 400 });
    }

    // Topup = won bet with 0 stake, payout = amount. Match_id = '_topup' (excluded from settlement)
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
