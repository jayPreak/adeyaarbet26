export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_NAME = 'Coins';

export function fmtMoney(n) {
  if (n == null) return '—';
  return CURRENCY_SYMBOL + Math.round(n).toLocaleString('en-IN');
}

export function fmtNet(n) {
  if (n == null) return '—';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-IN');
  return (n >= 0 ? '+' : '−') + CURRENCY_SYMBOL + abs;
}
