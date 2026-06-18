import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { verifyUser } from '@/lib/auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!supabase) {
    return NextResponse.json([]);
  }

  let query = supabase
    .from('settlements')
    .select('*, from_profile:profiles!from_user(username, display_name), to_profile:profiles!to_user(username, display_name)')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.or(`from_user.eq.${userId},to_user.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { fromUser, toUser, amount, note } = await request.json();

    const { error: authError } = await verifyUser(fromUser);
    if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!fromUser || !toUser || !amount) {
      return NextResponse.json({ error: 'Missing fromUser, toUser, or amount' }, { status: 400 });
    }
    if (fromUser === toUser) {
      return NextResponse.json({ error: 'Cannot settle with yourself' }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('settlements')
      .insert({ from_user: fromUser, to_user: toUser, amount, note })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
