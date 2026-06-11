import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { cupWinnerDeadlineFromKickoffs } from '@/lib/cup-winner';

export const revalidate = 300; // seconds — display only; enforcement is server-side

// GET /api/schedule -> { schedule: { "A1": "<iso>", ... }, cupWinnerDeadlineTs: <ms|null> }
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null });
  }
  const { data, error } = await supabase.from('match_schedule').select('id, kickoff_ts');
  if (error) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null }, { status: 500 });
  }
  const schedule = {};
  for (const row of data) {
    schedule[row.id] = row.kickoff_ts;
  }
  const cupWinnerDeadlineTs = cupWinnerDeadlineFromKickoffs(data);
  return NextResponse.json({ schedule, cupWinnerDeadlineTs });
}
