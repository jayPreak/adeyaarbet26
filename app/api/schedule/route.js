import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';
import { cupWinnerDeadlineFromKickoffs } from '@/lib/cup-winner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/schedule -> { schedule: { "A1": "<iso>", ... }, cupWinnerDeadlineTs: <ms|null> }
// Schedule data is seeded by /api/schedule-sync (POST). This route just reads.
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null });
  }

  const db = supabaseAdmin || supabase;
  const { data, error } = await db.from('match_schedule').select('id, kickoff_ts');
  if (error) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null }, { status: 500 });
  }
  const schedule = {};
  for (const row of data) {
    if (!/^\d+$/.test(row.id)) schedule[row.id] = row.kickoff_ts;
  }
  const cupWinnerDeadlineTs = cupWinnerDeadlineFromKickoffs(data.filter(r => !/^\d+$/.test(r.id)));
  return NextResponse.json({ schedule, cupWinnerDeadlineTs });
}
