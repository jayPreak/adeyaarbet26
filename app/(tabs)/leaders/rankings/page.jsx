'use client';

import { TotalWinsTab } from '@/components/screens/LeaderboardScreen';
import { useLeaderboard } from '@/lib/LeaderboardContext';

export default function RankingsPage() {
  const { rankings, user } = useLeaderboard();
  return <TotalWinsTab rankings={rankings} user={user} />;
}
