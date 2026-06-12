import { isMatchBettingOpen, getMatchKickoffTs, MATCH_BET_CUTOFF_MS } from '@/lib/data';

describe('getMatchKickoffTs', () => {
  test('returns epoch ms from ISO string', () => {
    const ts = getMatchKickoffTs({ kickoffTs: '2026-06-11T19:00:00+00:00' });
    expect(ts).toBe(new Date('2026-06-11T19:00:00+00:00').getTime());
  });

  test('returns epoch ms from numeric input', () => {
    const ts = getMatchKickoffTs({ kickoffTs: 1749664800000 });
    expect(ts).toBe(1749664800000);
  });

  test('returns null for missing kickoffTs', () => {
    expect(getMatchKickoffTs({})).toBeNull();
    expect(getMatchKickoffTs({ kickoffTs: null })).toBeNull();
  });

  test('returns null for unparseable value', () => {
    expect(getMatchKickoffTs({ kickoffTs: 'not-a-date' })).toBeNull();
  });
});

describe('isMatchBettingOpen', () => {
  test('returns false when kickoffTs is null (fail closed)', () => {
    expect(isMatchBettingOpen({})).toBe(false);
    expect(isMatchBettingOpen({ kickoffTs: null })).toBe(false);
  });

  test('returns true when well before kickoff', () => {
    const future = new Date(Date.now() + 3600000).toISOString(); // 1h from now
    expect(isMatchBettingOpen({ kickoffTs: future })).toBe(true);
  });

  test('returns false when past kickoff', () => {
    const past = new Date(Date.now() - 3600000).toISOString(); // 1h ago
    expect(isMatchBettingOpen({ kickoffTs: past })).toBe(false);
  });

  test('returns false exactly at cutoff (30s before kickoff)', () => {
    const kickoff = new Date(Date.now() + MATCH_BET_CUTOFF_MS).toISOString();
    expect(isMatchBettingOpen({ kickoffTs: kickoff })).toBe(false);
  });

  test('returns true just outside cutoff', () => {
    const kickoff = new Date(Date.now() + MATCH_BET_CUTOFF_MS + 1000).toISOString();
    expect(isMatchBettingOpen({ kickoffTs: kickoff })).toBe(true);
  });
});
