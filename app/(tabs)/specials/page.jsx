'use client';

import { useBetting } from '@/lib/BettingContext';
import SpecialsScreen from '@/components/screens/SpecialsScreen';

export default function SpecialsPage() {
  const { user, bets, matches, allUsers, setToast, handleOpenSpecialBet } = useBetting();

  return (
    <SpecialsScreen
      user={user}
      bets={bets}
      matches={matches}
      allUsers={allUsers}
      onToast={setToast}
      onOpenSpecialBet={handleOpenSpecialBet}
    />
  );
}
