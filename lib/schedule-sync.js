import { MATCHES } from '@/lib/data';

export const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';

// FIFA abbreviations that differ from our data.js team codes.
export const TEAM_CODE_ALIAS = { KSA: 'SAU' };

const GROUP_STAGE_ID = '289273';
const KNOCKOUT_STAGE_MAP = {
  '289287': 'R32',
  '289288': 'R16',
  '289289': 'QF',
  '289290': 'SF',
  '289291': '3RD',
  '289292': 'FIN',
};
const KNOCKOUT_STAGE_COUNTS = { R32: 16, R16: 8, QF: 4, SF: 2, FIN: 1, '3RD': 1 };

// Build a `${group}|${home}|${away}` -> data.js id lookup from our match identity.
function buildLookup() {
  const lookup = {};
  for (const m of MATCHES) lookup[`${m.group}|${m.home}|${m.away}`] = m.id;
  return lookup;
}

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName && fifaMatch.GroupName[0] && fifaMatch.GroupName[0].Description;
  return g ? g.replace('Group ', '').trim() : null;
}

function teamCode(team) {
  const c = team && team.Abbreviation;
  return (c && TEAM_CODE_ALIAS[c]) || c;
}

function mapKnockoutMatches(results) {
  const knockoutByStage = {};
  for (const x of results || []) {
    const stage = KNOCKOUT_STAGE_MAP[x.IdStage];
    if (!stage || !x.Date) continue;
    if (!knockoutByStage[stage]) knockoutByStage[stage] = [];
    knockoutByStage[stage].push(x);
  }

  const schedule = [];
  for (const [stage, matches] of Object.entries(knockoutByStage)) {
    matches.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    for (let i = 0; i < matches.length; i++) {
      schedule.push({
        id: `${stage}-${i + 1}`,
        kickoff_ts: matches[i].Date,
        fifa_id_stage: matches[i].IdStage ? String(matches[i].IdStage) : null,
      });
    }
  }
  return schedule;
}

// Pure: FIFA `Results` -> { schedule: [{id, kickoff_ts}], unmatched: [...] }
export function mapFifaToSchedule(results, lookup = buildLookup()) {
  const schedule = [];
  const unmatched = [];
  for (const x of results || []) {
    if (x.IdStage && x.IdStage !== GROUP_STAGE_ID) continue;
    const group = groupLetter(x);
    if (!group) continue;
    const key = `${group}|${teamCode(x.Home)}|${teamCode(x.Away)}`;
    const id = lookup[key];
    if (!id || !x.Date) {
      unmatched.push({ key, date: x.Date || null });
      continue;
    }
    schedule.push({
      id,
      kickoff_ts: x.Date,
      fifa_id_stage: x.IdStage ? String(x.IdStage) : null,
    });
  }

  const knockoutSchedule = mapKnockoutMatches(results);
  schedule.push(...knockoutSchedule);

  return { schedule, unmatched };
}

// Async: fetch + normalize. Fail-safe — empty schedule on any failure so callers
// never wipe good data with a bad fetch.
export async function getScheduleFromFifa(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(FIFA_MATCHES_URL);
    if (!res.ok) return { schedule: [], unmatched: [], error: `FIFA API ${res.status}` };
    const data = await res.json();
    return mapFifaToSchedule(data.Results || []);
  } catch (e) {
    return { schedule: [], unmatched: [], error: String(e && e.message ? e.message : e) };
  }
}
