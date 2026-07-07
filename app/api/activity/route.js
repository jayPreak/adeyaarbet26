import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  
  if (!supabase) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const matchId = searchParams.get('match_id');

  let query = supabase
    .from('activity')
    .select('*, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (matchId) {
    query = query.contains('payload', { match_id: matchId });
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter out duel/challenge activity from per-match views
  const filtered = matchId
    ? (data || []).filter(d => !d.payload?.kind || d.payload.kind === 'match' || d.payload.kind === 'penalty')
    : data;

  return NextResponse.json(filtered);
}
