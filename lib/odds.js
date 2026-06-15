// Parimutuel (pool-based) odds.
//
// Unlike a bookmaker, we do not set odds up front. Odds are derived purely
// from how the friend group's money is split across sides, and they drift
// until kickoff — winners settle at the FINAL pool ratio, not the ratio shown
// when they bet. So everything here is a LIVE estimate, not a locked price.
//
//   decimal odds for a side = totalPool / moneyOnThatSide   (payout multiplier)
//   implied win probability = moneyOnThatSide / totalPool   (crowd's confidence)
//
// See CLAUDE.md "System Overview" — settlement uses this same ratio.

const SIDES = ['home', 'away', 'draw'];

// Hypothetical odds if `stake` were added to `side`. Pass stake=0 for the
// current live odds. Returns null when a side has no money (odds undefined).
export function sideOdds(pool, side, stake = 0) {
  const bySide = (pool && pool.bySide) || { home: 0, away: 0, draw: 0 };
  const sideTotal = (bySide[side] || 0) + stake;
  const total = (pool && pool.total ? pool.total : 0) + stake;
  if (sideTotal <= 0 || total <= 0) return null;
  return {
    decimal: total / sideTotal,                 // e.g. 2.5 → "2.5x"
    impliedProb: sideTotal / total,             // 0..1 → "40%"
  };
}

// Live odds for every side, keyed by side. Sides with no money map to null.
export function poolOdds(pool, stake = 0) {
  const out = {};
  for (const side of SIDES) out[side] = sideOdds(pool, side, stake);
  return out;
}

// "2.5x" style label. Empty pool on that side → em dash.
export function fmtDecimalOdds(odds) {
  if (!odds || !isFinite(odds.decimal)) return '—';
  return `${odds.decimal.toFixed(2)}x`;
}

// "40%" style label.
export function fmtImpliedProb(odds) {
  if (!odds || !isFinite(odds.impliedProb)) return '—';
  return `${Math.round(odds.impliedProb * 100)}%`;
}
