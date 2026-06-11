# Schedule Sync + Bet Cutoffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `match_schedule` (Postgres, fed from the official FIFA API) the single source of kickoff times for BOTH backend bet enforcement and frontend display, so cup-winner betting closes 30s before the first match (12:29:30 AM IST Jun 12) and every match closes 30s before its real kickoff.

**Architecture:** A pure normalizer maps the FIFA API's group matches onto our `A1`–`L6` IDs (alias `KSA→SAU`) and returns UTC times. An admin route upserts them into `match_schedule` (manual, re-run on changes). A migration makes `cup_winner_deadline()` derive from the table and re-seeds correct times. The frontend stops embedding times in `data.js`; it fetches them from a cached `GET /api/schedule` and merges them onto the static match identity (same pattern as the existing live-score merge). `data.js` keeps identity only (teams, venue, group, bracket).

**Tech Stack:** Next.js App Router route handlers, Supabase (Postgres + supabase-js), Jest (node env, `@/`→rootDir), plain ESM JS.

---

## File Structure

- **Create** `lib/schedule-sync.js` — FIFA URL, `TEAM_CODE_ALIAS`, pure `mapFifaToSchedule`, async `getScheduleFromFifa`.
- **Create** `__tests__/schedule-sync.test.js` — normalizer unit tests.
- **Create** `app/api/sync-schedule/route.js` — admin POST: FIFA → upsert `match_schedule` (fail-safe).
- **Create** `app/api/schedule/route.js` — cached GET: `{schedule:{id:ts}, cupWinnerDeadlineTs}` for the frontend.
- **Create** `supabase/migrations/011_schedule_from_fifa.sql` — derived `cup_winner_deadline()` + re-seed 72 correct times.
- **Modify** `lib/data.js` — remove `date`/`time` from `MATCHES`; `getMatchKickoffTs`/`isMatchBettingOpen` use `match.kickoffTs`.
- **Modify** `components/AdeYaarApp.jsx` — fetch `/api/schedule`, merge `kickoffTs`/`date`/`time` onto matches.
- **Modify** `app/api/search/route.js` — attach `kickoff_ts` from `match_schedule` so search keeps its date label.
- **Modify** `app/api/cup-winner-bet/route.js` — return DB-derived `deadlineTs` (already returns one; repoint to DB).
- **Modify** `components/CupWinnerBetModal.jsx` — use `deadlineTs` prop from the API; copy "30s before kickoff".
- **Modify** `lib/cup-winner.js` — drop `CUP_WINNER_DEADLINE_TS` constant (DB is source).
- **Modify** `lib/countdown.js:3` — `KICKOFF_TS` → real opener `2026-06-11T19:00:00Z` (splash fallback only).
- **Modify** `__tests__/countdown.test.js:15` — tidy stale comment.

---

## Task 1: FIFA → schedule normalizer

**Files:**
- Create: `lib/schedule-sync.js`
- Test: `__tests__/schedule-sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/schedule-sync.test.js
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
    expect(schedule).toContainEqual({ id: 'A1', kickoff_ts: '2026-06-11T19:00:00Z' });
  });

  test('applies the KSA -> SAU alias (Saudi Arabia, data.js H2 = SAU v URU)', () => {
    const { schedule } = mapFifaToSchedule([gm('H', 'KSA', 'URU', '2026-06-15T22:00:00Z')]);
    expect(schedule).toContainEqual({ id: 'H2', kickoff_ts: '2026-06-15T22:00:00Z' });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest schedule-sync -i`
Expected: FAIL — "Cannot find module '@/lib/schedule-sync'".

- [ ] **Step 3: Write minimal implementation**

```js
// lib/schedule-sync.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest schedule-sync -i`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/schedule-sync.js __tests__/schedule-sync.test.js
git commit -m "feat: add FIFA API -> match_schedule normalizer"
```

---

## Task 2: Migration — derived deadline + re-seed correct times

**Files:**
- Create: `supabase/migrations/011_schedule_from_fifa.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 011: Source the schedule from the official FIFA API; single source of times.
-- 1. cup_winner_deadline() derives from the earliest scheduled match (−30s).
-- 2. Re-seed match_schedule with verified FIFA UTC times. place_bet already
--    enforces kickoff_ts − 30s, so per-match cutoffs become correct.

