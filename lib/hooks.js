'use client';

import { useState, useEffect, useRef } from 'react';
import supabaseBrowser from '@/lib/supabase-browser';
import { STARTING_BALANCE } from '@/lib/currency';

const FALLBACK_USER = Object.freeze({
  id: 'rahul',
  username: 'rahul',
  display_name: 'Rahul',
  balance: STARTING_BALANCE,
});

/**
 * Returns the current authenticated user or a fallback.
 * Never throws — gracefully degrades when Supabase is unconfigured.
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function resolve() {
      if (!supabaseBrowser) {
        // Supabase not configured — use fallback
        if (mounted.current) {
          setUser(FALLBACK_USER);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.user) {
          if (mounted.current) {
            setUser(FALLBACK_USER);
            setLoading(false);
          }
          return;
        }

        const meta = session.user.user_metadata || {};
        if (mounted.current) {
          setUser({
            id: session.user.id,
            username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
            display_name: meta.full_name || meta.name || 'Player',
            balance: STARTING_BALANCE,
            email: session.user.email,
            avatar_url: meta.avatar_url,
          });
          setLoading(false);
        }
      } catch {
        // Network error or Supabase down — fallback
        if (mounted.current) {
          setUser(FALLBACK_USER);
          setLoading(false);
        }
      }
    }

    resolve();

    // Listen for auth changes
    let subscription;
    if (supabaseBrowser) {
      const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          setUser(FALLBACK_USER);
        } else {
          const meta = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
            display_name: meta.full_name || meta.name || 'Player',
            balance: STARTING_BALANCE,
            email: session.user.email,
            avatar_url: meta.avatar_url,
          });
        }
      });
      subscription = data.subscription;
    }

    return () => {
      mounted.current = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { user: user || FALLBACK_USER, loading };
}
