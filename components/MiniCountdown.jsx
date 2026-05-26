'use client';

import { useState, useEffect } from 'react';
import { KICKOFF_TS, pad, computeTimeLeft } from '@/lib/countdown';

export default function MiniCountdown({ variant = 'mobile' }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, mins, secs, done } = computeTimeLeft(KICKOFF_TS);

  if (done) return null;

  if (variant === 'desktop') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: 'rgba(0,255,133,0.06)',
        border: '1px solid rgba(0,255,133,0.18)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600,
        color: 'var(--ink-2)',
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11 }}>⚽</span>
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{days}d</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{pad(hours)}h</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{pad(mins)}m</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ color: 'var(--gold)' }}>{pad(secs)}s</span>
      </div>
    );
  }

  // mobile variant — compact strip
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '5px 20px',
      borderBottom: '1px solid var(--line)',
      background: 'rgba(0,255,133,0.03)',
      fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600,
      color: 'var(--ink-3)', letterSpacing: '0.03em',
    }}>
      <span style={{ fontSize: 10 }}>⚽</span>
      <span>
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{days}d</span>
        {' '}<span>{pad(hours)}h</span>
        {' '}<span>{pad(mins)}m</span>
        {' '}<span style={{ color: 'var(--gold)' }}>{pad(secs)}s</span>
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>to kickoff</span>
    </div>
  );
}
