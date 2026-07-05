'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBetting } from '@/lib/BettingContext';
import SpecialsScreen from '@/components/screens/SpecialsScreen';
import DuelsPage from './duels/page';

export default function SpecialsPage() {
  const { user, bets, matches, allUsers, setToast, handleOpenSpecialBet, challenges } = useBetting();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'duels' ? 'duels' : 'bets';
  const [tab, setTab] = useState(initialTab);

  const incomingCount = challenges.filter(c => c.status === 'open' && c.opponent_id === user?.id).length;

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 0, margin: '0 16px 4px', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <button
          onClick={() => setTab('bets')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: tab === 'bets' ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
            color: tab === 'bets' ? 'var(--gold)' : 'var(--ink-3)',
            borderBottom: tab === 'bets' ? '2px solid var(--gold)' : '2px solid transparent',
          }}
        >
          Specials
        </button>
        <button
          onClick={() => setTab('duels')}
          style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: tab === 'duels' ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
            color: tab === 'duels' ? 'var(--gold)' : 'var(--ink-3)',
            borderBottom: tab === 'duels' ? '2px solid var(--gold)' : '2px solid transparent',
            position: 'relative',
          }}
        >
          Duels
          {incomingCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: '20%',
              width: 16, height: 16, borderRadius: '50%', fontSize: 10, fontWeight: 800,
              background: 'var(--loss)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {incomingCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'bets' && (
        <SpecialsScreen
          user={user}
          bets={bets}
          matches={matches}
          allUsers={allUsers}
          onToast={setToast}
          onOpenSpecialBet={handleOpenSpecialBet}
        />
      )}

      {tab === 'duels' && <DuelsPage />}
    </div>
  );
}
