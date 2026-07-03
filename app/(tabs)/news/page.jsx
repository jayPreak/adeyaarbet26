'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTeam } from '@/lib/data';

function timeAgo(iso) {
  if (!iso) return '';
  const normalized = iso.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \+/, '$1T$2+');
  const diff = Date.now() - new Date(normalized).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Event type styling ──────────────────────────────────────────────────────
const EVENT_STYLE = {
  0: { icon: '⚽', color: 'var(--win)', bg: 'rgba(74,222,128,0.1)' },      // Goal
  2: { icon: '🟡', color: '#f5c542', bg: 'rgba(245,197,66,0.08)' },        // Yellow card
  3: { icon: '🟥', color: 'var(--loss)', bg: 'rgba(248,113,113,0.1)' },    // Red card
  4: { icon: '🟡🟡', color: 'var(--loss)', bg: 'rgba(248,113,113,0.08)' }, // Second yellow
  7: { icon: '⏱', color: 'var(--ink-2)', bg: 'rgba(255,255,255,0.04)' },   // Period start/end
  8: { icon: '⏱', color: 'var(--ink-2)', bg: 'rgba(255,255,255,0.04)' },   // Period end
  12: { icon: '🎯', color: 'var(--ink-2)', bg: 'rgba(255,255,255,0.04)' }, // Attempt
  13: { icon: '🔄', color: 'var(--ink-2)', bg: 'rgba(255,255,255,0.04)' }, // Substitution
  15: { icon: '🚩', color: 'var(--ink-3)', bg: 'rgba(255,255,255,0.03)' }, // Offside
  18: { icon: '⚠️', color: 'var(--ink-3)', bg: 'rgba(255,255,255,0.03)' },  // Foul
  26: { icon: '📺', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },      // VAR
  57: { icon: '🧤', color: 'var(--ink-2)', bg: 'rgba(255,255,255,0.04)' }, // Save
  79: { icon: '🪙', color: 'var(--ink-3)', bg: 'rgba(255,255,255,0.03)' }, // Coin toss
};

function getEventStyle(type) {
  return EVENT_STYLE[type] || { icon: '•', color: 'var(--ink-3)', bg: 'rgba(255,255,255,0.03)' };
}

// ─── Live Timeline Tab ───────────────────────────────────────────────────────
function LiveTimeline() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/fifa/timeline')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s if match is live
  useEffect(() => {
    if (!data?.match || data.match.status !== 'live') return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [data?.match?.status, load]);

  if (loading && !data) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading timeline…</div>
      </div>
    );
  }

  if (!data?.match) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>No match data available</div>
      </div>
    );
  }

  const { match, events } = data;
  const homeTeam = getTeam(match.home);
  const awayTeam = getTeam(match.away);
  const isLive = match.status === 'live';

  return (
    <div>
      {/* Match header */}
      <div style={{
        margin: '0 16px 12px', padding: '16px', borderRadius: 14,
        background: isLive ? 'rgba(255,59,59,0.06)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLive ? 'rgba(255,59,59,0.2)' : 'rgba(255,255,255,0.08)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{homeTeam?.flag || '🏳️'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{homeTeam?.name || match.homeName}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
              {match.homeScore ?? 0} – {match.awayScore ?? 0}
            </div>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3b3b', animation: 'pulseDot 1.4s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ff3b3b' }}>
                  {match.minute || 'LIVE'}
                </span>
              </div>
            )}
            {!isLive && (
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 4 }}>FT</div>
            )}
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{awayTeam?.flag || '🏳️'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{awayTeam?.name || match.awayName}</div>
          </div>
        </div>
      </div>

      {/* Refresh button for live */}
      {isLive && (
        <div style={{ padding: '0 16px 8px', textAlign: 'center' }}>
          <button
            onClick={load}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600,
              color: 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>Auto-refreshes every 30s</div>
        </div>
      )}

      {/* Events list */}
      {events.length === 0 ? (
        <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
          No events yet
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {events.map(e => {
            const style = getEventStyle(e.type);
            const isGoal = e.type === 0;
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex', gap: 10, padding: '10px 12px', marginBottom: 6,
                  borderRadius: 10, background: style.bg,
                  border: isGoal ? '1px solid rgba(74,222,128,0.2)' : '1px solid transparent',
                }}
              >
                <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                    {e.minute}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{style.icon}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: style.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {e.typeLabel}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>
                    {e.description}
                  </div>
                  {isGoal && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                      {match.home} {e.homeGoals} – {e.awayGoals} {match.away}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── News Tab ────────────────────────────────────────────────────────────────
function NewsCard({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: 12, padding: '14px 16px',
        borderBottom: '1px solid var(--line)', textDecoration: 'none',
        background: 'transparent', color: 'inherit',
      }}
    >
      {article.image && (
        <div style={{
          width: 80, height: 60, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
          background: 'var(--surface-2)',
        }}>
          <img
            src={article.image}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ink)',
          lineHeight: 1.35, marginBottom: 5,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {article.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {article.author && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {article.author}
            </span>
          )}
          {article.author && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>·</span>}
          <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
            {timeAgo(article.published)}
          </span>
        </div>
      </div>
    </a>
  );
}

function NewsList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (data.error && !data.articles?.length) {
        setError(data.error);
      } else {
        setArticles(data.articles || []);
        setLastFetched(data.fetchedAt || new Date().toISOString());
      }
    } catch (e) {
      setError('Could not load news');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
        {lastFetched && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Updated {timeAgo(lastFetched)}</div>
        )}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {refreshing ? '…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading news…</div>
        </div>
      ) : error ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--loss)', marginBottom: 12 }}>{error}</div>
          <button
            onClick={() => load()}
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '8px 16px', fontSize: 12,
              fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
          No news available right now
        </div>
      ) : (
        <div>
          {articles.map(a => <NewsCard key={a.id} article={a} />)}
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
            Refreshes every 90 min · Currents API
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page with Tabs ─────────────────────────────────────────────────────
export default function NewsPage() {
  const [tab, setTab] = useState('live');

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, padding: '12px 16px 0',
        borderBottom: '1px solid var(--line)',
      }}>
        {[
          { id: 'live', label: 'Match Live' },
          { id: 'news', label: 'News' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              background: 'none', fontSize: 13, fontWeight: 700,
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.id === 'live' && <span style={{ marginRight: 4 }}>⚡</span>}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'live' && <LiveTimeline />}
      {tab === 'news' && <NewsList />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
