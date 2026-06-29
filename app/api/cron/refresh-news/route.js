import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';

const CACHE_KEY = 'wc26_news';
const REFRESH_INTERVAL_MS = 1.5 * 60 * 60 * 1000; // 1.5 hours
const CURRENTS_BASE = 'https://api.currentsapi.services/v1';

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin;
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Check if we should refresh (1.5 hours since last fetch)
    const { data: cached } = await db
      .from('news_cache')
      .select('fetched_at')
      .eq('id', CACHE_KEY)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < REFRESH_INTERVAL_MS) {
        return NextResponse.json({
          status: 'skip',
          message: `Cache is ${Math.round(ageMs / 1000 / 60)} minutes old, skipping refresh`,
        });
      }
    }

    // Fetch fresh from Currents API
    const apiKey = process.env.CURRENTS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Currents API key not configured' }, { status: 503 });
    }

    const url = `${CURRENTS_BASE}/search?keywords=FIFA%20World%20Cup%202026%20football&language=en&category=sports`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Currents API returned ${res.status}` },
        { status: 502 }
      );
    }

    const raw = await res.json();
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

    // Update cache
    await db.from('news_cache').upsert({
      id: CACHE_KEY,
      data: payload,
      fetched_at: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'success',
      message: `Refreshed ${articles.length} articles`,
      count: articles.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message, status: 'failed' },
      { status: 500 }
    );
  }
}
