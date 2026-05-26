'use client';

import { useState, useEffect } from 'react';
import CountdownSplash from './CountdownSplash';
import { KICKOFF_TS } from '@/lib/countdown';

export default function CountdownGate({ children }) {
  const [showCountdown, setShowCountdown] = useState(null);

  useEffect(() => {
    setShowCountdown(Date.now() < KICKOFF_TS);
  }, []);

  // null = hydration pending — render nothing to avoid flash
  if (showCountdown === null) return null;
  if (showCountdown) return <CountdownSplash onEnter={() => setShowCountdown(false)} />;
  return children;
}
