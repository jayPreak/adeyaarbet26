'use client';

import { useState, useEffect, useCallback, Component } from 'react';
import { MATCHES, getMatch, getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';
import { computeBalance, computeRealisedBalance } from '@/lib/ledger';
import { useUser } from '@/lib/hooks';
import { AppHeader, TabBar, PlaceBetSheet, Toast, SpecialNotification } from '@/components';
import HomeScreen from '@/components/screens/HomeScreen';
import FixturesScreen from '@/components/screens/FixturesScreen';
import CupWinnerBetModal from '@/components/CupWinnerBetModal';
import GoalScorerBetModal from '@/components/GoalScorerBetModal';
import ContinentBetModal from '@/components/ContinentBetModal';
import H2HBetModal from '@/components/H2HBetModal';
import GoldenBootBetModal from '@/components/GoldenBootBetModal';
import ThirdPlaceQualifierBetModal from '@/components/ThirdPlaceQualifierBetModal';
import SpecialsScreen from '@/components/screens/SpecialsScreen';
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: 14, marginBottom: 8 }}>
            Something went wrong
          </div>
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
import LeaderboardScreen from '@/components/screens/LeaderboardScreen';
import BetsScreen from '@/components/screens/BetsScreen';
import BracketScreen from '@/components/screens/BracketScreen';
import DesktopApp from '@/components/desktop/DesktopApp';

function getFifaStatus(fifa) {
  if (fifa.MatchStatus === 3) return 'live';
  if (fifa.MatchStatus === 0 && fifa.HomeTeamScore != null && fifa.AwayTeamScore != null) return 'finished';
  if (fifa.HomeTeamScore != null && fifa.AwayTeamScore != null) return 'finished';
  return 'upcoming';
}

// FIFA uses different codes for some teams (e.g. KSA instead of SAU)
const FIFA_ALIAS = { KSA: 'SAU' };
function normCode(c) { return FIFA_ALIAS[c] || c; }

function mergeWithFifa(staticMatch, fifaResults) {
  if (!fifaResults?.length) return { ...staticMatch, status: inferStatus(staticMatch) };
  const fifa = fifaResults.find(m =>
    normCode(m.Home?.Abbreviation) === staticMatch.home &&
    normCode(m.Away?.Abbreviation) === staticMatch.away
  );
  if (!fifa) return { ...staticMatch, status: inferStatus(staticMatch) };
  const stadiumName = fifa.Stadium?.Name?.[0]?.Description;
  const cityName = fifa.Stadium?.CityName?.[0]?.Description;
  const venue = stadiumName
    ? cityName ? `${stadiumName}, ${cityName}` : stadiumName
    : staticMatch.venue;
  const status = getFifaStatus(fifa);
  const score = (fifa.HomeTeamScore != null && fifa.AwayTeamScore != null)
    ? [fifa.HomeTeamScore, fifa.AwayTeamScore]
    : null;
  const minute = fifa.MatchMinute ?? null;
  return { ...staticMatch, venue, fifaId: fifa.IdMatch, status, score, minute };
}

// Fallback when FIFA data is unavailable: if kickoff was 3+ hours ago, treat as finished
function inferStatus(match) {
  if (!match.kickoffTs) return 'upcoming';
  const kickoff = new Date(match.kickoffTs).getTime();
  if (isNaN(kickoff)) return 'upcoming';
  const elapsed = Date.now() - kickoff;
  if (elapsed > 3 * 60 * 60 * 1000) return 'finished';
  if (elapsed > 0) return 'live';
  return 'upcoming';
}

