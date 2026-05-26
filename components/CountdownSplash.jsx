'use client';

import { useState, useEffect } from 'react';
import { KICKOFF_TS, pad, computeTimeLeft } from '@/lib/countdown';

export { KICKOFF_TS };

function useCountdown(targetTs) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return computeTimeLeft(targetTs);
}

function Cell({ value, label, accent, size }) {
  const num = size === 'desktop' ? 88 : 56;
  const cell = size === 'desktop' ? 132 : 76;
  return (
    <div style={{
      width: cell,
      padding: size === 'desktop' ? '20px 0 14px' : '14px 0 10px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,255,133,0.06), transparent 55%)',
      }} />
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: num, lineHeight: 1,
        color: accent ? 'var(--gold)' : 'var(--ink)',
        letterSpacing: '-0.04em',
        textShadow: accent ? '0 0 24px rgba(0,255,133,0.35)' : 'none',
        fontVariantNumeric: 'tabular-nums', position: 'relative',
      }}>{pad(value)}</div>
      <div style={{
        marginTop: size === 'desktop' ? 10 : 6,
        fontSize: size === 'desktop' ? 10.5 : 9.5,
        fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--ink-3)', position: 'relative',
      }}>{label}</div>
    </div>
  );
}

function Sep({ size }) {
  const d = size === 'desktop' ? 6 : 4;
  const gap = size === 'desktop' ? 12 : 7;
  return (
    <div style={{
      width: size === 'desktop' ? 14 : 8,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', gap,
    }}>
      <span style={{ width: d, height: d, borderRadius: '50%', background: 'var(--ink-3)' }} />
      <span style={{ width: d, height: d, borderRadius: '50%', background: 'var(--ink-3)' }} />
    </div>
  );
}

function CountdownRow({ size }) {
  const { days, hours, mins, secs, done } = useCountdown(KICKOFF_TS);
  if (done) {
    return (
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: size === 'desktop' ? 64 : 38,
        color: 'var(--gold)', textAlign: 'center',
        letterSpacing: '-0.02em',
        textShadow: '0 0 32px rgba(0,255,133,0.5)',
      }}>KICKOFF</div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      gap: size === 'desktop' ? 12 : 7,
    }}>
      <Cell value={days}  label="Days"  accent size={size} />
      <Sep size={size} />
      <Cell value={hours} label="Hours" size={size} />
      <Sep size={size} />
      <Cell value={mins}  label="Mins"  size={size} />
      <Sep size={size} />
      <Cell value={secs}  label="Secs"  size={size} />
    </div>
  );
}

function Wordmark({ size }) {
  const big = size === 'lg';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: big ? 10 : 6 }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: big ? 28 : 20, letterSpacing: '-0.02em', color: 'var(--ink)',
      }}>AdeYaar</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: big ? 22 : 16, color: 'var(--gold)', letterSpacing: '-0.02em',
      }}>26</span>
    </div>
  );
}

function OpenerStrip({ size }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: size === 'desktop' ? '8px 14px' : '6px 10px',
      border: '1px solid var(--line)', borderRadius: 999,
      background: 'rgba(255,255,255,0.02)',
      fontSize: size === 'desktop' ? 12 : 10.5,
      color: 'var(--ink-2)', fontFamily: 'var(--font-mono)',
      letterSpacing: '0.04em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--hot)',
        boxShadow: '0 0 0 4px rgba(255,61,127,0.18)',
        flexShrink: 0,
      }} />
      <span style={{ color: 'var(--hot)', fontWeight: 700 }}>OPENER</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>Jun 11, 2026 · 20:00 CDMX</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>🇲🇽 MEX</span>
      <span style={{ opacity: 0.4 }}>vs</span>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>TBD</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>Estadio Azteca</span>
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <video
        autoPlay muted loop playsInline preload="auto"
        src="/stadium-crowd.mp4"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 0,
          filter: 'brightness(0.5) saturate(1.2) contrast(1.05)',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(70% 60% at 50% 50%, rgba(7,8,10,0.55) 0%, rgba(7,8,10,0.82) 70%, rgba(7,8,10,0.92) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background:
          'radial-gradient(60% 50% at 50% 30%, rgba(0,255,133,0.10), transparent 60%),' +
          'radial-gradient(50% 40% at 80% 90%, rgba(255,61,127,0.10), transparent 65%),' +
          'radial-gradient(40% 40% at 15% 85%, rgba(77,168,255,0.06), transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(70% 60% at 50% 40%, #000 30%, transparent 80%)',
      }} />
    </>
  );
}

