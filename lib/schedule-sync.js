import { MATCHES } from '@/lib/data';

export const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';

// FIFA abbreviations that differ from our data.js team codes.
export const TEAM_CODE_ALIAS = { KSA: 'SAU' };

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

// Pure: FIFA `Results` -> { schedule: [{id, kickoff_ts}], unmatched: [...] }
export function mapFifaToSchedule(results, lookup = buildLookup()) {
  const schedule = [];
  const unmatched = [];
  for (const x of results || []) {
    const group = groupLetter(x);
    if (!group) continue; // knockout / non-group row — out of scope
    const key = `${group}|${teamCode(x.Home)}|${teamCode(x.Away)}`;
    const id = lookup[key];
    if (!id || !x.Date) {
      unmatched.push({ key, date: x.Date || null });
      continue;
    }
    schedule.push({ id, kickoff_ts: x.Date });
  }
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
