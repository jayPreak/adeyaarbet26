import { NextResponse } from 'next/server';
import { buildMarketOddsMap } from '@/lib/market-odds';

// Real-world MARKET odds from The Odds API (what the betting world thinks).
// Gated behind ODDS_API_KEY — until that env var is set, this returns an empty
// map and the UI simply shows pool odds only. No key, no behavior change.
//
// Safe-fetch per CLAUDE.md: NEVER hang the app. We use a hard AbortController
// timeout and Next's revalidate cache so we hit the upstream at most ~once/10min.
const ODDS_URL = 'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds';
const FETCH_TIMEOUT_MS = 6000;
const REVALIDATE_S = 600; // cache 10 min — squad-change moves show up fine, quota stays tiny

export async function GET() {
  const key = process.env.ODDS_API_KEY;
  if (!key) return NextResponse.json({ map: {}, enabled: false });

  const url = `${ODDS_URL}?regions=uk,eu&markets=h2h&oddsFormat=decimal&apiKey=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: REVALIDATE_S } });
    if (!res.ok) return NextResponse.json({ map: {}, enabled: true, error: `upstream ${res.status}` });
    const events = await res.json();
    return NextResponse.json({ map: buildMarketOddsMap(events), enabled: true });
  } catch (e) {
    // Timeout or network error — fail soft, UI falls back to pool odds.
    return NextResponse.json({ map: {}, enabled: true, error: e.name === 'AbortError' ? 'timeout' : 'fetch_failed' });
  } finally {
    clearTimeout(timer);
  }
}
