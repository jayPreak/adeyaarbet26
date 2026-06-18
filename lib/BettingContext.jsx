'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { MATCHES, getMatch, getTeam } from '@/lib/data';
import { fmtMoney } from '@/lib/currency';
import { computeBalance, computeRealisedBalance } from '@/lib/ledger';
import { useUser } from '@/lib/hooks';

const BettingContext = createContext(null);

const FIFA_ALIAS = { KSA: 'SAU' };
function normCode(c) { return FIFA_ALIAS[c] || c; }

function getFifaStatus(fifa) {
  if (fifa.MatchStatus === 3) return 'live';
  if (fifa.MatchStatus === 0 && fifa.HomeTeamScore != null && fifa.AwayTeamScore != null) return 'finished';
  if (fifa.HomeTeamScore != null && fifa.AwayTeamScore != null) return 'finished';
  return 'upcoming';
}

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

function inferStatus(match) {
  if (!match.kickoffTs) return 'upcoming';
  const kickoff = new Date(match.kickoffTs).getTime();
  if (isNaN(kickoff)) return 'upcoming';
  const elapsed = Date.now() - kickoff;
  if (elapsed > 3 * 60 * 60 * 1000) return 'finished';
  if (elapsed > 0) return 'live';
  return 'upcoming';
}

export function BettingProvider({ children }) {
  const { user, loading, refreshUser } = useUser();
  const [betSheet, setBetSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [bets, setBets] = useState([]);
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
  const [poolMap, setPoolMap] = useState({});
  const [isDesktop, setIsDesktop] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

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

  const matches = useMemo(() => MATCHES.map(m => {
    const merged = mergeWithFifa(m, fifaData);
    const kickoffTs = scheduleMap[m.id] || null;
    return kickoffTs ? { ...merged, kickoffTs } : merged;
  }), [fifaData, scheduleMap]);

  const openBet = useCallback((match, pick) => setBetSheet({ match, pick }), []);
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
  }, [user, cancelling, refreshPools]);

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

  const handleOpenSpecialBet = useCallback((id, ctx) => {
    if (id === 'goalscorer' && ctx?.matchId) {
      setGoalScorerMatchId(ctx.matchId);
      setGoalScorerOpen(true);
    } else if (id === 'continent') {
      setContinentOpen(true);
    } else if (id === 'h2h') {
      setH2hOpen(true);
    } else if (id === 'golden_boot') {
      setGoldenBootOpen(true);
    } else {
      setCupWinnerOpen(true);
    }
  }, []);

  const value = useMemo(() => ({
    user, loading, refreshUser,
    bets, betsLoaded, balance, realisedBalance,
    pendingBets, pendingStake, pendingCount, bestCaseWin,
    matches, scheduleMap, poolMap, allUsers,
    cupWinnerDeadlineTs, myCupWinnerBet,
    betSheet, toast, isDesktop,
    // actions
    openBet, closeBet, cancelBet, confirmBet,
    handleLogout, handleOpenSpecialBet,
    refreshData, refreshPools, refreshCupWinnerBet,
    setToast, setBetSheet,
    // modal state
    cupWinnerOpen, setCupWinnerOpen,
    goalScorerOpen, setGoalScorerOpen, goalScorerMatchId,
    continentOpen, setContinentOpen,
    h2hOpen, setH2hOpen,
    goldenBootOpen, setGoldenBootOpen,
  }), [
    user, loading, refreshUser,
    bets, betsLoaded, balance, realisedBalance,
    pendingBets, pendingStake, pendingCount, bestCaseWin,
    matches, scheduleMap, poolMap, allUsers,
    cupWinnerDeadlineTs, myCupWinnerBet,
    betSheet, toast, isDesktop,
    openBet, closeBet, cancelBet, confirmBet,
    handleLogout, handleOpenSpecialBet,
    refreshData, refreshPools, refreshCupWinnerBet,
    cupWinnerOpen, goalScorerOpen, goalScorerMatchId,
    continentOpen, h2hOpen, goldenBootOpen,
  ]);

  return (
    <BettingContext.Provider value={value}>
      {children}
    </BettingContext.Provider>
  );
}

export function useBetting() {
  const ctx = useContext(BettingContext);
  if (!ctx) throw new Error('useBetting must be used within BettingProvider');
  return ctx;
}
