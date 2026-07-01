'use client';

import { useState, useEffect } from 'react';
import { useBetting } from '@/lib/BettingContext';
import { fmtMoney, CURRENCY_SYMBOL } from '@/lib/currency';

export default function H2HPage() {
  const { user, bets, refreshData } = useBetting();
  const [goalData, setGoalData] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [myBet, setMyBet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/h2h-goals')
      .then(r => r.json())
      .then(setGoalData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/special-bet?match_id=MESSI_V_RONALDO&kind=h2h&user_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setPoolData(d.pool || null);
        setMyBet(d.myBets?.[0] || null);
      })
      .catch(() => {});
  }, [user]);

  const messiGoals = goalData?.messi?.goals || [];
  const ronaldoGoals = goalData?.ronaldo?.goals || [];
  const messiAssists = goalData?.messi?.assists || 0;
  const ronaldoAssists = goalData?.ronaldo?.assists || 0;

  const totalPool = poolData?.total || 0;
  const messiPool = poolData?.byOption?.messi || 0;
  const ronaldoPool = poolData?.byOption?.ronaldo || 0;

  return (
    <div style={{ padding: '16px', maxWidth: 480 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>⚔️ Messi vs Ronaldo</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 }}>
        Most World Cup goals wins. Live tracker.
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{
          padding: '16px', borderRadius: 12, textAlign: 'center',
          background: myBet?.pick === 'messi' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
          border: myBet?.pick === 'messi' ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>🇦🇷 MESSI</div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-mono)', color: messiGoals.length >= ronaldoGoals.length ? 'var(--win)' : 'var(--ink)' }}>
            {loading ? '–' : messiGoals.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {messiAssists > 0 && `${messiAssists} assist${messiAssists > 1 ? 's' : ''}`}
          </div>
          {messiPool > 0 && (
            <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>
              {fmtMoney(messiPool)} staked
            </div>
          )}
        </div>

        <div style={{
          padding: '16px', borderRadius: 12, textAlign: 'center',
          background: myBet?.pick === 'ronaldo' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
          border: myBet?.pick === 'ronaldo' ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>🇵🇹 RONALDO</div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-mono)', color: ronaldoGoals.length >= messiGoals.length ? 'var(--win)' : 'var(--ink)' }}>
            {loading ? '–' : ronaldoGoals.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {ronaldoAssists > 0 && `${ronaldoAssists} assist${ronaldoAssists > 1 ? 's' : ''}`}
          </div>
          {ronaldoPool > 0 && (
            <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 4 }}>
              {fmtMoney(ronaldoPool)} staked
            </div>
          )}
        </div>
      </div>

      {/* Pool bar */}
      {totalPool > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', marginBottom: 4 }}>
            <span>Messi {totalPool > 0 ? Math.round((messiPool / totalPool) * 100) : 0}%</span>
            <span>Pool: {fmtMoney(totalPool)}</span>
            <span>Ronaldo {totalPool > 0 ? Math.round((ronaldoPool / totalPool) * 100) : 0}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${(messiPool / totalPool) * 100}%`, background: '#75b8ff', borderRadius: '3px 0 0 3px' }} />
            <div style={{ width: `${(ronaldoPool / totalPool) * 100}%`, background: '#ff6b6b', borderRadius: '0 3px 3px 0', marginLeft: 'auto' }} />
          </div>
        </div>
      )}

      {/* My bet */}
      {myBet && (
        <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 2 }}>YOUR BET</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {myBet.pick === 'messi' ? '🇦🇷 Messi' : '🇵🇹 Ronaldo'} · {fmtMoney(myBet.amount)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{myBet.status}</span>
          </div>
        </div>
      )}

      {/* Goal timeline */}
      {!loading && (messiGoals.length > 0 || ronaldoGoals.length > 0) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.04em' }}>
            GOAL LOG
          </div>
          {[...messiGoals.map(g => ({ ...g, player: 'messi' })), ...ronaldoGoals.map(g => ({ ...g, player: 'ronaldo' }))]
            .sort((a, b) => {
              const ma = parseInt(a.minute) || 0;
              const mb = parseInt(b.minute) || 0;
              return mb - ma;
            })
            .map((g, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4,
                borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 12 }}>{g.player === 'messi' ? '🇦🇷' : '🇵🇹'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
                  {g.player === 'messi' ? 'Messi' : 'Ronaldo'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>vs {g.vs}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>{g.minute}</span>
                {g.type === 'penalty' && <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>PEN</span>}
              </div>
            ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-3)', fontSize: 12 }}>
          Loading goal data...
        </div>
      )}
    </div>
  );
}