CREATE OR REPLACE FUNCTION public.cup_winner_deadline() RETURNS timestamptz AS $$
  SELECT MIN(kickoff_ts) - interval '30 seconds' FROM public.match_schedule
$$ LANGUAGE sql STABLE;

INSERT INTO public.match_schedule (id, kickoff_ts) VALUES
  ('A1', '2026-06-11T19:00:00Z'),
  ('A2', '2026-06-12T02:00:00Z'),
  ('A3', '2026-06-18T16:00:00Z'),
  ('A4', '2026-06-19T01:00:00Z'),
  ('A5', '2026-06-25T01:00:00Z'),
  ('A6', '2026-06-25T01:00:00Z'),
  ('B1', '2026-06-12T19:00:00Z'),
  ('B2', '2026-06-13T19:00:00Z'),
  ('B3', '2026-06-18T19:00:00Z'),
  ('B4', '2026-06-18T22:00:00Z'),
  ('B5', '2026-06-24T19:00:00Z'),
  ('B6', '2026-06-24T19:00:00Z'),
  ('C1', '2026-06-14T01:00:00Z'),
  ('C2', '2026-06-13T22:00:00Z'),
  ('C3', '2026-06-20T00:30:00Z'),
  ('C4', '2026-06-19T22:00:00Z'),
  ('C5', '2026-06-24T22:00:00Z'),
  ('C6', '2026-06-24T22:00:00Z'),
  ('D1', '2026-06-13T01:00:00Z'),
  ('D2', '2026-06-14T04:00:00Z'),
  ('D3', '2026-06-19T19:00:00Z'),
  ('D4', '2026-06-20T03:00:00Z'),
  ('D5', '2026-06-26T02:00:00Z'),
  ('D6', '2026-06-26T02:00:00Z'),
  ('E1', '2026-06-14T17:00:00Z'),
  ('E2', '2026-06-14T23:00:00Z'),
  ('E3', '2026-06-20T20:00:00Z'),
  ('E4', '2026-06-21T00:00:00Z'),
  ('E5', '2026-06-25T20:00:00Z'),
  ('E6', '2026-06-25T20:00:00Z'),
  ('F1', '2026-06-15T02:00:00Z'),
  ('F2', '2026-06-14T20:00:00Z'),
  ('F3', '2026-06-20T17:00:00Z'),
  ('F4', '2026-06-21T04:00:00Z'),
  ('F5', '2026-06-25T23:00:00Z'),
  ('F6', '2026-06-25T23:00:00Z'),
  ('G1', '2026-06-15T19:00:00Z'),
  ('G2', '2026-06-16T01:00:00Z'),
  ('G3', '2026-06-21T19:00:00Z'),
  ('G4', '2026-06-22T01:00:00Z'),
  ('G5', '2026-06-27T03:00:00Z'),
  ('G6', '2026-06-27T03:00:00Z'),
  ('H1', '2026-06-15T16:00:00Z'),
  ('H2', '2026-06-15T22:00:00Z'),
  ('H3', '2026-06-21T16:00:00Z'),
  ('H4', '2026-06-21T22:00:00Z'),
  ('H5', '2026-06-27T00:00:00Z'),
  ('H6', '2026-06-27T00:00:00Z'),
  ('I1', '2026-06-16T19:00:00Z'),
  ('I2', '2026-06-16T22:00:00Z'),
  ('I3', '2026-06-22T21:00:00Z'),
  ('I4', '2026-06-23T00:00:00Z'),
  ('I5', '2026-06-26T19:00:00Z'),
  ('I6', '2026-06-26T19:00:00Z'),
  ('J1', '2026-06-17T01:00:00Z'),
  ('J2', '2026-06-17T04:00:00Z'),
  ('J3', '2026-06-22T17:00:00Z'),
  ('J4', '2026-06-23T03:00:00Z'),
  ('J5', '2026-06-28T02:00:00Z'),
  ('J6', '2026-06-28T02:00:00Z'),
  ('K1', '2026-06-18T02:00:00Z'),
  ('K2', '2026-06-17T17:00:00Z'),
  ('K3', '2026-06-24T02:00:00Z'),
  ('K4', '2026-06-23T17:00:00Z'),
  ('K5', '2026-06-27T23:30:00Z'),
  ('K6', '2026-06-27T23:30:00Z'),
  ('L1', '2026-06-17T20:00:00Z'),
  ('L2', '2026-06-17T23:00:00Z'),
  ('L3', '2026-06-23T20:00:00Z'),
  ('L4', '2026-06-23T23:00:00Z'),
  ('L5', '2026-06-27T21:00:00Z'),
  ('L6', '2026-06-27T21:00:00Z')
