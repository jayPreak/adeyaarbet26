export const CURRENCY_SYMBOL = '₹'; // ₹
export const CURRENCY_NAME = 'Coins';
export const STARTING_BALANCE = 5000;

export function fmtMoney(n) {
  if (n == null) return '—';
  return CURRENCY_SYMBOL + Math.round(n).toLocaleString('en-IN');
}
