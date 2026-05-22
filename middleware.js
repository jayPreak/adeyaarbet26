import { NextResponse } from 'next/server';

export function middleware(request) {
  // When Supabase is not configured, pass through all requests
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.next();
  }

  // With Supabase configured, refresh session cookie on each request
  // This is a lightweight pass-through; full @supabase/ssr middleware
  // can be added later for token refresh
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
