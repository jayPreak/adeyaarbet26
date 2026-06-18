'use client';

import { BiggestLossesTab } from '@/components/screens/LeaderboardScreen';
import { useLeaderboard } from '@/lib/LeaderboardContext';

export default function LossesPage() {
  const { biggestLosses } = useLeaderboard();
  return <BiggestLossesTab biggestLosses={biggestLosses} />;
}
