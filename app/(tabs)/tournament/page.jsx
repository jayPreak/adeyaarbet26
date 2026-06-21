'use client';

import { useRouter } from 'next/navigation';
import { useBetting } from '@/lib/BettingContext';
import BracketScreen from '@/components/screens/BracketScreen';

export default function TournamentPage() {
  const router = useRouter();
  const { matches } = useBetting();

  return (
    <BracketScreen
      matches={matches}
      onBack={() => router.push('/home')}
    />
  );
}
