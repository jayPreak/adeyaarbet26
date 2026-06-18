import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Verify that the authenticated user matches the claimed userId.
 * Returns { user, error } — if error is set, the route should return 401.
 */
export async function verifyUser(claimedUserId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { user: null, error: 'Auth not configured' };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Not authenticated' };
  }

  if (user.id !== claimedUserId) {
    return { user: null, error: 'User mismatch' };
  }

  return { user, error: null };
}
