'use client';

import { useMemo } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtNet } from '@/lib/currency';
import { NetWorthGraph, SettlementCard, PenaltiesCard, AchievementBadges } from '@/components/screens/BetsScreen';
import { SettlementPlan } from '@/components/screens/LeaderboardScreen';

export default function AccountOverviewPage() {
  const { user, bets, bestCaseWin, scheduleMap } = useBetting();

  const realBets = useMemo(() => bets.filter(b => b.match_id !== '_topup' && b.kind !== 'penalty' && b.status !== 'cancelled'), [bets]);
  const penaltyBets = useMemo(() => bets.filter(b => b.kind === 'penalty' && b.status !== 'cancelled'), [bets]);

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
  const pendingCount = realBets.filter(b => b.status === 'pending').length;

  return (
    <>
      <div className="section-head" style={{ marginTop: 8 }}>
        <div className="section-head__title" style={{ fontSize: 14, fontWeight: 700 }}>P&L Graph</div>
      </div>
      <NetWorthGraph bets={bets} />
      <SettlementCard user={user} bets={bets} />
      <SettlementPlan user={user} />

      {pendingCount > 0 && (
        <div style={{
          margin: '0 16px 12px', padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Outcome range · {pendingCount} open bet{pendingCount !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 2 }}>Worst case</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--loss)' }}>
                {fmtNet((totalWon - totalLost) - totalOpen)}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: 'var(--line)' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 2 }}>Best case</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--win)' }}>
                {fmtNet((totalWon - totalLost) + bestCaseWin)}
              </div>
            </div>
          </div>
        </div>
      )}

      <PenaltiesCard penaltyBets={penaltyBets} scheduleMap={scheduleMap} />
      <AchievementBadges user={user} />
    </>
  );
}
