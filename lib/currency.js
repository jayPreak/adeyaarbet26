export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_NAME = 'Coins';
export const MAX_BET = 10000;

// Stage-based minimum bets (match bets only, not specials)
// Knockout IDs all use dashes: R32-1, R16-1, QF-1, SF-1, FIN-1
// Group stage IDs have no dash: A1, B3, F6, etc.
const STAGE_MINIMUMS = {
  R32: 50,
  R16: 100,
  QF: 250,
  SF: 350,
  FIN: 1000,
  '3RD': 350,
};

export function getMinBet(matchId) {
  if (!matchId || !matchId.includes('-')) return 50;
  const prefix = matchId.split('-')[0];
  return STAGE_MINIMUMS[prefix] || 50;
}

export function fmtMoney(n) {
  if (n == null) return '—';
  return CURRENCY_SYMBOL + Math.round(n).toLocaleString('en-IN');
}

export function fmtNet(n) {
  if (n == null) return '—';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-IN');
  return (n >= 0 ? '+' : '−') + CURRENCY_SYMBOL + abs;
}
