import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { verifyUser } from '@/lib/auth';

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId, username, displayName, avatarUrl } = await request.json();

    const { error: authError } = await verifyUser(userId);
    if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const updates = {};
    if (username !== undefined) {
      const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
      if (clean.length > 20) return NextResponse.json({ error: 'Username must be 20 characters or less' }, { status: 400 });
      updates.username = clean;
    }
    if (displayName !== undefined) {
      if (displayName.trim().length < 1) return NextResponse.json({ error: 'Display name required' }, { status: 400 });
      updates.display_name = displayName.trim();
    }
    if (avatarUrl !== undefined) {
      updates.avatar_url = avatarUrl;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