ON CONFLICT (id) DO UPDATE SET kickoff_ts = EXCLUDED.kickoff_ts;
```

- [ ] **Step 2: Apply the migration**

Run: `SUPABASE_DB_PASSWORD='74HnD*BcjH_ZD!5' supabase db push`
Expected: migration `011` applied.

- [ ] **Step 3: Verify the deadline**

Run (SQL): `SELECT public.cup_winner_deadline();`
Expected: `2026-06-11 18:59:30+00` (= 12:29:30 AM IST, Jun 12).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_schedule_from_fifa.sql
git commit -m "feat: derive cup-winner deadline from schedule, re-seed FIFA times"
```

---

## Task 3: Admin sync route (write)

**Files:**
- Create: `app/api/sync-schedule/route.js`

- [ ] **Step 1: Write the route**

```js
// app/api/sync-schedule/route.js
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { getScheduleFromFifa } from '@/lib/schedule-sync';

// POST /api/sync-schedule { secret }
// Pulls kickoff times from the FIFA API and upserts match_schedule.
// Run manually; re-run when the real schedule changes.
export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const adminSecret = process.env.ADMIN_SECRET || 'adeyaar-topup-2026';
  if (body.secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { schedule, unmatched, error } = await getScheduleFromFifa();
  if (error || schedule.length === 0) {
    return NextResponse.json(
      { error: error || 'No matches returned; nothing written', unmatched },
      { status: 502 }
    );
  }

  const { error: dbErr } = await supabaseAdmin
    .from('match_schedule')
    .upsert(schedule, { onConflict: 'id' });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ updated: schedule.length, unmatched });
}
```

- [ ] **Step 2: Lint**

Run: `npx next lint --file app/api/sync-schedule/route.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/sync-schedule/route.js
git commit -m "feat: add /api/sync-schedule (FIFA -> match_schedule)"
```

---

## Task 4: Schedule read endpoint

**Files:**
- Create: `app/api/schedule/route.js`

- [ ] **Step 1: Write the route**

Uses the shared anon client `@/lib/supabase` (RLS already allows public SELECT on `match_schedule`).

```js
// app/api/schedule/route.js
import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export const revalidate = 300; // seconds — display only; enforcement is server-side

// GET /api/schedule -> { schedule: { "A1": "<iso>", ... }, cupWinnerDeadlineTs: <ms|null> }
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null });
  }
  const { data, error } = await supabase.from('match_schedule').select('id, kickoff_ts');
  if (error) {
    return NextResponse.json({ schedule: {}, cupWinnerDeadlineTs: null }, { status: 500 });
  }
  const schedule = {};
  let minTs = Infinity;
  for (const row of data) {
    schedule[row.id] = row.kickoff_ts;
    const ms = new Date(row.kickoff_ts).getTime();
    if (ms < minTs) minTs = ms;
  }
  const cupWinnerDeadlineTs = Number.isFinite(minTs) ? minTs - 30 * 1000 : null;
  return NextResponse.json({ schedule, cupWinnerDeadlineTs });
}
```

- [ ] **Step 2: Verify against the DB**

Run (dev server up): `curl -s http://localhost:3000/api/schedule | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('A1=',j.schedule.A1,'deadlineTs=',new Date(j.cupWinnerDeadlineTs).toISOString())})"`
Expected: `A1= 2026-06-11T19:00:00+00:00 deadlineTs= 2026-06-11T18:59:30.000Z`.

- [ ] **Step 3: Commit**

```bash
git add app/api/schedule/route.js
git commit -m "feat: add GET /api/schedule (DB times + cup-winner deadline)"
```

---

## Task 5: Frontend single-source merge

**Files:**
- Modify: `lib/data.js` (remove `date`/`time` from `MATCHES`; update helpers)
- Modify: `components/AdeYaarApp.jsx`
- Modify: `app/api/search/route.js`

- [ ] **Step 1: Strip `date`/`time` from every MATCHES row**

