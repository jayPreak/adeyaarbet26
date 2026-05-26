'use client';

import { useState, useEffect } from 'react';
import CountdownSplash from './CountdownSplash';
import { KICKOFF_TS, DISMISSED_KEY } from '@/lib/countdown';

export { DISMISSED_KEY };

export default function CountdownGate({ children }) {
  const [showCountdown, setShowCountdown] = useState(null);

  useEffect(() => {
    const isBeforeKickoff = Date.now() < KICKOFF_TS;
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    setShowCountdown(isBeforeKickoff && !isDismissed);
  }, []);

  const handleEnter = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setShowCountdown(false);
  };

  // null = hydration pending — render nothing to avoid flash
  if (showCountdown === null) return null;
  if (showCountdown) return <CountdownSplash onEnter={handleEnter} />;
  return children;
}
