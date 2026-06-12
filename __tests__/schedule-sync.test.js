import { mapFifaToSchedule, TEAM_CODE_ALIAS } from '@/lib/schedule-sync';

const gm = (group, home, away, date) => ({
  GroupName: [{ Locale: 'en-GB', Description: `Group ${group}` }],
  Home: { Abbreviation: home },
  Away: { Abbreviation: away },
  Date: date,
});

describe('mapFifaToSchedule', () => {
  test('maps the opener to A1 with its UTC kickoff', () => {
    const { schedule } = mapFifaToSchedule([gm('A', 'MEX', 'RSA', '2026-06-11T19:00:00Z')]);
    expect(schedule).toContainEqual(expect.objectContaining({ id: 'A1', kickoff_ts: '2026-06-11T19:00:00Z' }));
  });

  test('applies the KSA -> SAU alias (Saudi Arabia, data.js H2 = SAU v URU)', () => {
    const { schedule } = mapFifaToSchedule([gm('H', 'KSA', 'URU', '2026-06-15T22:00:00Z')]);
    expect(schedule).toContainEqual(expect.objectContaining({ id: 'H2', kickoff_ts: '2026-06-15T22:00:00Z' }));
    expect(TEAM_CODE_ALIAS.KSA).toBe('SAU');
  });

  test('puts unknown matchups in unmatched, not schedule', () => {
    const { schedule, unmatched } = mapFifaToSchedule([gm('A', 'XXX', 'YYY', '2026-06-11T19:00:00Z')]);
    expect(schedule).toEqual([]);
    expect(unmatched).toHaveLength(1);
  });

  test('skips knockout matches (no GroupName)', () => {
    const ko = { GroupName: null, Home: { Abbreviation: 'W1' }, Away: { Abbreviation: 'W2' }, Date: '2026-07-01T19:00:00Z' };
    const { schedule, unmatched } = mapFifaToSchedule([ko]);
    expect(schedule).toEqual([]);
    expect(unmatched).toEqual([]);
  });

  test('a row missing Date is unmatched, never written', () => {
    const { schedule, unmatched } = mapFifaToSchedule([gm('A', 'MEX', 'RSA', null)]);
    expect(schedule).toEqual([]);
    expect(unmatched).toHaveLength(1);
  });
});