These are now sourced from the DB. Run this in-repo codemod (removes `date:'…', time:'…', ` from the 72 match lines only — the pattern matches nowhere else):

```bash
node -e '
const fs=require("fs");
const p="lib/data.js";
let s=fs.readFileSync(p,"utf8");
const before=(s.match(/date:'\''[\d-]+'\'', time:'\''[\d:]+'\'', /g)||[]).length;
s=s.replace(/date:'\''[\d-]+'\'', time:'\''[\d:]+'\'', /g,"");
fs.writeFileSync(p,s);
console.log("stripped date/time from",before,"rows (expect 72)");
'
```
Expected: `stripped date/time from 72 rows (expect 72)`. A `MATCHES` row now reads:
`{ id: 'A1', group:'A', md:1, venue: VENUE.AZT,   home:'MEX', away:'RSA' },`

- [ ] **Step 2: Update the time helpers in `lib/data.js`**

Replace `getMatchKickoffTs` (lines ~293-296) and `isMatchBettingOpen` (lines ~299-303):

OLD:
```js
export function getMatchKickoffTs(idOrMatch) {
  const m = typeof idOrMatch === 'string' ? getMatch(idOrMatch) : idOrMatch;
  if (!m) return null;
  return Date.parse(`${m.date}T${m.time}:00Z`);
}
export const MATCH_BET_CUTOFF_MS = 30 * 1000;
export function isMatchBettingOpen(match, now = Date.now()) {
  const ts = getMatchKickoffTs(match);
  if (ts == null) return false;
  return now < ts - MATCH_BET_CUTOFF_MS;
}
```
NEW:
```js
// Kickoff time comes from the DB (match_schedule via /api/schedule), merged onto
// the match object as `kickoffTs` (ms). Static data.js no longer carries times.
export function getMatchKickoffTs(idOrMatch) {
  const m = typeof idOrMatch === 'string' ? getMatch(idOrMatch) : idOrMatch;
  if (!m || m.kickoffTs == null) return null;
  return m.kickoffTs;
}
export const MATCH_BET_CUTOFF_MS = 30 * 1000;
export function isMatchBettingOpen(match, now = Date.now()) {
  const ts = getMatchKickoffTs(match);
  if (ts == null) return false; // schedule not loaded yet — fail safe (closed)
  return now < ts - MATCH_BET_CUTOFF_MS;
}
```

- [ ] **Step 3: Merge DB times in `AdeYaarApp.jsx`**

Add schedule state + fetch next to the existing FIFA fetch (around lines 148-153), and apply the
merge where `matches` is built (line 180).

Add state near the other `useState` hooks:
```js
const [scheduleMap, setScheduleMap] = useState({});
```

Add the fetch effect next to the FIFA one:
```js
useEffect(() => {
  fetch('/api/schedule')
    .then(r => r.json())
    .then(d => setScheduleMap(d.schedule || {}))
    .catch(() => {});
}, []);
```

Add a merge helper near `mergeWithFifa` (after line ~78):
```js
// Single source of times: stamp kickoffTs + derived UTC date/time from the DB schedule.
function withSchedule(match, scheduleMap) {
  const iso = scheduleMap[match.id];
  if (!iso) return match;
  const d = new Date(iso);
  return {
    ...match,
    kickoffTs: d.getTime(),
    date: d.toISOString().slice(0, 10), // YYYY-MM-DD (UTC) — same shape the UI formats
    time: d.toISOString().slice(11, 16), // HH:MM (UTC)
  };
}
```

Change the `matches` build (line 180):
OLD: `  const matches = MATCHES.map(m => mergeWithFifa(m, fifaData));`
NEW: `  const matches = MATCHES.map(m => withSchedule(mergeWithFifa(m, fifaData), scheduleMap));`

- [ ] **Step 4: Keep search results' date label (`app/api/search/route.js`)**

The search route uses `MATCHES` server-side; rows no longer have `date`. Attach `kickoff_ts` from
`match_schedule` and derive `date` for matched rows.

