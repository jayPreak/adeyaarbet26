'use client';

import { useRouter } from 'next/navigation';
import { useBetting } from '@/lib/BettingContext';
import HomeScreen from '@/components/screens/HomeScreen';

const NAV_ROUTES = { specials: '/specials', fixtures: '/fixtures/upcoming', leaders: '/leaders/rankings', bets: '/account/overview' };

export default function HomePage() {
  const router = useRouter();
  const {
    matches, balance, bets, openBet, cancelBet, user,
    poolMap, allUsers, myCupWinnerBet, setCupWinnerOpen, cupWinnerDeadlineTs,
    setThirdPlaceQualOpen, totalInPlay, totalBets,
  } = useBetting();

  return (
    <HomeScreen
      matches={matches}
      balance={balance}
      bets={bets}
      onBet={openBet}
      onCancelBet={cancelBet}
      onNav={(tab) => router.push(NAV_ROUTES[tab] || `/${tab}`)}
      user={user}
      poolMap={poolMap}
      allUsers={allUsers}
      myCupWinnerBet={myCupWinnerBet}
      onOpenCupWinner={() => setCupWinnerOpen(true)}
      cupWinnerDeadlineTs={cupWinnerDeadlineTs}
      onOpenThirdPlaceQual={() => setThirdPlaceQualOpen(true)}
      totalInPlay={totalInPlay}
      totalBets={totalBets}
    />
  );
}
