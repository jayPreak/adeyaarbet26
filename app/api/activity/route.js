import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request) {
  
  if (!supabase) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const { data, error } = await supabase
    .from('activity')
    .select('*, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
