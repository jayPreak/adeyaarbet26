import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMarketOddsMap } from '@/lib/market-odds';

// Real-world MARKET odds (what the betting world thinks) — distinct from our
// parimutuel pool odds. Source is now a static file scraped from a real book
// (see scripts/scrape-stake-odds.mjs) instead of a live keyed API, because The
// Odds API key never issued. The scraper writes public/market-odds.json with
// events in The-Odds-API shape; we map them to our static fixture IDs (A1..L6)
// here via the existing buildMarketOddsMap(). Non-World-Cup fixtures don't map
// and are dropped.
//
// No file / empty file -> { map: {}, enabled: false }, and the UI simply shows
// pool odds only. Same response shape as before, so the frontend is unchanged.
const DATA_PATH = path.join(process.cwd(), 'public', 'market-odds.json');

export async function GET() {
  try {
    const parsed = JSON.parse(await readFile(DATA_PATH, 'utf8'));
    const events = Array.isArray(parsed.events) ? parsed.events : [];
    const map = buildMarketOddsMap(events);
    return NextResponse.json({
      map,
      enabled: Object.keys(map).length > 0,
      updatedAt: parsed.updatedAt || null,
    });
  } catch {
    // File missing/unreadable/malformed — fail soft, UI falls back to pool odds.
    return NextResponse.json({ map: {}, enabled: false });
  }
}
