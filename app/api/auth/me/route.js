import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FALLBACK_USER = {
  id: 'rahul',
  username: 'rahul',
  display_name: 'Rahul',
  balance: 5000,
};

export async function GET(request) {
  // If Supabase is not configured, return fallback
  if (!url || !key) {
    return NextResponse.json(FALLBACK_USER);
  }

  const supabase = createClient(url, key, {
    global: {
      headers: {
        // Forward the auth cookie/header from the request
        cookie: request.headers.get('cookie') || '',
      },
    },
  });

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const meta = session.user.user_metadata || {};
    return NextResponse.json({
      id: session.user.id,
      username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
      display_name: meta.full_name || meta.name || 'Player',
      balance: 5000,
      email: session.user.email,
      avatar_url: meta.avatar_url,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
