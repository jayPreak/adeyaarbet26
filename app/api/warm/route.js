import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (supabase) await supabase.from('match_schedule').select('id').limit(1);
  return NextResponse.json({ ok: true });
}
