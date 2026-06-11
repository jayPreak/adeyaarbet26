'use client';

import { useState, useEffect, useCallback, Component } from 'react';
import { MATCHES, getMatch, getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';
import { computeBalance, computeWallet } from '@/lib/ledger';
import { useUser } from '@/lib/hooks';
import { AppHeader, TabBar, PlaceBetSheet, Toast, NewsTicker } from '@/components';
import HomeScreen from '@/components/screens/HomeScreen';
import FixturesScreen from '@/components/screens/FixturesScreen';
import LeaderboardScreen from '@/components/screens/LeaderboardScreen';
import BetsScreen from '@/components/screens/BetsScreen';
import DesktopApp from '@/components/desktop/DesktopApp';
import CupWinnerBetModal from '@/components/CupWinnerBetModal';
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';

const CUP_WINNER_POPUP_SEEN_KEY = 'adeyaar_cup_winner_popup_seen';

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

function getFifaStatus(fifa) {
  if (fifa.HomeTeamScore != null && fifa.AwayTeamScore != null) return 'finished';
  if (fifa.MatchStatus === 3) return 'live';
  return 'upcoming';
}

function mergeWithFifa(staticMatch, fifaResults) {
  if (!fifaResults?.length) return { ...staticMatch, status: 'upcoming' };
  const fifa = fifaResults.find(m =>
    m.Home?.Abbreviation === staticMatch.home &&
    m.Away?.Abbreviation === staticMatch.away
  );
  if (!fifa) return { ...staticMatch, status: 'upcoming' };
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

// Single source of times: stamp kickoffTs + derived UTC date/time from the DB schedule.
function withSchedule(match, scheduleMap) {
  const iso = scheduleMap[match.id];
  if (!iso) return match;
  const d = new Date(iso);
  return {
    ...match,
    kickoffTs: d.getTime(),
    date: d.toISOString().slice(0, 10), // YYYY-MM-DD (UTC) — same shape the UI formats
    time: d.toISOString().slice(11, 16), // HH:MM (UTC)
  };
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [poolMap, setPoolMap] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [cupWinnerOpen, setCupWinnerOpen] = useState(false);
  const [myCupWinnerBet, setMyCupWinnerBet] = useState(null);
  const [cupWinnerLoaded, setCupWinnerLoaded] = useState(false);

  const balance = computeBalance(bets);
  const wallet  = computeWallet(bets);

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

  const refreshCupWinnerBet = useCallback(() => {
    if (!user) return;
    fetch(`/api/cup-winner-bet?user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        setMyCupWinnerBet(data?.myBet || null);
        setCupWinnerLoaded(true);
      })
      .catch(() => { setCupWinnerLoaded(true); });
  }, [user]);

  useEffect(() => { refreshCupWinnerBet(); }, [refreshCupWinnerBet]);

  // First-login auto-open: only if user has no bet, before deadline, and never dismissed.
  useEffect(() => {
    if (!user || !cupWinnerLoaded) return;
    if (myCupWinnerBet) return;
    if (Date.now() >= (cupWinnerDeadlineTs ?? CUP_WINNER_DEADLINE_TS)) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(CUP_WINNER_POPUP_SEEN_KEY) === '1') return;
    setCupWinnerOpen(true);
  }, [user, cupWinnerLoaded, myCupWinnerBet, cupWinnerDeadlineTs]);

  const closeCupWinner = useCallback(() => {
    setCupWinnerOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CUP_WINNER_POPUP_SEEN_KEY, '1');
    }
  }, []);

  const openCupWinner = useCallback(() => setCupWinnerOpen(true), []);

  const handleCupWinnerPlaced = useCallback(() => {
    refreshCupWinnerBet();
    refreshData();
    setToast('Cup-winner bet placed');
  }, [refreshCupWinnerBet, refreshData]);

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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const matches = MATCHES.map(m => withSchedule(mergeWithFifa(m, fifaData), scheduleMap));

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

  if (isDesktop) {
    return (
      <>
        <DesktopApp
          tab={tab} setTab={setTab}
          balance={balance} openBet={openBet}
          matches={matches} user={user} onLogout={handleLogout}
          bets={bets} onCancelBet={cancelBet} poolMap={poolMap} allUsers={allUsers}
          myCupWinnerBet={myCupWinnerBet} onOpenCupWinner={openCupWinner}
          cupWinnerDeadlineTs={cupWinnerDeadlineTs}
        />
        {betSheet && (
          <div data-theme={theme}>
            <PlaceBetSheet
              match={betSheet.match}
              pick={betSheet.pick}
              balance={wallet}
              poolInfo={poolMap[betSheet.match.id] || null}
              existingBets={bets.filter(b => (b.match_id || b.matchId) === betSheet.match.id && b.status === 'pending')}
              onClose={closeBet}
              onConfirm={confirmBet}
            />
          </div>
        )}
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
        <CupWinnerBetModal
          open={cupWinnerOpen}
          onClose={closeCupWinner}
          user={user}
          balance={wallet}
          myCupWinnerBet={myCupWinnerBet}
          onPlaced={handleCupWinnerPlaced}
          deadlineTs={cupWinnerDeadlineTs}
        />
      </>
    );
  }

  return (
    <div className="stage">
      <div className="phone-frame">
        <div className="app" data-theme={theme}>
          <AppHeader balance={wallet} user={user} onTap={() => setTab('bets')} betsLoaded={betsLoaded} />
          <NewsTicker matches={matches} bets={bets} user={user} />

          <div className="scroll">
            <ErrorBoundary>
              {tab === 'home'     && <HomeScreen matches={matches} balance={balance} bets={bets} onBet={openBet} onCancelBet={cancelBet} onNav={setTab} user={user} poolMap={poolMap} allUsers={allUsers} myCupWinnerBet={myCupWinnerBet} onOpenCupWinner={openCupWinner} cupWinnerDeadlineTs={cupWinnerDeadlineTs} />}
              {tab === 'fixtures' && <FixturesScreen matches={matches} onBet={openBet} bets={bets} onCancelBet={cancelBet} poolMap={poolMap} allUsers={allUsers} />}
              {tab === 'leaders'  && <LeaderboardScreen user={user} />}
              {tab === 'bets'     && <BetsScreen bets={bets} onCancelBet={cancelBet} user={user} onProfileUpdate={refreshUser} onRefreshBets={refreshData} wallet={wallet} />}
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
            balance={wallet}
            poolInfo={poolMap[betSheet.match.id] || null}
            existingBets={bets.filter(b => (b.match_id || b.matchId) === betSheet.match.id && b.status === 'pending')}
            onClose={closeBet}
            onConfirm={confirmBet}
          />
        </div>
      )}

      <CupWinnerBetModal
        open={cupWinnerOpen}
        onClose={closeCupWinner}
        user={user}
        balance={wallet}
        myCupWinnerBet={myCupWinnerBet}
        onPlaced={handleCupWinnerPlaced}
        deadlineTs={cupWinnerDeadlineTs}
      />
    </div>
  );
}
