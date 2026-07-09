'use client';

import { useState } from 'react';
import { getTeam, fmtKnockoutStage } from '@/lib/data';
import { getStreams } from '@/lib/streams';

// Collapsible live-stream panel. Display-only — no money/betting.
// Iframe only mounted when expanded so offscreen streams don't autoplay/eat data.
export default function LiveStreamPanel({ match }) {
  const [open, setOpen] = useState(true);
  const [sourceIdx, setSourceIdx] = useState(0);

  const streams = getStreams(match?.id);
  if (!streams.length) return null;

  const homeName = match.home ? getTeam(match.home).name : 'Home';
  const awayName = match.away ? getTeam(match.away).name : 'Away';
  const stageTag = fmtKnockoutStage(match.id);
  const active = streams[Math.min(sourceIdx, streams.length - 1)];

  return (
    <div
      style={{
        margin: '0 16px 12px',
        borderRadius: 14,
        border: '1px solid rgba(255,59,59,0.22)',
        background:
          'linear-gradient(180deg, rgba(255,59,59,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.02) 100%)',
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
          padding: '11px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ink)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ff3b3b',
            boxShadow: '0 0 0 3px rgba(255,59,59,0.18)',
            animation: 'pulseDot 1.4s infinite',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#ff3b3b',
            padding: '2px 6px',
            border: '1px solid rgba(255,59,59,0.35)',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}
        >
          Live
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          <span style={{ marginRight: 6 }}>📺</span>
          {stageTag ? <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{stageTag} · </span> : null}
          {homeName} vs {awayName}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--ink-2)',
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {open ? 'Hide ▲' : 'Watch ▼'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 10px 12px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#000',
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
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
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                Source
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  paddingBottom: 2,
                }}
              >
                {streams.map((s, i) => {
                  const activeSel = i === sourceIdx;
                  return (
                    <button
                      key={s.url}
                      onClick={() => setSourceIdx(i)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        transition: 'all 120ms ease',
                        background: activeSel
                          ? 'rgba(255,59,59,0.14)'
                          : 'rgba(255,255,255,0.04)',
                        color: activeSel ? '#ff6b6b' : 'var(--ink-2)',
                        border: activeSel
                          ? '1px solid rgba(255,59,59,0.4)'
                          : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              fontSize: 10,
              color: 'var(--ink-3)',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11 }}>⚠️</span>
            <span>Unofficial third-party stream — may show ads or buffer. Switch sources if it dies.</span>
          </div>
        </div>
      )}
    </div>
  );
}
