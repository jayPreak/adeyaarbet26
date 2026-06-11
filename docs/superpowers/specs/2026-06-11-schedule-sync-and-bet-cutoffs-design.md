# Schedule sync + bet cutoffs — design

**Date:** 2026-06-11
**Status:** Approved (pending spec review)

## Problem

1. **Cup-winner bets close at the wrong time.** The authoritative deadline lives in the
   Postgres function `cup_winner_deadline()` (migration `009`), which hardcodes
   `'2026-06-12T02:00:00Z' - 1 hour = 01:00 UTC = 6:30 AM IST` — derived from a stale
   `KICKOFF_TS` in `lib/countdown.js` (`2026-06-11T20:00:00-06:00`). That value is ~6 hours
   *after* the real first match has already kicked off.

2. **The schedule itself is unreliable.** `lib/data.js` (and the `match_schedule` seed copied
   from it in migration `009`) was hand-entered and is wrong for many matches — e.g. CAN v BIH
   off by 4h, USA v PAR off by a day. Per-match cutoffs are enforced correctly (`kickoff_ts − 30s`
   in `place_bet`) but against bad data, so they fire at the wrong wall-clock times.

3. **No way to catch schedule changes.** Times are frozen in source/DB; a real-world reschedule
   would go unnoticed.

### Ground truth (verified against the official FIFA API + FIFA.com)

The official FIFA API (`api.fifa.com`, already integrated at `/api/fifa/matches`) returns
authoritative kickoff times in UTC via the `Date` field. The opener is confirmed by three
independent sources (FIFA API, FIFA.com, worldcup26.ir):

- **MEX v RSA — `2026-06-11T19:00:00Z` = 12:30 AM IST, June 12.**
- Cup-winner deadline must therefore be **18:59:30 UTC = 12:29:30 AM IST, June 12** (30s before).

`worldcup26.ir` was evaluated and agrees with the FIFA API after timezone conversion, but it
exposes *stadium-local* times (needing a 16-entry stadium→tz map) whereas the FIFA API gives UTC
directly. **The FIFA API is the timing source.** `worldcup26.ir` is not needed for this work and
is deferred — it can be added later only if a feature needs data the FIFA API lacks (flags,
group standings, bracket, localized names).

### Single source of truth for times (revised)

The original draft fixed `data.js`'s embedded `date`/`time` values *and* the DB. That keeps two
copies of every kickoff time — exactly the duplication that caused this bug. Revised principle:

**`match_schedule` (Postgres, fed from the FIFA API) is the single source of kickoff times.**
Both layers read it:

- **Backend enforcement** already reads `match_schedule` (`place_bet`, `cup_winner_deadline()`).
- **Frontend display** stops carrying times in `data.js`. It fetches them from a new cached
  `/api/schedule` endpoint and merges them onto the static match objects — the same pattern
  `AdeYaarApp` already uses for live FIFA scores (`mergeWithFifa`).

`data.js` remains the source of match *identity* only (id, group, matchday, venue, home, away,
plus `GROUPS`/`BRACKET`/`TEAM`) — data the schedule table does not hold. Its `date`/`time` fields
are removed.

## Goals

- Cup-winner betting closes **30s before the first match** (12:29:30 AM IST, June 12), derived
  from data — not a hardcoded timestamp.
- Every match's betting closes **30s before that match's real kickoff**.
- Kickoff times come from the official FIFA API, refreshed into `match_schedule` so reschedules
  are caught. No hand-maintained schedule.
- Display countdowns (cup-winner modal, opener countdown) reflect the corrected first-match time.

## Non-goals

- Setting up the `worldcup26.ir` integration layer (deferred per scope).
- Knockout-stage betting (the current `match_schedule` only covers the 72 group matches; out of
  scope until knockouts are added).
- Changing settlement, payout, or pool logic.

## Design

### Component 1 — FIFA → schedule normalizer (`lib/schedule-sync.js`)

A server-only module that:

- Fetches `https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200`.
- Filters to the 72 group-stage matches (those with a `GroupName`).
- Maps each FIFA match to the existing `data.js` ID by **`(group letter, home abbreviation,
  away abbreviation)`** — the pair is unique within a group. Group letter comes from
  `GroupName[].Description` ("Group A" → `A`); abbreviations from `Home.Abbreviation` /
  `Away.Abbreviation`.
- Produces `[{ id: 'A1', kickoff_ts: '2026-06-11T19:00:00Z' }, ...]`.

**Team-code reconciliation:** `data.js` codes are mostly FIFA abbreviations but a few may differ.
The module holds a small explicit alias map (`{ fifaCode: dataJsCode }`) for any mismatches and
**logs every FIFA row it cannot map to a `data.js` ID** rather than silently dropping it. A row
that fails to map leaves that ID's existing `kickoff_ts` untouched (no destructive blanking).

> Interface: `getScheduleFromFifa(): Promise<Array<{id, kickoff_ts}>>`. Depends only on `fetch`.
> Returns `[]` (and logs) on FIFA API failure — callers must treat empty as "skip the upsert",
> never as "wipe the table".

### Component 2 — Sync endpoint (`POST /api/sync-schedule`)

- Protected by the existing admin-secret pattern (`ADMIN_SECRET`, as in `/api/admin/topup`).
- Calls `getScheduleFromFifa()`, then upserts into `match_schedule` via a service-role Supabase
  client: `INSERT ... ON CONFLICT (id) DO UPDATE SET kickoff_ts = EXCLUDED.kickoff_ts`.
