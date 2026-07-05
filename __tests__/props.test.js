import {
  SCORELINE_OPTIONS, scorelineBucket, formatScorelinePick,
  overUnderPick, formatOverUnderPick, OU_LINE,
  pensPick, formatPensPick,
  formatTotalGoalsPick, TOTAL_GOALS_LINE,
} from '@/lib/props';

describe('scoreline market', () => {
  test('has 16 exact scores plus 3 catch-all buckets', () => {
    expect(SCORELINE_OPTIONS).toHaveLength(19);
    expect(SCORELINE_OPTIONS).toContain('0-0');
    expect(SCORELINE_OPTIONS).toContain('3-3');
    expect(SCORELINE_OPTIONS).toContain('other_home');
    expect(SCORELINE_OPTIONS).toContain('other_away');
    expect(SCORELINE_OPTIONS).toContain('other_draw');
  });

  test('exact scores map to themselves', () => {
    expect(scorelineBucket(0, 0)).toBe('0-0');
    expect(scorelineBucket(2, 1)).toBe('2-1');
    expect(scorelineBucket(3, 3)).toBe('3-3');
    expect(scorelineBucket(0, 3)).toBe('0-3');
  });

  test('high scores fall into catch-all buckets', () => {
    expect(scorelineBucket(4, 0)).toBe('other_home');
    expect(scorelineBucket(5, 4)).toBe('other_home');
    expect(scorelineBucket(1, 4)).toBe('other_away');
    expect(scorelineBucket(4, 4)).toBe('other_draw');
    expect(scorelineBucket(5, 5)).toBe('other_draw');
  });

  test('every possible score maps to a listed option', () => {
    for (let h = 0; h <= 8; h++) {
      for (let a = 0; a <= 8; a++) {
        expect(SCORELINE_OPTIONS).toContain(scorelineBucket(h, a));
      }
    }
  });

  test('null scores → null (no settlement)', () => {
    expect(scorelineBucket(null, 2)).toBeNull();
    expect(scorelineBucket(2, null)).toBeNull();
    expect(scorelineBucket(null, null)).toBeNull();
  });

  test('formatScorelinePick labels buckets with team names', () => {
    expect(formatScorelinePick('2-1')).toBe('2-1');
    expect(formatScorelinePick('other_home', 'BRA', 'FRA')).toBe('Any other BRA win');
    expect(formatScorelinePick('other_away', 'BRA', 'FRA')).toBe('Any other FRA win');
    expect(formatScorelinePick('other_draw')).toContain('draw');
  });
});

describe('over/under market', () => {
  test('line is 2.5', () => {
    expect(OU_LINE).toBe(2.5);
  });

  test('total > 2.5 → over, otherwise under', () => {
    expect(overUnderPick(0, 0)).toBe('under');
    expect(overUnderPick(1, 1)).toBe('under');
    expect(overUnderPick(2, 1)).toBe('over');
    expect(overUnderPick(0, 3)).toBe('over');
    expect(overUnderPick(5, 4)).toBe('over');
  });

  test('null scores → null', () => {
    expect(overUnderPick(null, 1)).toBeNull();
    expect(overUnderPick(1, null)).toBeNull();
  });

  test('formatting', () => {
    expect(formatOverUnderPick('over')).toBe('Over 2.5 goals');
    expect(formatOverUnderPick('under')).toBe('Under 2.5 goals');
    expect(formatOverUnderPick('weird')).toBe('weird');
  });
});

describe('pens market', () => {
  test('maps shootout flag to yes/no', () => {
    expect(pensPick(true)).toBe('yes');
    expect(pensPick(false)).toBe('no');
  });

  test('formatting', () => {
    expect(formatPensPick('yes')).toContain('penalties');
    expect(formatPensPick('no')).toContain('before penalties');
  });
});

describe('total tournament goals', () => {
  test('line and formatting', () => {
    expect(TOTAL_GOALS_LINE).toBe(248.5);
    expect(formatTotalGoalsPick('over')).toBe('Over 248.5 goals');
    expect(formatTotalGoalsPick('under')).toBe('Under 248.5 goals');
  });
});