function EnterButton({ onClick, fullWidth }) {
  return (
    <button
      onClick={onClick}
      className="cd-enter-btn"
      style={{
        width: fullWidth ? '100%' : 'auto',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 15, letterSpacing: '0.02em',
        padding: fullWidth ? '15px 18px' : '14px 32px',
        borderRadius: 12,
        background: 'var(--gold)', color: '#04140A',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: '0 0 0 1px rgba(0,255,133,0.4), 0 12px 40px rgba(0,255,133,0.25)',
        cursor: 'pointer', border: 'none',
      }}
    >
      Enter the app
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7h8m-3-3l3 3-3 3" stroke="#04140A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function SplashDesktop({ onEnter }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)',
      overflow: 'hidden',
    }}>
      <Backdrop />
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 36px', borderBottom: '1px solid var(--line)',
      }}>
        <Wordmark size="lg" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: 'var(--ink-3)', letterSpacing: '0.05em',
        }}>
          <span>48 TEAMS</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>16 HOST CITIES</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>104 MATCHES</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: 'var(--gold)' }}>● POOL OPEN</span>
        </div>
      </div>

      <div style={{
        flex: 1, position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 28, padding: 40,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            FIFA World Cup 2026 · USA · Canada · Mexico
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 72, letterSpacing: '-0.035em', lineHeight: 1.0,
            textAlign: 'center', color: 'var(--ink)', margin: 0,
          }}>
            The Yaaron Cup<br />
            <span style={{ color: 'var(--gold)' }}>kicks off in</span>
          </h1>
        </div>
        <CountdownRow size="desktop" />
        <OpenerStrip size="desktop" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <EnterButton onClick={onEnter} />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
            Place bets, build brackets, settle scores with the boys.
          </div>
        </div>
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        padding: '16px 36px', borderTop: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)',
      }}>
        <span>adeyaar.app / yaaron-cup-2026</span>
        <span>Group pool · entry ₹500 · winner takes all</span>
      </div>
    </div>
  );
}

function SplashMobile({ onEnter }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 60, overflow: 'hidden',
    }}>
      <Backdrop />
      <div style={{
        position: 'relative', zIndex: 2,
        padding: '14px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Wordmark size="sm" />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--gold)', letterSpacing: '0.06em',
        }}>● POOL OPEN</span>
      </div>

      <div style={{
        position: 'relative', zIndex: 2, flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 20px 28px', gap: 22,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 9.5, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            FIFA WORLD CUP 2026
          </span>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 38, letterSpacing: '-0.03em', lineHeight: 1.05,
            textAlign: 'center', color: 'var(--ink)', margin: 0,
          }}>
            Yaaron Cup<br />
            <span style={{ color: 'var(--gold)' }}>kicks off in</span>
          </h1>
        </div>
        <CountdownRow size="mobile" />
        <OpenerStrip size="mobile" />
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        padding: '14px 20px 28px',
        borderTop: '1px solid var(--line)',
        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.4))',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <EnterButton onClick={onEnter} fullWidth />
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
          Place bets, build brackets, settle scores.
        </div>
      </div>
    </div>
  );
}

export default function CountdownSplash({ onEnter }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      data-theme="midnight"
      className="countdown-splash"
      style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
    >
      {isDesktop
        ? <SplashDesktop onEnter={onEnter} />
        : <SplashMobile onEnter={onEnter} />
      }
    </div>
  );
}
