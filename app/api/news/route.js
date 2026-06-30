import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_KEY = 'wc26_news';
const CACHE_TTL_MS = 90 * 60 * 1000; // 90 minutes — refreshes lazily on first request after cache expires
const CURRENTS_BASE = 'https://api.currentsapi.services/v1';

export async function GET() {
  const db = supabaseAdmin || supabase;

  // Check Supabase cache
  if (db) {
    const { data: cached } = await db
      .from('news_cache')
      .select('data, fetched_at')
      .eq('id', CACHE_KEY)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < CACHE_TTL_MS) {
        return NextResponse.json({ ...cached.data, cached: true });
      }
    }
  }

  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'News API not configured', articles: [] }, { status: 503 });
  }

  // Fetch fresh from Currents API — keyword + sports category
  let raw;
  try {
    const url = `${CURRENTS_BASE}/search?keywords=FIFA%20World%20Cup%202026%20football&language=en&category=sports`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      // Return stale cache if available rather than hard error
      if (db) {
        const { data: stale } = await db.from('news_cache').select('data').eq('id', CACHE_KEY).maybeSingle();
        if (stale) return NextResponse.json({ ...stale.data, stale: true });
      }
      return NextResponse.json({ error: `Currents API ${res.status}`, articles: [] }, { status: 502 });
    }
    raw = await res.json();
  } catch (e) {
    if (db) {
      const { data: stale } = await db.from('news_cache').select('data').eq('id', CACHE_KEY).maybeSingle();
      if (stale) return NextResponse.json({ ...stale.data, stale: true });
    }
    return NextResponse.json({ error: e.message, articles: [] }, { status: 502 });
  }

  const articles = (raw.news || []).map(a => ({
    id: a.id,
    title: a.title,
    description: a.description || null,
    url: a.url,
    author: a.author || null,
    image: a.image && a.image !== 'None' ? a.image : null,
    published: a.published ? a.published.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \+/, '$1T$2+') : null,
    category: Array.isArray(a.category) ? a.category : [],
  }));

  const payload = { articles, fetchedAt: new Date().toISOString() };

  // Persist to cache
  if (db) {
    await db.from('news_cache').upsert({
      id: CACHE_KEY,
      data: payload,
      fetched_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(payload);
}
