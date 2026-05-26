'use client';

import { useState, useEffect, useRef } from 'react';
import supabaseBrowser from '@/lib/supabase-browser';

function getUserFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('adeyaar_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Returns the current authenticated user.
 * - Supabase configured: uses session auth
 * - No Supabase: uses localStorage (local dev friend picker)
 * Returns { user: object|null, loading: boolean }
 */
export function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function resolve() {
      // No Supabase configured — use localStorage (local dev mode)
      if (!supabaseBrowser) {
        const stored = getUserFromStorage();
        if (mounted.current) {
          setUser(stored);
          setLoading(false);
        }
        return;
      }

      // Supabase configured — use session + profile from DB
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.user) {
          if (mounted.current) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const meta = session.user.user_metadata || {};
        const authUser = {
          id: session.user.id,
          username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
          display_name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Player',
          balance: 0,
          email: session.user.email,
          avatar_url: meta.avatar_url,
        };

        // Fetch actual profile from DB (has latest display_name, username, avatar)
        const { data: profile } = await supabaseBrowser
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        if (mounted.current) {
          setUser(profile ? { ...authUser, ...profile } : authUser);
          setLoading(false);
        }
      } catch {
        if (mounted.current) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    resolve();

    // Listen for auth changes (re-login, token refresh)
    let subscription;
    if (supabaseBrowser) {
      const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          setUser(null);
        } else {
          // On auth change, re-fetch profile from DB
          const meta = session.user.user_metadata || {};
          const authUser = {
            id: session.user.id,
            username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
            display_name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Player',
            balance: 0,
            email: session.user.email,
            avatar_url: meta.avatar_url,
          };
          supabaseBrowser
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profile }) => {
              if (mounted.current) setUser(profile ? { ...authUser, ...profile } : authUser);
            })
            .catch(() => {
              if (mounted.current) setUser(authUser);
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

  const refreshUser = () => {
    if (!supabaseBrowser) return;
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const meta = session.user.user_metadata || {};
      const authUser = {
        id: session.user.id,
        username: meta.username || meta.preferred_username || session.user.email?.split('@')[0] || 'user',
        display_name: meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Player',
        balance: 0,
        email: session.user.email,
        avatar_url: meta.avatar_url,
      };
      supabaseBrowser
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile }) => {
          setUser(profile ? { ...authUser, ...profile } : authUser);
        });
    });
  };

  return { user, loading, refreshUser };
}
