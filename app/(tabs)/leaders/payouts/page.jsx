'use client';

import { BiggestWinsTab } from '@/components/screens/LeaderboardScreen';
import { useLeaderboard } from '@/lib/LeaderboardContext';

export default function PayoutsPage() {
  const { biggestWins } = useLeaderboard();
  return <BiggestWinsTab biggestWins={biggestWins} />;
}
