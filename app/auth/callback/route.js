import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !code) {
    return NextResponse.redirect(new URL(next, origin));
  }

  const supabase = createClient(url, key);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Redirect to login with error
    return NextResponse.redirect(new URL('/login?error=auth', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
