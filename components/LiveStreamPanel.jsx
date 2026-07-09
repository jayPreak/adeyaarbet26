'use client';

import { useEffect, useState } from 'react';
import { getTeam, fmtKnockoutStage } from '@/lib/data';
import { getStreams, getChatChannel } from '@/lib/streams';
import LiveChatPanel from '@/components/LiveChatPanel';

// Collapsible live-stream panel. Display-only — no money/betting.
// Iframe only mounted when expanded so offscreen streams don't autoplay/eat data.
// Desktop-only "Theater" mode opens a full-screen modal with stream + chat side-by-side.
export default function LiveStreamPanel({ match, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [theater, setTheater] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Prevent body scroll while theater modal is open
  useEffect(() => {
    if (!theater) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setTheater(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [theater]);

  const streams = getStreams(match?.id);
  if (!streams.length) return null;

  const homeName = match.home ? getTeam(match.home).name : 'Home';
  const awayName = match.away ? getTeam(match.away).name : 'Away';
  const stageTag = fmtKnockoutStage(match.id);
  const active = streams[Math.min(sourceIdx, streams.length - 1)];
  const chatChannel = getChatChannel(match.id);

  return (
    <>
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
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px', background: 'transparent', border: 'none',
            color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#ff3b3b',
            boxShadow: '0 0 0 3px rgba(255,59,59,0.18)',
            animation: 'pulseDot 1.4s infinite', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            color: '#ff3b3b', padding: '2px 6px',
            border: '1px solid rgba(255,59,59,0.35)', borderRadius: 4,
            textTransform: 'uppercase',
          }}>Live</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <span style={{ marginRight: 6 }}>📺</span>
            {stageTag ? <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{stageTag} · </span> : null}
            {homeName} vs {awayName}
          </span>
          {isDesktop && open && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setTheater(true); }}
              style={{
                fontSize: 11, fontWeight: 700, color: '#4da8ff',
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(77,168,255,0.10)',
                border: '1px solid rgba(77,168,255,0.35)',
                cursor: 'pointer',
              }}
            >
              🖥 Theater
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--ink-2)',
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {open ? 'Hide ▲' : 'Watch ▼'}
          </span>
        </button>

        {open && (
          <div style={{ padding: '0 10px 12px' }}>
            <div style={{
              position: 'relative', width: '100%', aspectRatio: '16 / 9',
              background: '#000', borderRadius: 10, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            }}>
              {theater ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'grid', placeItems: 'center',
                  color: 'var(--ink-3)', fontSize: 12,
                }}>
                  🖥 Playing in Theater view
                </div>
              ) : (
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
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                />
              )}
            </div>

            {streams.length > 1 && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>Source</div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {streams.map((s, i) => {
                    const activeSel = i === sourceIdx;
                    return (
                      <button
                        key={s.url}
                        onClick={() => setSourceIdx(i)}
                        style={{
                          padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          transition: 'all 120ms ease',
                          background: activeSel ? 'rgba(255,59,59,0.14)' : 'rgba(255,255,255,0.04)',
                          color: activeSel ? '#ff6b6b' : 'var(--ink-2)',
                          border: activeSel ? '1px solid rgba(255,59,59,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{
              marginTop: 10, fontSize: 10, color: 'var(--ink-3)',
              lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 11 }}>⚠️</span>
              <span>Unofficial third-party stream — may show ads or buffer. Switch sources if it dies.</span>
            </div>

            {chatChannel && (
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px dashed rgba(255,255,255,0.08)',
              }}>
                <LiveChatPanel channel={chatChannel} embedded />
              </div>
            )}
          </div>
        )}
      </div>

      {theater && (
        <TheaterModal
          streamUrl={active.url}
          homeName={homeName}
          awayName={awayName}
          stageTag={stageTag}
          streams={streams}
          sourceIdx={sourceIdx}
          setSourceIdx={setSourceIdx}
          chatChannel={chatChannel}
          onClose={() => setTheater(false)}
        />
      )}
    </>
  );
}

function TheaterModal({ streamUrl, homeName, awayName, stageTag, streams, sourceIdx, setSourceIdx, chatChannel, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(1600px, 96vw)', height: 'min(900px, 92vh)',
          borderRadius: 16, overflow: 'hidden',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,59,59,0.04)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#ff3b3b',
            boxShadow: '0 0 0 3px rgba(255,59,59,0.18)',
            animation: 'pulseDot 1.4s infinite',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            color: '#ff3b3b', padding: '2px 6px',
            border: '1px solid rgba(255,59,59,0.35)', borderRadius: 4,
          }}>LIVE</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>
            {stageTag ? <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{stageTag} · </span> : null}
            {homeName} vs {awayName} <span style={{ color: 'var(--ink-3)', fontWeight: 600, marginLeft: 8 }}>· Theater view</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close theater"
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--ink)', fontSize: 16, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body: stream (left) + chat (right) */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          minHeight: 0,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column',
            minHeight: 0, borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              flex: 1, position: 'relative', background: '#000', minHeight: 0,
            }}>
              <iframe
                key={streamUrl}
                title={`${homeName} vs ${awayName} Player (Theater)`}
                src={streamUrl}
                allow="encrypted-media; picture-in-picture;"
                allowFullScreen
                scrolling="no"
                frameBorder="0"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
            {streams.length > 1 && (
              <div style={{
                display: 'flex', gap: 6, padding: '10px 14px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                overflowX: 'auto',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--ink-3)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  alignSelf: 'center', marginRight: 4,
                }}>Source</span>
                {streams.map((s, i) => {
                  const activeSel = i === sourceIdx;
                  return (
                    <button
                      key={s.url}
                      onClick={() => setSourceIdx(i)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                        background: activeSel ? 'rgba(255,59,59,0.14)' : 'rgba(255,255,255,0.04)',
                        color: activeSel ? '#ff6b6b' : 'var(--ink-2)',
                        border: activeSel ? '1px solid rgba(255,59,59,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column',
            padding: 12, minHeight: 0, overflow: 'hidden',
          }}>
            {chatChannel ? (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <LiveChatPanel channel={chatChannel} embedded fillHeight />
              </div>
            ) : (
              <div style={{
                display: 'grid', placeItems: 'center', height: '100%',
                fontSize: 12, color: 'var(--ink-3)',
              }}>
                No chat available for this match.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
