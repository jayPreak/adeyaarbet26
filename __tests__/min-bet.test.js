const { getMinBet } = require('../lib/currency');

describe('getMinBet', () => {
  test('group stage matches return 50 (no dash = group)', () => {
    expect(getMinBet('A1')).toBe(50);
    expect(getMinBet('L6')).toBe(50);
    expect(getMinBet('B3')).toBe(50);
    expect(getMinBet('F1')).toBe(50); // Group F match 1, NOT the Final
    expect(getMinBet('F6')).toBe(50);
  });

  test('R32 matches return 50', () => {
    expect(getMinBet('R32-1')).toBe(50);
    expect(getMinBet('R32-16')).toBe(50);
  });

  test('R16 matches return 100', () => {
    expect(getMinBet('R16-1')).toBe(100);
    expect(getMinBet('R16-8')).toBe(100);
  });

  test('QF matches return 200', () => {
    expect(getMinBet('QF-1')).toBe(200);
    expect(getMinBet('QF-4')).toBe(200);
  });

  test('SF matches return 300', () => {
    expect(getMinBet('SF-1')).toBe(300);
    expect(getMinBet('SF-2')).toBe(300);
  });

  test('Final (FIN-1) returns 500', () => {
    expect(getMinBet('FIN-1')).toBe(500);
  });

  test('3rd place (3RD-1) returns 500', () => {
    expect(getMinBet('3RD-1')).toBe(500);
  });

  test('null/undefined returns 50', () => {
    expect(getMinBet(null)).toBe(50);
    expect(getMinBet(undefined)).toBe(50);
  });

  test('specials (no dash) return 50', () => {
    expect(getMinBet('CUP_WINNER')).toBe(50);
    expect(getMinBet('MESSI_V_RONALDO')).toBe(50);
    expect(getMinBet('GOLDEN_BOOT')).toBe(50);
  });
});
