'use client';

import { Component } from 'react';
import { BettingProvider, useBetting } from '@/lib/BettingContext';
import { AppHeader, TabBar, PlaceBetSheet, Toast, SpecialNotification } from '@/components';
import CountdownGate from '@/components/CountdownGate';
import CupWinnerBetModal from '@/components/CupWinnerBetModal';
import GoalScorerBetModal from '@/components/GoalScorerBetModal';
import ContinentBetModal from '@/components/ContinentBetModal';
import H2HBetModal from '@/components/H2HBetModal';
import GoldenBootBetModal from '@/components/GoldenBootBetModal';
import DesktopApp from '@/components/desktop/DesktopApp';

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
    betSheet, toast, isDesktop,
    openBet, closeBet, confirmBet, cancelBet, handleLogout, handleOpenSpecialBet,
    setToast, matches, bets, poolMap, allUsers,
    myCupWinnerBet, cupWinnerDeadlineTs,
    cupWinnerOpen, setCupWinnerOpen,
    goalScorerOpen, setGoalScorerOpen, goalScorerMatchId,
    continentOpen, setContinentOpen,
    h2hOpen, setH2hOpen,
    goldenBootOpen, setGoldenBootOpen,
    refreshCupWinnerBet, refreshData, refreshPools,
  } = useBetting();

  const theme = 'midnight';

  if (loading || !user) return null;

  if (isDesktop) {
    return (
      <div data-theme={theme}>
        <DesktopApp
          balance={balance} openBet={openBet}
          matches={matches} user={user}
          onLogout={handleLogout}
          bets={bets} onCancelBet={cancelBet}
          poolMap={poolMap} allUsers={allUsers}
          myCupWinnerBet={myCupWinnerBet}
          onOpenCupWinner={() => setCupWinnerOpen(true)}
          cupWinnerDeadlineTs={cupWinnerDeadlineTs}
          onOpenSpecialBet={handleOpenSpecialBet}
          onToast={setToast}
        />
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        {betSheet && (
          <PlaceBetSheet
            match={betSheet.match}
            pick={betSheet.pick}
            poolInfo={poolMap[betSheet.match.id] || null}
            existingBets={bets.filter(b => (b.match_id || b.matchId) === betSheet.match.id && b.status === 'pending')}
            onClose={closeBet}
            onConfirm={confirmBet}
          />
        )}
        <CupWinnerBetModal open={cupWinnerOpen} onClose={() => setCupWinnerOpen(false)} user={user} myCupWinnerBet={myCupWinnerBet} onPlaced={() => { refreshCupWinnerBet(); refreshData(); }} deadlineTs={cupWinnerDeadlineTs} />
        <GoalScorerBetModal open={goalScorerOpen} onClose={() => setGoalScorerOpen(false)} matchId={goalScorerMatchId} user={user} onPlaced={() => { refreshData(); refreshPools(); }} />
        <ContinentBetModal open={continentOpen} onClose={() => setContinentOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
        <H2HBetModal open={h2hOpen} onClose={() => setH2hOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
        <GoldenBootBetModal open={goldenBootOpen} onClose={() => setGoldenBootOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
      </div>
    );
  }

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
            existingBets={bets.filter(b => (b.match_id || b.matchId) === betSheet.match.id && b.status === 'pending')}
            onClose={closeBet}
            onConfirm={confirmBet}
          />
        </div>
      )}

      <div data-theme={theme}>
        <CupWinnerBetModal open={cupWinnerOpen} onClose={() => setCupWinnerOpen(false)} user={user} myCupWinnerBet={myCupWinnerBet} onPlaced={() => { refreshCupWinnerBet(); refreshData(); }} deadlineTs={cupWinnerDeadlineTs} />
      </div>
      <div data-theme={theme}>
        <GoalScorerBetModal open={goalScorerOpen} onClose={() => setGoalScorerOpen(false)} matchId={goalScorerMatchId} user={user} onPlaced={() => { refreshData(); refreshPools(); }} />
      </div>
      <div data-theme={theme}>
        <ContinentBetModal open={continentOpen} onClose={() => setContinentOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
      </div>
      <div data-theme={theme}>
        <H2HBetModal open={h2hOpen} onClose={() => setH2hOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
      </div>
      <div data-theme={theme}>
        <GoldenBootBetModal open={goldenBootOpen} onClose={() => setGoldenBootOpen(false)} user={user} onPlaced={() => { refreshData(); }} />
      </div>
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
