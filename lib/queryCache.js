/**
 * In-flight promise + short-TTL cache for direct-Supabase queries.
 * Multiple callers hitting the same key within the TTL window share one fetch.
 *
 * Why: HAR showed the same profiles/bets queries firing 5-8 times per page
 * load because each caller (init effect, LeaderboardContext, SettlementCard,
 * SettlementPlan, AchievementBadges …) triggered its own copy.
 */

const cache = new Map(); // key → { at: ms, data }
const inflight = new Map(); // key → Promise

const DEFAULT_TTL_MS = 5000; // 5s — fresh enough for a betting app; long enough to dedupe a whole page's initial burst

export function invalidate(prefix) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
  for (const k of inflight.keys()) if (k.startsWith(prefix)) inflight.delete(k);
}

export function invalidateAll() {
  cache.clear();
  inflight.clear();
}

// Fetch data by key; if a fresh cached copy exists, return it. If an identical
// request is already inflight, share its promise. Otherwise call `fn()`.
export async function dedupedFetch(key, fn, ttlMs = DEFAULT_TTL_MS) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.at) < ttlMs) return cached.data;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await fn();
      cache.set(key, { at: now, data });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
