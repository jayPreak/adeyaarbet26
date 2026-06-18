'use client';

import { useState, useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtMoney } from '@/lib/currency';
import { BetCard } from '@/components';

export default function AccountBetsPage() {
  const { user, bets, cancelBet, scheduleMap, cupWinnerDeadlineTs, poolMap, allUsers } = useBetting();
  const [betFilter, setBetFilter] = useState('open');

  const realBets = useMemo(() => bets.filter(b => b.match_id !== '_topup' && b.kind !== 'penalty' && b.status !== 'cancelled'), [bets]);

  const filtered = useMemo(() => {
    if (betFilter === 'open') {
      return realBets.filter(b => b.status === 'pending').sort((a, b) => {
        const tsA = new Date(scheduleMap[a.match_id || a.matchId] || '2099-01-01').getTime();
        const tsB = new Date(scheduleMap[b.match_id || b.matchId] || '2099-01-01').getTime();
        return tsA - tsB;
      });
    }
    return realBets.filter(b => b.status === 'won' || b.status === 'lost')
      .sort((a, b) => new Date(b.resolved_at || b.created_at) - new Date(a.resolved_at || a.created_at));
  }, [realBets, betFilter, scheduleMap]);

  const totalOpen = useMemo(
    () => realBets.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0),
    [realBets]
  );
  const totalWon = useMemo(
    () => realBets.filter(b => b.status === 'won').reduce((s, b) => s + ((b.payout || 0) - b.amount), 0),
    [realBets]
  );
  const totalLost = useMemo(
    () => realBets.filter(b => b.status === 'lost').reduce((s, b) => s + b.amount, 0),
    [realBets]
  );
  const settled = realBets.filter(b => b.status === 'won' || b.status === 'lost');
  const winRate = settled.length
    ? Math.round(100 * realBets.filter(b => b.status === 'won').length / settled.length)
    : 0;

  return (
    <>
      <div className="stats-bar" style={{ cursor: 'default', marginTop: 0 }}>
        <div className="stats-bar__cell">
          <div className="stats-bar__label">Open Stake</div>
          <div className="stats-bar__value" style={{ color: 'var(--gold)' }}>{fmtMoney(totalOpen)}</div>
        </div>
        <div className="stats-bar__divider" />
        <div className="stats-bar__cell">
          <div className="stats-bar__label">Won</div>
          <div className="stats-bar__value" style={{ color: 'var(--win)' }}>+{fmtMoney(totalWon)}</div>
        </div>
        <div className="stats-bar__divider" />
        <div className="stats-bar__cell">
          <div className="stats-bar__label">Lost</div>
          <div className="stats-bar__value" style={{ color: 'var(--loss)' }}>-{fmtMoney(totalLost)}</div>
        </div>
        <div className="stats-bar__divider" />
        <div className="stats-bar__cell">
          <div className="stats-bar__label">Win Rate</div>
          <div className="stats-bar__value">{winRate}%</div>
        </div>
      </div>

      <div className="chip-row" style={{ marginBottom: 12, marginTop: 12 }}>
        {[
          { id: 'open', label: `Open · ${realBets.filter(b => b.status === 'pending').length}` },
          { id: 'completed', label: `Completed · ${realBets.filter(b => b.status === 'won' || b.status === 'lost').length}` },
        ].map(t => (
          <button
            key={t.id}
            className={'chip ' + (betFilter === t.id ? 'active' : '')}
            onClick={() => setBetFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>
            {realBets.length === 0 ? 'Place your first bet!' : betFilter === 'open' ? 'No open bets' : 'No completed bets yet'}
          </div>
        )}
        {filtered.map(b => <BetCard key={b.id} bet={b} onCancelBet={cancelBet} kickoffTs={scheduleMap[b.match_id || b.matchId] || null} cupWinnerDeadlineTs={cupWinnerDeadlineTs} poolData={poolMap[b.match_id || b.matchId]} allUsers={allUsers} userId={user?.id} />)}
      </div>
    </>
  );
}