- If the normalizer returns `[]`, it makes **no** DB writes and returns a non-200 with a clear
  message (fail safe — never clobber good data with an empty fetch).
- Returns `{ updated, unmatched: [...], skipped }` for observability.

**Trigger:** run **manually** on demand (no cron). Re-run whenever the real schedule changes —
the user will say when. The route upserts, so re-running is idempotent.

### Component 3 — Deadline derivation (migration `011`)

Rewrite `cup_winner_deadline()` to derive from data instead of a constant:

```sql
CREATE OR REPLACE FUNCTION public.cup_winner_deadline() RETURNS timestamptz AS $$
  SELECT MIN(kickoff_ts) - interval '30 seconds' FROM public.match_schedule
$$ LANGUAGE sql STABLE;
```

(`STABLE`, not `IMMUTABLE`, since it now reads a table.) The earliest match is the opener
(`19:00Z`), so this yields **18:59:30 UTC = 12:29:30 AM IST**. Per-match `place_bet` already
enforces `kickoff_ts − 30s` and needs no change — it becomes correct automatically once the
schedule is refreshed.

The migration also **re-seeds `match_schedule` with the verified FIFA UTC times** as a one-time
correction (so the fix holds even before the first sync run), replacing the bad hand-entered
values.

### Component 4 — Schedule read endpoint (`GET /api/schedule`)

A cached read route returning the authoritative times for the frontend:
`{ schedule: { "A1": "2026-06-11T19:00:00Z", ... }, cupWinnerDeadlineTs: <ms> }`.

- Reads `match_schedule` via the anon client (RLS already allows public SELECT).
- `cupWinnerDeadlineTs` = `MIN(kickoff_ts) − 30s` in epoch ms (same rule as the SQL function),
  so the cup-winner countdown uses the DB value, not a constant.
- `revalidate` cache (e.g. 300s) so it's cheap; betting enforcement is still server-side in the
  RPC, so a slightly stale read only affects display.

### Component 5 — Frontend merge (single source for display)

`data.js` **`MATCHES` loses its `date`/`time` fields.** Times arrive from the DB:

- `AdeYaarApp` fetches `/api/schedule` alongside the existing `/api/fifa/matches`, and a merge
  helper sets, per match, `kickoffTs` (ms) and derives `date` (`YYYY-MM-DD`, UTC) and `time`
  (`HH:MM`, UTC) from it — preserving the exact field shape the UI already formats
  (`fmtTimeIST(match.time)`, `fmtDay(match.date)`, date grouping). No component API changes.
- `lib/data.js` helpers switch to the merged value: `getMatchKickoffTs(match)` returns
  `match.kickoffTs`; `isMatchBettingOpen(match)` uses `match.kickoffTs − MATCH_BET_CUTOFF_MS`.
- Until `/api/schedule` resolves, a match has no `kickoffTs`: `isMatchBettingOpen` returns
  `false` (fail safe — betting shows closed, never wrongly open) and the time renders as `—`.
- `GET /api/search` (server-side, uses `MATCHES`) attaches `kickoff_ts` from `match_schedule` so
  search results keep their date label.

`lib/countdown.js` `KICKOFF_TS` is kept **only** as a cosmetic fallback for the pre-login
countdown splash (the opener time); the live cup-winner countdown uses `cupWinnerDeadlineTs` from
`/api/schedule`. `lib/cup-winner.js` `CUP_WINNER_DEADLINE_TS` is removed in favor of the DB value.

## Data flow

```
FIFA API ──manual POST /api/sync-schedule──► match_schedule  ◄── single source of kickoff times
                                                  │
              ┌───────────────────────────────────┼───────────────────────────────────┐
              ▼                                     ▼                                   ▼
   place_bet: kickoff−30s            cup_winner_deadline(): MIN−30s         GET /api/schedule (cached)
   (per-match enforcement)           (cup-winner enforcement)                          │
                                                                                        ▼
                                                              AdeYaarApp merge → match.kickoffTs/date/time
                                                              (display + isMatchBettingOpen)
```

## Error handling

- FIFA API down / shape change → normalizer returns `[]`, sync route writes nothing and reports
  failure. Existing `match_schedule` data is preserved.
- Unmapped FIFA rows (code/group mismatch) → logged and listed in the response; their IDs keep
  prior values. No silent truncation.
- `match_schedule` empty (shouldn't happen post-migration) → `cup_winner_deadline()` returns
  `NULL`; `place_cup_winner_bet` treats `now() >= NULL` as false, so betting would stay open.
  Mitigated by the migration re-seed guaranteeing rows exist.

## Testing

- **Normalizer:** unit test against a saved FIFA API fixture — asserts 72 rows mapped, opener =
  `A1 → 2026-06-11T19:00:00Z`, and that an injected unknown team code lands in `unmatched`.
- **Deadline SQL:** after migration, `SELECT cup_winner_deadline()` = `2026-06-11T18:59:30Z`.
- **Sync route:** empty-fetch case writes nothing and returns non-200; happy path upserts and
  reports counts.
- **Manual:** run the sync against live FIFA API, confirm `match_schedule` matches FIFA `Date`
  values for a sample (MEX v RSA, CAN v BIH, USA v PAR).

## Migration / rollout

1. Ship `lib/schedule-sync.js` + `/api/sync-schedule` + migration `011` + display-constant fixes.
2. Apply migration (`SUPABASE_DB_PASSWORD=… supabase db push`) — re-seeds correct times and the
   new deadline function immediately.
3. Wire the external daily trigger to `POST /api/sync-schedule`.
