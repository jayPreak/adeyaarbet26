import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { getScheduleFromFifa } from '@/lib/schedule-sync';

// POST /api/sync-schedule { secret }
// Pulls kickoff times from the FIFA API and upserts match_schedule.
// Run manually; re-run when the real schedule changes.
export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const adminSecret = process.env.ADMIN_SECRET || 'adeyaar-topup-2026';
  if (body.secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { schedule, unmatched, error } = await getScheduleFromFifa();
  if (error || schedule.length === 0) {
    return NextResponse.json(
      { error: error || 'No matches returned; nothing written', unmatched },
      { status: 502 }
    );
  }

  const { error: dbErr } = await supabaseAdmin
    .from('match_schedule')
    .upsert(schedule, { onConflict: 'id' });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ updated: schedule.length, unmatched });
}
