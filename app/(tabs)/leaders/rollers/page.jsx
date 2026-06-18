'use client';

import { BiggestBettorTab } from '@/components/screens/LeaderboardScreen';
import { useLeaderboard } from '@/lib/LeaderboardContext';

export default function RollersPage() {
  const { rankings, user } = useLeaderboard();
  return <BiggestBettorTab rankings={rankings} user={user} />;
}
