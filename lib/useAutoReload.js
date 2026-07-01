'use client';

import { useEffect, useRef } from 'react';

export function useAutoReload() {
  const initialVersion = useRef(null);
  const checking = useRef(false);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data.v || null;
      } catch {
        return null;
      }
    }

    // Capture initial version on mount
    fetchVersion().then(v => { if (v) initialVersion.current = v; });

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (checking.current) return;
      if (!initialVersion.current) return;

      checking.current = true;
      fetchVersion().then(v => {
        checking.current = false;
        if (!v) return; // API failed — do nothing
        if (v !== initialVersion.current) {
          window.location.reload();
        }
      });
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
}
