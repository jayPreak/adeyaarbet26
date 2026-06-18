'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useBetting } from '@/lib/BettingContext';
import { LeaderboardProvider } from '@/lib/LeaderboardContext';

const TABS = [
  { id: 'rankings', path: '/leaders/rankings', label: 'Rankings' },
  { id: 'payouts',  path: '/leaders/payouts',  label: 'Top Payouts' },
  { id: 'losses',   path: '/leaders/losses',   label: 'Biggest Losses' },
  { id: 'rollers',  path: '/leaders/rollers',  label: 'High Rollers' },
];

export default function LeadersLayout({ children }) {
  const pathname = usePathname();
  const { user } = useBetting();

  return (
    <LeaderboardProvider user={user}>
      <div>
        <div className="material-tabs">
          {TABS.map(t => (
            <Link
              key={t.id}
              href={t.path}
              className={'material-tab' + (pathname === t.path ? ' active' : '')}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </LeaderboardProvider>
  );
}
