'use client';

import { useState, useEffect, useCallback } from 'react';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

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

export default function NewsPage() {
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
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Latest News</div>
          {lastFetched && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              Updated {timeAgo(lastFetched)}
            </div>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            borderRadius: 8, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
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
            News refreshes every 15 minutes · Powered by Currents API
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