After the existing `const matchResults = MATCHES.filter(...)` block, before building the response,
add a lookup and stamp `date` (UTC) onto each result:
```js
import supabase from '@/lib/supabase';
// ...inside the handler, after computing matchResults:
let scheduleMap = {};
if (supabase && matchResults.length) {
  const { data } = await supabase
    .from('match_schedule')
    .select('id, kickoff_ts')
    .in('id', matchResults.map(m => m.id));
  for (const row of data || []) scheduleMap[row.id] = row.kickoff_ts;
}
const matchResultsWithDate = matchResults.map(m => ({
  ...m,
  date: scheduleMap[m.id] ? new Date(scheduleMap[m.id]).toISOString().slice(0, 10) : null,
}));
```
Then return `matchResultsWithDate` wherever `matchResults` was returned. (If the route is not
`async`, make the exported handler `async`.)

- [ ] **Step 5: Run the suite + manual smoke**

Run: `npm test`
Expected: all pass (the merge keeps `match.date`/`match.time` shape, so `countdown`/`ledger`/`settlement`/`schedule-sync` are unaffected).

Manual (dev server + DB synced): open the app, confirm the Fixtures screen shows the corrected
times (e.g. CAN v BIH on Jun 13 12:30 AM IST, not Jun 13 4:30 AM) and that betting on a started
match shows closed.

- [ ] **Step 6: Commit**

```bash
git add lib/data.js components/AdeYaarApp.jsx app/api/search/route.js
git commit -m "refactor: source match times from DB on the frontend (single source)"
```

---

## Task 6: Cup-winner deadline from DB + display copy

**Files:**
- Modify: `app/api/cup-winner-bet/route.js`
- Modify: `components/CupWinnerBetModal.jsx`
- Modify: `lib/cup-winner.js`
- Modify: `lib/countdown.js`, `__tests__/countdown.test.js`

- [ ] **Step 1: Return a DB-derived deadline from the cup-winner route**

In `app/api/cup-winner-bet/route.js`, the GET response currently includes
`deadlineTs: CUP_WINNER_DEADLINE_TS`. Compute it from `match_schedule` instead.

Remove the `import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';` usage for the deadline and
add a helper that reads the min kickoff:
```js
async function getCupWinnerDeadlineTs() {
  if (!supabase) return null;
  const { data } = await supabase.from('match_schedule').select('kickoff_ts');
  if (!data || !data.length) return null;
  const min = Math.min(...data.map(r => new Date(r.kickoff_ts).getTime()));
  return min - 30 * 1000;
}
```
Replace both `deadlineTs: CUP_WINNER_DEADLINE_TS` occurrences (the no-DB early return and the main
response) with `deadlineTs: await getCupWinnerDeadlineTs()` (the early no-`supabase` return keeps
`null`). Ensure the GET handler is `async` (it is).

- [ ] **Step 2: Make the modal use the API deadline**

`components/CupWinnerBetModal.jsx` imports `CUP_WINNER_DEADLINE_TS` and feeds it to `useCountdown`.
Change it to use a `deadlineTs` value sourced from the cup-winner API response.

- The component receives cup-winner data via its parent. Where the parent passes cup-winner props
  (the `myCupWinnerBet`/pool fetch), also thread the `deadlineTs` from that same `/api/cup-winner-bet`
  response down as a prop `deadlineTs`.
- In the modal:

OLD:
```js
import { CUP_WINNER_DEADLINE_TS } from '@/lib/cup-winner';
// ...
const cd = useCountdown(CUP_WINNER_DEADLINE_TS);
```
NEW:
```js
// deadlineTs comes from /api/cup-winner-bet (DB MIN(kickoff)-30s); fall back to KICKOFF_TS-30s.
import { KICKOFF_TS } from '@/lib/countdown';
// ...
const cd = useCountdown(deadlineTs ?? (KICKOFF_TS - 30 * 1000));
```
And add `deadlineTs` to the component's props.

- [ ] **Step 3: Update the modal cutoff copy**

`components/CupWinnerBetModal.jsx:157`:
OLD: ``{closed ? 'Locked in — betting closed' : `Closes in ${formatCountdown(cd)} · 1h before kickoff`}``
NEW: ``{closed ? 'Locked in — betting closed' : `Closes in ${formatCountdown(cd)} · 30s before first match`}``

- [ ] **Step 4: Remove the dead constant in `lib/cup-winner.js`**