export default function AdeYaarApp() {
  const theme = 'midnight';
  const { user, loading, refreshUser } = useUser();
  const [tab, setTab]           = useState('home');
  const [betSheet, setBetSheet] = useState(null);
  const [toast, setToast]       = useState(null);
  const [bets, setBets]         = useState([]);
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [fifaData, setFifaData] = useState(null);
  const [scheduleMap, setScheduleMap] = useState({});
  const [cupWinnerDeadlineTs, setCupWinnerDeadlineTs] = useState(null);
  const [cupWinnerOpen, setCupWinnerOpen] = useState(false);
  const [myCupWinnerBet, setMyCupWinnerBet] = useState(null);
  const [goalScorerOpen, setGoalScorerOpen] = useState(false);
  const [goalScorerMatchId, setGoalScorerMatchId] = useState(null);
  const [continentOpen, setContinentOpen] = useState(false);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [goldenBootOpen, setGoldenBootOpen] = useState(false);
  const [thirdPlaceQualOpen, setThirdPlaceQualOpen] = useState(false);
  const [poolMap, setPoolMap] = useState({});
  const [isDesktop, setIsDesktop] = useState(false);

  const balance = computeBalance(bets);
  const realisedBalance = computeRealisedBalance(bets.filter(b => b.match_id !== '_topup'));
  const pendingBets = bets.filter(b => b.match_id !== '_topup' && b.kind !== 'penalty' && b.status === 'pending');
  const pendingStake = pendingBets.reduce((s, b) => s + b.amount, 0);
  const pendingCount = pendingBets.length;
  const bestCaseWin = pendingBets.reduce((s, b) => {
    const pool = poolMap[b.match_id];
    if (!pool || !pool.total) return s + b.amount;
    const total = pool.total;
    const sidePool = pool.bySide?.[b.pick] || b.amount;
    return s + Math.floor((b.amount / sidePool) * total) - b.amount;
  }, 0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
  }, [user, loading]);

  const refreshData = useCallback(() => {
    if (!user) return;
    fetch(`/api/bets?user_id=${user.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBets(data); setBetsLoaded(true); })
      .catch(() => { setBetsLoaded(true); });
  }, [user]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Auto-resolve finished matches on load — fire and forget, refresh if anything settled
  useEffect(() => {
    fetch('/api/auto-resolve')
      .then(r => r.json())
      .then(data => {
        if (data.resolved?.length > 0) {
          refreshData();
          refreshPools();
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch('/api/fifa/matches')
      .then(r => r.json())
      .then(setFifaData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/schedule')
      .then(r => r.json())
      .then(d => { setScheduleMap(d.schedule || {}); setCupWinnerDeadlineTs(d.cupWinnerDeadlineTs ?? null); })
      .catch(() => {});
  }, []);

  const refreshCupWinnerBet = useCallback(() => {
    if (!user) return;
    fetch(`/api/cup-winner-bet?user_id=${user.id}`)
      .then(r => r.json())
      .then(data => setMyCupWinnerBet(data?.myBet || null))
      .catch(() => {});
  }, [user]);

  useEffect(() => { refreshCupWinnerBet(); }, [refreshCupWinnerBet]);

  const [allUsers, setAllUsers] = useState([]);

  // Fetch all active pools (single request) + all profiles
  const refreshPools = useCallback(() => {
    if (!user) return;
    fetch('/api/pool')
      .then(r => r.json())
      .then(data => {
        if (data && data.pools) {
          setPoolMap(data.pools);
          if (data.allUsers) setAllUsers(data.allUsers);
        } else if (data && typeof data === 'object') {
          setPoolMap(data);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => { refreshPools(); }, [refreshPools]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const matches = MATCHES.map(m => {
    const merged = mergeWithFifa(m, fifaData);
    const kickoffTs = scheduleMap[m.id] || null;
    return kickoffTs ? { ...merged, kickoffTs } : merged;
  });

  const openBet  = useCallback((match, pick) => setBetSheet({ match, pick }), []);
  const closeBet = useCallback(() => setBetSheet(null), []);

  const cancelBet = useCallback(async (matchId) => {
    if (!user || cancelling) return;
    if (!confirm('Cancel your bet on this match? Your stake will be refunded.')) return;
    setCancelling(matchId);
    try {
      const res = await fetch('/api/bets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBets(prev => prev.map(b =>
        b.match_id === matchId && b.status === 'pending'
          ? { ...b, status: 'cancelled' }
          : b
      ));
      refreshPools();
      setToast(`Bet cancelled · ${fmtMoney(data.refunded)} refunded`);
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setCancelling(null);
    }
  }, [user, cancelling]);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('adeyaar_user');
    const { default: supabaseBrowser } = await import('@/lib/supabase-browser');
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = '/login';
  }, []);

  const confirmBet = useCallback(async ({ matchId, pick, amount }) => {
    if (!user || placing) return;
    setPlacing(true);
    try {
      const liveMatch = matches.find(m => m.id === matchId);
      if (liveMatch && liveMatch.status === 'finished') {
        throw new Error('Match already finished');
      }

      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, matchId, pick, amount }),
      });
      const data = await res.json();

      if (res.status === 503) {
        throw new Error('Database unavailable — bet not placed');
      } else if (!res.ok) {
        throw new Error(data.error || 'Failed to place bet');
      } else {
        refreshData();
        refreshPools();
      }

      setBetSheet(null);
      const match = getMatch(matchId);
      const team = pick === 'home' ? getTeam(match.home) :
                   pick === 'away' ? getTeam(match.away) : null;
      setToast(`Bet placed · ${fmtMoney(amount)} on ${team ? team.name : 'Draw'}`);
    } catch (err) {
      setBetSheet(null);
      setToast(`Error: ${err.message}`);
    } finally {
      setPlacing(false);
    }
  }, [matches, user, placing, refreshData, refreshPools]);

  if (loading || !user) return null;

  const handleOpenSpecialBet = (id, ctx) => {
    if (id === 'goalscorer' && ctx?.matchId) {
      setGoalScorerMatchId(ctx.matchId);
      setGoalScorerOpen(true);
    } else if (id === 'continent') {
      setContinentOpen(true);
    } else if (id === 'h2h') {
      setH2hOpen(true);
    } else if (id === 'golden_boot') {
      setGoldenBootOpen(true);
    } else if (id === 'third_place_qualifiers') {
      setThirdPlaceQualOpen(true);
    } else {
      setCupWinnerOpen(true);
    }
  };

  if (isDesktop) {
    return (
      <div data-theme={theme}>
        <DesktopApp
          tab={tab} setTab={setTab}
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
          onOpenThirdPlaceQual={() => setThirdPlaceQualOpen(true)}
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
        <ThirdPlaceQualifierBetModal open={thirdPlaceQualOpen} onClose={() => setThirdPlaceQualOpen(false)} user={user} onPlaced={() => { refreshData(); }} matches={matches} />
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="phone-frame">
        <div className="app" data-theme={theme}>
          <AppHeader balance={balance} realisedBalance={realisedBalance} pendingStake={pendingStake} pendingCount={pendingCount} bestCaseWin={bestCaseWin} user={user} onTap={() => setTab('bets')} betsLoaded={betsLoaded} />
          <SpecialNotification onNavigate={() => setTab('specials')} />

          <div className="scroll">
            <ErrorBoundary>
              {tab === 'home'     && <HomeScreen matches={matches} balance={balance} bets={bets} onBet={openBet} onCancelBet={cancelBet} onNav={setTab} user={user} poolMap={poolMap} allUsers={allUsers} myCupWinnerBet={myCupWinnerBet} onOpenCupWinner={() => setCupWinnerOpen(true)} cupWinnerDeadlineTs={cupWinnerDeadlineTs} onOpenThirdPlaceQual={() => setThirdPlaceQualOpen(true)} />}
              {tab === 'fixtures' && <FixturesScreen matches={matches} onBet={openBet} bets={bets} onCancelBet={cancelBet} poolMap={poolMap} allUsers={allUsers} userId={user.id} />}
              {tab === 'specials' && (
                <SpecialsScreen
                  user={user}
                  bets={bets}
                  matches={matches}
                  allUsers={allUsers}
                  onToast={setToast}
                  onOpenSpecialBet={handleOpenSpecialBet}
                />
              )}
              {tab === 'leaders'  && <LeaderboardScreen user={user} />}
              {tab === 'bets'       && <BetsScreen bets={bets} onCancelBet={cancelBet} user={user} onProfileUpdate={refreshUser} onRefreshBets={refreshData} scheduleMap={scheduleMap} cupWinnerDeadlineTs={cupWinnerDeadlineTs} bestCaseWin={bestCaseWin} poolMap={poolMap} allUsers={allUsers} />}
              {tab === 'tournament' && <BracketScreen matches={matches} onBack={() => setTab('home')} />}
            </ErrorBoundary>
          </div>

          <TabBar active={tab} onChange={setTab} />

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
        <CupWinnerBetModal
          open={cupWinnerOpen}
          onClose={() => setCupWinnerOpen(false)}
          user={user}
          myCupWinnerBet={myCupWinnerBet}
          onPlaced={() => { refreshCupWinnerBet(); refreshData(); }}
          deadlineTs={cupWinnerDeadlineTs}
        />
      </div>

      <div data-theme={theme}>
        <GoalScorerBetModal
          open={goalScorerOpen}
          onClose={() => setGoalScorerOpen(false)}
          matchId={goalScorerMatchId}
          user={user}
          onPlaced={() => { refreshData(); refreshPools(); }}
        />
      </div>

      <div data-theme={theme}>
        <ContinentBetModal
          open={continentOpen}
          onClose={() => setContinentOpen(false)}
          user={user}
          onPlaced={() => { refreshData(); }}
        />
      </div>

      <div data-theme={theme}>
        <H2HBetModal
          open={h2hOpen}
          onClose={() => setH2hOpen(false)}
          user={user}
          onPlaced={() => { refreshData(); }}
        />
      </div>

      <div data-theme={theme}>
        <GoldenBootBetModal
          open={goldenBootOpen}
          onClose={() => setGoldenBootOpen(false)}
          user={user}
          onPlaced={() => { refreshData(); }}
        />
        <ThirdPlaceQualifierBetModal
          open={thirdPlaceQualOpen}
          onClose={() => setThirdPlaceQualOpen(false)}
          user={user}
          onPlaced={() => { refreshData(); }}
          matches={matches}
        />
      </div>

    </div>
  );
}
