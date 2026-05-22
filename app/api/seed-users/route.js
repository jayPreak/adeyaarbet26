import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { FRIENDS } from '@/lib/data';

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const users = FRIENDS.map(f => ({
    username: f.id,
    password: `${f.id}2026`,
  }));

  const { error } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'username' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    seeded: users.map(u => ({ username: u.username, password: u.password })),
  });
}
