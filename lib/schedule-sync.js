export const FIFA_MATCHES_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200';

// FIFA abbreviations that differ from our data.js team codes.
export const TEAM_CODE_ALIAS = { KSA: 'SAU' };

function groupLetter(fifaMatch) {
  const g = fifaMatch.GroupName && fifaMatch.GroupName[0] && fifaMatch.GroupName[0].Description;
  return g ? g.replace('Group ', '').trim() : null;
}

// Pure: FIFA `Results` -> { schedule: [{id, kickoff_ts, fifa_id_stage}], unmatched: [...] }
// After the FIFA-IdMatch key migration, match_schedule.id IS the FIFA IdMatch, so no
// fuzzy team-code matching is needed. The upsert key is IdMatch directly.
export function mapFifaToSchedule(results) {
  const schedule = [];
  const unmatched = [];
  for (const x of results || []) {
    const group = groupLetter(x);
    if (!group) continue; // knockout / non-group row — skip for now
    const id = x.IdMatch ? String(x.IdMatch) : null;
    if (!id || !x.Date) {
      unmatched.push({ key: id || 'unknown', date: x.Date || null });
      continue;
    }
    schedule.push({
      id,
      kickoff_ts: x.Date,
      fifa_id_stage: x.IdStage ? String(x.IdStage) : null,
    });
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
