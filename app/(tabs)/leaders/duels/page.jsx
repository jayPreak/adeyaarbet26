'use client';

import { useLeaderboard } from '@/lib/LeaderboardContext';
import { fmtMoney } from '@/lib/currency';

export default function DuelsLeaderboardPage() {
  const { duelStats, user } = useLeaderboard();

  if (!duelStats.length) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        No duels settled yet
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {duelStats.map((p, i) => {
        const isMe = p.userId === user?.id;
        return (
          <div key={p.userId} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', marginBottom: 6, borderRadius: 12,
            background: isMe ? 'rgba(0,255,133,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isMe ? 'rgba(0,255,133,0.15)' : 'rgba(255,255,255,0.06)'}`,
          }}>
            {/* Rank */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: i < 3 ? 'var(--gold)' : 'var(--ink-3)',
              background: i < 3 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
            }}>
              {i + 1}
            </div>

            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: p.avatarUrl ? `url(${p.avatarUrl}) center/cover` : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--ink-3)',
            }}>
              {!p.avatarUrl && (p.displayName?.[0] || '?')}
            </div>

            {/* Name + record */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? 'var(--gold)' : 'var(--ink)' }}>
                {(p.displayName || 'Unknown').split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--win)', fontWeight: 700 }}>{p.wins}W</span>
                {' '}
                <span style={{ color: 'var(--loss)', fontWeight: 700 }}>{p.losses}L</span>
                {p.draws > 0 && <> <span style={{ fontWeight: 600 }}>{p.draws}D</span></>}
                {' · '}
                {p.total} duels
              </div>
            </div>

            {/* Win rate */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: p.winRate >= 60 ? 'var(--win)' : p.winRate <= 40 ? 'var(--loss)' : 'var(--ink)',
              }}>
                {p.winRate}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>win rate</div>
            </div>

            {/* Profit */}
            <div style={{ textAlign: 'right', minWidth: 50 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: p.profit > 0 ? 'var(--win)' : p.profit < 0 ? 'var(--loss)' : 'var(--ink-3)',
              }}>
                {p.profit > 0 ? '+' : ''}{fmtMoney(p.profit)}
              </div>
              <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>P&L</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
