import { cupWinnerDeadlineFromKickoffs } from '@/lib/cup-winner';

describe('cupWinnerDeadlineFromKickoffs', () => {
  test('returns earliest kickoff minus 30s in epoch ms', () => {
    const rows = [
      { kickoff_ts: '2026-06-12T02:00:00Z' },
      { kickoff_ts: '2026-06-11T19:00:00Z' }, // earliest
      { kickoff_ts: '2026-06-13T01:00:00Z' },
    ];
    expect(cupWinnerDeadlineFromKickoffs(rows)).toBe(new Date('2026-06-11T18:59:30Z').getTime());
  });

  test('returns null for empty or missing rows', () => {
    expect(cupWinnerDeadlineFromKickoffs([])).toBeNull();
    expect(cupWinnerDeadlineFromKickoffs(null)).toBeNull();
    expect(cupWinnerDeadlineFromKickoffs(undefined)).toBeNull();
  });
});
