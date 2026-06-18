'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useBetting } from '@/lib/BettingContext';
import { AccountSection } from '@/components/screens/BetsScreen';

export default function AccountLayout({ children }) {
  const pathname = usePathname();
  const { user, refreshUser, bets } = useBetting();

  const realBetsCount = bets.filter(b => b.match_id !== '_topup' && b.kind !== 'penalty' && b.status !== 'cancelled').length;

  return (
    <div>
      <AccountSection user={user} onProfileUpdate={refreshUser} />

      <div className="material-tabs">
        <Link
          href="/account/overview"
          className={'material-tab' + (pathname === '/account/overview' ? ' active' : '')}
        >
          Overview
        </Link>
        <Link
          href="/account/bets"
          className={'material-tab' + (pathname === '/account/bets' ? ' active' : '')}
        >
          My Bets ({realBetsCount})
        </Link>
      </div>

      {children}
    </div>
  );
}