Delete the line `export const CUP_WINNER_DEADLINE_TS = KICKOFF_TS - 60 * 60 * 1000;` and its
`import { KICKOFF_TS } from '@/lib/countdown';` if no longer used in that file. Keep
`isCupWinnerOpen` working by deriving from the passed deadline, or remove it if unused — grep
first: `grep -rn "isCupWinnerOpen\|CUP_WINNER_DEADLINE_TS" components app lib`. Update/remove
callers accordingly (display only; enforcement is the RPC).

- [ ] **Step 5: Fix `KICKOFF_TS` (splash fallback) + tidy test**

`lib/countdown.js` lines 1-3:
OLD:
```js
// FIFA World Cup 2026 opener — Estadio Azteca, Mexico City
// June 11, 2026 · 20:00 CDMX (UTC-6)
export const KICKOFF_TS = new Date('2026-06-11T20:00:00-06:00').getTime();
```
NEW:
```js
// FIFA World Cup 2026 opener — Estadio Azteca, Mexico City
// June 11, 2026 · 13:00 CDMX (UTC-6) = 19:00 UTC = 12:30 AM IST Jun 12
export const KICKOFF_TS = new Date('2026-06-11T19:00:00Z').getTime();
```

`__tests__/countdown.test.js:15`:
OLD: `  test('is before June 13, 2026 (20:00 CDMX = 02:00 UTC June 12)', () => {`
NEW: `  test('is before June 13, 2026 (opener 19:00 UTC June 11)', () => {`

- [ ] **Step 6: Run tests + smoke**

Run: `npm test`
Expected: all pass.
Manual: open the cup-winner modal, confirm the countdown targets 12:29:30 AM IST Jun 12 and the
copy reads "30s before first match".

- [ ] **Step 7: Commit**

```bash
git add app/api/cup-winner-bet/route.js components/CupWinnerBetModal.jsx lib/cup-winner.js lib/countdown.js __tests__/countdown.test.js
git commit -m "fix: cup-winner deadline + countdown from DB (-30s), correct opener KICKOFF_TS"
```

---

## Task 7: Live sync + end-to-end verification

- [ ] **Step 1: Run the sync against the live FIFA API**

Dev server up (`npm run dev`):
```bash
curl -s -X POST http://localhost:3000/api/sync-schedule -H 'Content-Type: application/json' -d '{"secret":"adeyaar-topup-2026"}'
```
Expected: `{"updated":72,"unmatched":[]}`.

- [ ] **Step 2: Spot-check the DB**

Run (SQL): `SELECT id, kickoff_ts FROM match_schedule WHERE id IN ('A1','B1','D1') ORDER BY id;`
Expected: `A1 2026-06-11 19:00+00`, `B1 2026-06-12 19:00+00`, `D1 2026-06-13 01:00+00`.

- [ ] **Step 3: End-to-end deadline check**

Run (SQL): `SELECT public.cup_winner_deadline();` → `2026-06-11 18:59:30+00`.
Run: `curl -s http://localhost:3000/api/schedule` → `cupWinnerDeadlineTs` = `1781204370000`
(`2026-06-11T18:59:30Z`).

- [ ] **Step 4: Final commit if needed**

```bash
git add -A && git commit -m "chore: verified schedule sync end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** single-source times (Tasks 4–6) ✓; FIFA as source + manual sync (Tasks 1, 3, 7) ✓; derived deadline (Task 2) ✓; per-match −30s (place_bet, correct after Task 2) ✓; frontend display from DB (Task 5) ✓; worldcup26.ir deferred ✓.
- **No placeholders:** all code/SQL/commands concrete. Task 5 codemod and Task 6 grep are exact.
- **Type/name consistency:** `mapFifaToSchedule`/`getScheduleFromFifa`/`TEAM_CODE_ALIAS`/`FIFA_MATCHES_URL` (Tasks 1, 3); `match_schedule(id, kickoff_ts)` (Tasks 2–4, 7); `withSchedule`/`scheduleMap`/`kickoffTs` (Task 5); `deadlineTs` prop (Task 6).
- **Fail-safe:** sync never writes an empty fetch (Task 3); `isMatchBettingOpen` returns closed if the schedule hasn't loaded (Task 5); modal countdown falls back to `KICKOFF_TS−30s` (Task 6).
- **Risk:** brief first-paint where times show `—` until `/api/schedule` resolves; acceptable and fails safe (betting shows closed, never wrongly open).
```