import { KICKOFF_TS, DISMISSED_KEY, pad, computeTimeLeft } from '@/lib/countdown';

// ── Constants ──────────────────────────────────────────────────

describe('KICKOFF_TS', () => {
  test('is a positive number', () => {
    expect(typeof KICKOFF_TS).toBe('number');
    expect(KICKOFF_TS).toBeGreaterThan(0);
  });

  test('is on or after June 11, 2026', () => {
    expect(KICKOFF_TS).toBeGreaterThanOrEqual(new Date('2026-06-11').getTime());
  });

  test('is before June 13, 2026 (opener 19:00 UTC June 11)', () => {
    expect(KICKOFF_TS).toBeLessThan(new Date('2026-06-13').getTime());
  });
});

describe('DISMISSED_KEY', () => {
  test('is a non-empty string', () => {
    expect(typeof DISMISSED_KEY).toBe('string');
    expect(DISMISSED_KEY.length).toBeGreaterThan(0);
  });
});

// ── Gate visibility logic ──────────────────────────────────────

describe('countdown gate visibility logic', () => {
  const original = Date.now;
  afterEach(() => { Date.now = original; });

  const shouldShow = (offsetMs, dismissed) => {
    Date.now = () => KICKOFF_TS + offsetMs;
    const isBeforeKickoff = Date.now() < KICKOFF_TS;
    return isBeforeKickoff && !dismissed;
  };

  test('shows 1 day before kickoff, not dismissed', () => {
    expect(shouldShow(-86400000, false)).toBe(true);
  });

  test('hidden if dismissed even before kickoff', () => {
    expect(shouldShow(-86400000, true)).toBe(false);
  });

  test('hidden at exact kickoff moment', () => {
    expect(shouldShow(0, false)).toBe(false);
  });

  test('hidden 1 second after kickoff', () => {
    expect(shouldShow(1000, false)).toBe(false);
  });

  test('hidden 1 week after kickoff', () => {
    expect(shouldShow(7 * 86400000, false)).toBe(false);
  });
});

// ── computeTimeLeft ────────────────────────────────────────────

describe('computeTimeLeft', () => {
  const original = Date.now;
  afterEach(() => { Date.now = original; });

  test('decomposes 1d 2h 3m 4s correctly', () => {
    const target = 1000000000;
    const diff = 86400000 + 7200000 + 180000 + 4000;
    Date.now = () => target - diff;
    const { days, hours, mins, secs } = computeTimeLeft(target);
    expect(days).toBe(1);
    expect(hours).toBe(2);
    expect(mins).toBe(3);
    expect(secs).toBe(4);
  });

  test('done is true when at target', () => {
    Date.now = () => KICKOFF_TS;
    expect(computeTimeLeft(KICKOFF_TS).done).toBe(true);
  });

  test('done is false before target', () => {
    Date.now = () => KICKOFF_TS - 1000;
    expect(computeTimeLeft(KICKOFF_TS).done).toBe(false);
  });

  test('diff clamps to 0 past target', () => {
    Date.now = () => KICKOFF_TS + 5000;
    const { diff, done, days, hours, mins, secs } = computeTimeLeft(KICKOFF_TS);
    expect(diff).toBe(0);
    expect(done).toBe(true);
    expect(days).toBe(0);
    expect(hours).toBe(0);
    expect(mins).toBe(0);
    expect(secs).toBe(0);
  });

  test('hours do not bleed into days (23h case)', () => {
    const target = 1000000000;
    Date.now = () => target - 23 * 3600000;
    const { days, hours } = computeTimeLeft(target);
    expect(days).toBe(0);
    expect(hours).toBe(23);
  });

  test('secs do not bleed into mins (59s case)', () => {
    const target = 1000000000;
    Date.now = () => target - 59000;
    const { mins, secs } = computeTimeLeft(target);
    expect(mins).toBe(0);
    expect(secs).toBe(59);
  });
});

// ── pad helper ─────────────────────────────────────────────────

describe('pad', () => {
  test('pads single-digit with leading zero', () => {
    expect(pad(0)).toBe('00');
    expect(pad(5)).toBe('05');
    expect(pad(9)).toBe('09');
  });

  test('does not pad two-digit numbers', () => {
    expect(pad(10)).toBe('10');
    expect(pad(59)).toBe('59');
  });
});
