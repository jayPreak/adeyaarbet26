'use client';

import { useState } from 'react';
import { getTeam } from '@/lib/data';
import { getStreams } from '@/lib/streams';

// Collapsible live-stream panel. Display-only — no money/betting.
// Iframe is mounted only when expanded so offscreen streams don't autoplay/eat data.
export default function LiveStreamPanel({ match }) {
  const [open, setOpen] = useState(false);
  const [sourceIdx, setSourceIdx] = useState(0);

  const streams = getStreams(match?.id);
  if (!streams.length) return null;

  const homeName = match.home ? getTeam(match.home).name : 'Home';
  const awayName = match.away ? getTeam(match.away).name : 'Away';
  const active = streams[Math.min(sourceIdx, streams.length - 1)];

  return (
    <div
      style={{
        margin: '0 16px 10px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>📺</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
          Watch {homeName} vs {awayName} — live
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {open ? 'Hide ▲' : 'Watch ▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#000',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <iframe
              key={active.url}
              title={`${homeName} vs ${awayName} Player`}
              src={active.url}
              loading="lazy"
              allow="encrypted-media; picture-in-picture;"
              allowFullScreen
              scrolling="no"
              frameBorder="0"
              marginHeight="0"
              marginWidth="0"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
            />
          </div>

          {streams.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
                flexWrap: 'wrap',
              }}
            >
              {streams.map((s, i) => (
                <button
                  key={s.url}
                  onClick={() => setSourceIdx(i)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    background: i === sourceIdx ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
                    color: i === sourceIdx ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.4 }}>
            Third-party stream. If it buffers or dies, switch source. Streams may show ads.
          </div>
        </div>
      )}
    </div>
  );
}
