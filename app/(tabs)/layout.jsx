'use client';

import { Component, useEffect } from 'react';
import { BettingProvider, useBetting } from '@/lib/BettingContext';
import dynamic from 'next/dynamic';
import { AppHeader, TabBar, PlaceBetSheet, Toast, SpecialNotification } from '@/components';
import CountdownGate from '@/components/CountdownGate';
import { useAutoReload } from '@/lib/useAutoReload';

// Lazy-load the special-bet modals — they're rarely opened, so keep their code
// out of the initial shell bundle. Each becomes its own chunk fetched on first open.
const CupWinnerBetModal = dynamic(() => import('@/components/CupWinnerBetModal'));
const ContinentBetModal = dynamic(() => import('@/components/ContinentBetModal'));
const H2HBetModal = dynamic(() => import('@/components/H2HBetModal'));
const ThirdPlaceQualifierBetModal = dynamic(() => import('@/components/ThirdPlaceQualifierBetModal'));

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: 14, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16, fontFamily: 'monospace' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabsShell({ children }) {
  const {
    user, loading, balance, realisedBalance, pendingStake, pendingCount, bestCaseWin, betsLoaded,
    betSheet, toast,
    openBet, closeBet, confirmBet, cancelBet, handleLogout, handleOpenSpecialBet,
    setToast, matches, bets, poolMap, allUsers,
    myCupWinnerBet, cupWinnerDeadlineTs,
    cupWinnerOpen, setCupWinnerOpen,
    continentOpen, setContinentOpen,
    h2hOpen, setH2hOpen,
    thirdPlaceQualOpen, setThirdPlaceQualOpen,
    refreshCupWinnerBet, refreshData, refreshPools,
  } = useBetting();

  useAutoReload();
  const theme = 'midnight';

  // iOS Safari's address/toolbar can show or hide without dvh recomputing
  // layout on an already-open fixed-position sheet. Track the real visible
  // height via visualViewport and expose it as a CSS var so bottom sheets
  // (.sheet-backdrop / .sheet in globals.css) size against what's actually on
  // screen — otherwise the pinned submit button can render below the visible
  // area, clipped by .sheet's overflow:hidden, with no way to scroll to it.
  useEffect(() => {
    const setVH = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--vvh', `${h * 0.01}px`);
    };
    setVH();
    window.visualViewport?.addEventListener('resize', setVH);
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    return () => {
      window.visualViewport?.removeEventListener('resize', setVH);
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  if (loading || !user) return null;

  return (
    <div className="stage">
      <div className="phone-frame">
        <div className="app" data-theme={theme}>
          <AppHeader balance={balance} realisedBalance={realisedBalance} pendingStake={pendingStake} pendingCount={pendingCount} bestCaseWin={bestCaseWin} user={user} onTap="/account/overview" betsLoaded={betsLoaded} />
          <SpecialNotification onNavigate="/specials" />

          <div className="scroll">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>

          <TabBar />

          {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        </div>
      </div>

      {betSheet && (
        <div data-theme={theme}>
          <PlaceBetSheet
            match={betSheet.match}
            pick={betSheet.pick}
            poolInfo={poolMap[betSheet.match.id] || null}
            existingBets={bets.filter(b => (b.match_id || b.matchId) === betSheet.match.id && b.status === 'pending' && (b.kind === 'match' || b.kind === 'penalty'))}
            onClose={closeBet}
            onConfirm={confirmBet}
          />
        </div>
      )}

      {cupWinnerOpen && (
        <div data-theme={theme}>
          <CupWinnerBetModal open onClose={() => setCupWinnerOpen(false)} user={user} myCupWinnerBet={myCupWinnerBet} onPlaced={() => { refreshCupWinnerBet(); refreshData(); }} deadlineTs={cupWinnerDeadlineTs} />
        </div>
      )}
      {continentOpen && (
        <div data-theme={theme}>
          <ContinentBetModal open onClose={() => setContinentOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
        </div>
      )}
      {h2hOpen && (
        <div data-theme={theme}>
          <H2HBetModal open onClose={() => setH2hOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
        </div>
      )}
      {thirdPlaceQualOpen && (
        <div data-theme={theme}>
          <ThirdPlaceQualifierBetModal open onClose={() => setThirdPlaceQualOpen(false)} user={user} onPlaced={() => { refreshData(); }} matches={matches} />
        </div>
      )}
    </div>
  );
}

export default function TabsLayout({ children }) {
  return (
    <CountdownGate>
      <BettingProvider>
        <TabsShell>{children}</TabsShell>
      </BettingProvider>
    </CountdownGate>
  );
}
