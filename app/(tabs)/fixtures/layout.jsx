'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useBetting } from '@/lib/BettingContext';
import { useMemo } from 'react';

export default function FixturesLayout({ children }) {
  const pathname = usePathname();
  const { matches } = useBetting();

  const { upcomingCount, completedCount } = useMemo(() => {
    let up = 0, done = 0;
    for (const m of matches) {
      if (m.status === 'finished') done++;
      else up++;
    }
    return { upcomingCount: up, completedCount: done };
  }, [matches]);

  const hasLive = matches.some(m => m.status === 'live');

  return (
    <div>
      <div className="material-tabs">
        <Link
          href="/fixtures/upcoming"
          className={'material-tab' + (pathname === '/fixtures/upcoming' ? ' active' : '')}
        >
          {hasLive ? 'Upcoming / Live' : 'Upcoming'} ({upcomingCount})
        </Link>
        <Link
          href="/fixtures/completed"
          className={'material-tab' + (pathname === '/fixtures/completed' ? ' active' : '')}
        >
          Completed ({completedCount})
        </Link>
      </div>
      {children}
    </div>
  );
}
