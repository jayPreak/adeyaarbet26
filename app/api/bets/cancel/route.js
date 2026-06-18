import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { verifyUser } from '@/lib/auth';

export async function POST(request) {

  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId, matchId } = await request.json();

    if (!userId || !matchId) {
      return NextResponse.json({ error: 'Missing userId or matchId' }, { status: 400 });
    }

    const { error: authError } = await verifyUser(userId);
    if (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Block cancellation if match has already started (kickoff - 30s has passed)
    const { data: schedule } = await supabase
      .from('match_schedule')
      .select('kickoff_ts')
      .eq('id', matchId)
      .single();

    if (schedule?.kickoff_ts) {
      const kickoff = new Date(schedule.kickoff_ts).getTime();
      if (Date.now() >= kickoff - 30000) {
        return NextResponse.json(
          { error: 'Cannot cancel — match has already started' },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabase.rpc('cancel_bets', {
      p_user_id: userId,
      p_match_id: matchId,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('No pending bets')) {
        return NextResponse.json({ error: 'No pending bets to cancel' }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
