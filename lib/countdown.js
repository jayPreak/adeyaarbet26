// FIFA World Cup 2026 opener — Estadio Azteca, Mexico City
// June 11, 2026 · 13:00 CDMX (UTC-6) = 19:00 UTC = 12:30 AM IST Jun 12
export const KICKOFF_TS = new Date('2026-06-11T19:00:00Z').getTime();

export const DISMISSED_KEY = 'adeyaar_countdown_dismissed';

export const pad = (n) => String(n).padStart(2, '0');

export function computeTimeLeft(targetTs) {
  const diff = Math.max(0, targetTs - Date.now());
  return {
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
    done:  diff === 0,
    diff,
  };
}
