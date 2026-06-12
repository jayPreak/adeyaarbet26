# CLAUDE.md — Agent Changelog

This file records changes made by AI agents so future agents can understand prior
work and avoid conflicting with or overwriting it. **Append a new dated entry at the
bottom for every change set. Do not rewrite history.**

---

## Architecture quick-reference (read before editing)

- **Frontend:** Next.js 15 App Router. The live mobile UI is `components/AdeYaarApp.jsx`
  → screens in `components/screens/*` → shared widgets in `components/index.jsx`.
  `components/desktop/DesktopApp.jsx` is **dead code** (not imported anywhere) — don't
  bother editing it.
- **Match data:** Static schedule/teams in `lib/data.js` (`MATCHES`, `TEAM`). Kickoff
  times come from the DB table `match_schedule` via `/api/schedule` and are merged onto
  each match object as `match.kickoffTs` (an **ISO timestamp string**, not ms).
  Live status/scores are merged from the FIFA API via `/api/fifa/matches`
  (`mergeWithFifa` in `AdeYaarApp.jsx`).
- **Betting model:** Parimutuel. All money logic lives in Supabase RPCs
  (`place_bet`, `cancel_bets`, `resolve_match`, `place_cup_winner_bet`,
  `cancel_cup_winner_bet`, `settle_cup_winner`). See `supabase/migrations/`.
  Balances are **computed** from the `bets` ledger (`lib/ledger.js` `computeBalance`),
  not stored.
- **Betting cutoff:** Betting closes **30 seconds before kickoff**. This is enforced
  server-side in `place_bet` (`now() >= kickoff_ts - interval '30 seconds'`) and now
  also in the UI (see entry 2026-06-12).
- **Auto-settlement:** `/api/auto-resolve` pulls FIFA results, finds finished matches
  (`MatchStatus === 0` + both scores present) with still-pending bets, and calls
  `resolve_match(match_id, winner)`. Triggered on page load in `AdeYaarApp.jsx` and by
  a Vercel cron (`vercel.json`).

---

## 2026-06-12 — Bet-close UI gating + auto-settle hardening (Opus 4.8)

### Problem
1. **Cancel/place buttons stayed visible after betting closed.** The mobile UI gated
   the cancel and place-bet buttons on the FIFA-derived `match.status`
   (`live`/`finished`). On page load `fifaData` is `null`, so every match defaulted to
   `status: 'upcoming'` and the **Cancel** button showed for already-ended matches
   (e.g. A1 Mexico vs South Africa, which finished 2–0). The 30s cutoff existed in the
   `place_bet` DB RPC but the UI never consulted it.
2. Auto-settlement existed but used the anon client and a cacheable FIFA fetch, and ran
   only on page load.

### Root cause of #1
`lib/data.js` already had `isMatchBettingOpen()` / `MATCH_BET_CUTOFF_MS`, but they were
**unused**, and `getMatchKickoffTs()` returned `match.kickoffTs` verbatim assuming it was
epoch ms. In reality `kickoffTs` is an **ISO string** from Supabase, so the comparison
`now < "2026-..." - 30000` evaluated to `NaN` → always "closed" had it been used. The
helper was both buggy and unwired.

### Changes
- **`lib/data.js`** — `getMatchKickoffTs()` now normalizes `kickoffTs` from either an ISO
  string or a number to epoch ms (`new Date(...).getTime()`), returning `null` if
  unparseable. This makes `isMatchBettingOpen()` actually work.
- **`components/index.jsx`** —
  - Added exported hook `useBettingOpen(matchOrTs)`: returns whether betting is open
    (time-based, `kickoff - 30s`), re-evaluating exactly at the cutoff so the UI flips
    live. Fail-safe **closed** when the schedule hasn't loaded (`kickoffTs` null).
  - `MatchCard`: odds (place-bet) buttons render only when `!isFinished && bettingOpen`;
    a "Betting closed" label shows when closed-but-not-finished. The **Cancel** link now
    gates on `bettingOpen` instead of `!isLive`.
  - `HeroMatch`: bet CTA row renders only when `bettingOpen` ("Betting closed" otherwise);
    Cancel gates on `bettingOpen`.
  - `PlaceBetSheet`: confirm button disabled + relabeled "Betting closed" when closed.
  - `BetCard`: now accepts a `kickoffTs` prop; match-bet Cancel gates on
    `bet.status === 'pending' && bettingOpen`. `useBettingOpen` is called before the
    early `return null` (Rules of Hooks). Cup-winner (special) bets are unchanged — their
    deadline is enforced server-side in `cancel_cup_winner_bet`.
- **`components/screens/BetsScreen.jsx`** — accepts `scheduleMap` prop and passes
  `kickoffTs={scheduleMap[matchId]}` into each `BetCard`.
- **`components/AdeYaarApp.jsx`** — passes its existing `scheduleMap` state into
  `BetsScreen`.
- **`app/api/auto-resolve/route.js`** — prefers the service-role client
  (`supabase-admin`) when configured, falling back to the anon client; FIFA fetch is now
  `{ cache: 'no-store' }`; route marked `dynamic = 'force-dynamic'`, `revalidate = 0`.
  Settlement logic itself was already correct (verified against the live FIFA API:
  A1 = MEX 2–0 RSA, `MatchStatus 0` → winner `home`).
- **`vercel.json`** (new) — hourly cron hitting `/api/auto-resolve` so matches settle even
  when no one has the app open. (On Vercel Hobby crons are throttled to ~daily; the
  page-load trigger remains the primary mechanism.)

### Not changed (intentionally)
- No DB migrations: the 30s cutoff in `place_bet` and `resolve_match` already exist and
  are correct. All fixes are client-side gating + route hardening.
- `DesktopApp.jsx` left untouched (dead code).

### Verification
- `npm test` → 125/125 pass. `npm run build` → succeeds.
- Isolated logic check: `isMatchBettingOpen` with the real A1 ISO timestamp correctly
  returns closed for "now" = 2026-06-12, open before kickoff, and respects the exact 30s
  boundary; both ISO-string and numeric `kickoffTs` forms normalize correctly.
- Full authenticated browser run was not possible in the build sandbox (no Supabase anon
  key / seeded auth → app redirects to `/login`).

---

## 2026-06-12 — Fix Vercel cron schedule for Hobby plan (Sonnet 4.6)

### Problem
Vercel deployment failed after commit 86ca1c4. The failure redirected to Vercel cron
pricing docs, indicating the cron schedule in `vercel.json` was rejected. The hourly
schedule `"0 * * * *"` requires Vercel Pro; Hobby plan only allows a minimum interval
of once per day.

### Root cause
`vercel.json` was introduced in the previous entry with `"schedule": "0 * * * *"`
(hourly). This is a Pro plan feature — deploying it on a Hobby plan causes Vercel to
reject the deployment configuration.

### Changes
- **`vercel.json`** — changed cron schedule from `"0 * * * *"` (hourly) to
  `"0 0 * * *"` (daily at midnight UTC). The page-load trigger in `AdeYaarApp.jsx`
  remains the primary auto-settle mechanism; the cron is a fallback for idle periods.

### Not changed
- Local build was already clean (`npm run build` → 25/25 pages, no errors).
- No code logic changes needed.

### Verification
- `npm run build` → succeeds cleanly (only non-blocking viewport metadata warnings).

---

## 2026-06-12 — Anytime Goalscorer special bet (Sonnet 4.6)

### What was built
Full "anytime goalscorer" parimutuel bet market, one pool per group-stage match.

### Files changed / created
- **`supabase/migrations/012_goalscorer_bets.sql`** (new) — extends `bets_kind_check`
  to include `'goalscorer'`; relaxes `activity_type_check` to include `'bet_cancelled'`
  (was already used in migrations 009/010 but never formalized); adds `fifa_id_stage` /
  `fifa_id_match` columns to `match_schedule`; creates `match_players` cache table; adds
  `place_goalscorer_bet`, `cancel_goalscorer_bet`, `settle_goalscorer` RPCs.
- **`lib/schedule-sync.js`** — `mapFifaToSchedule` now extracts `fifa_id_stage` and
  `fifa_id_match` from each FIFA calendar result and includes them in the upsert payload.
- **`app/api/goalscorer-players/[matchId]/route.js`** (new) — serves the player roster
  for a match. Checks `match_players` cache first; on cache miss calls the FIFA live
  endpoint (`/api/v3/live/football/17/285023/{stage}/{match}`), parses the response,
  writes to cache, returns players grouped into `{ home, away }` sorted FWD→MID→DEF→GK.
- **`app/api/goalscorer-bet/route.js`** (new) — GET for per-match pool + my bet or
  aggregate summary (`?summary=true`); POST calls `place_goalscorer_bet` RPC; DELETE
  calls `cancel_goalscorer_bet` RPC.
- **`app/api/auto-resolve/route.js`** — after each `resolve_match` call, now also
  fetches the FIFA live endpoint for that match (using FIFA IDs from the calendar
  response), extracts goal-scorer player IDs (own goals excluded by comparing
  `goal.IdTeam` against the scorer's team from the Players array), and calls
  `settle_goalscorer`. Returns a `goalscorer` array alongside `resolved` in the response.
- **`lib/specials.js`** — added `goalscorer` entry to `SPECIALS`.
- **`components/GoalScorerBetModal.jsx`** (new) — bottom-sheet modal. Fetches players
  per match, shows two-column player picker (home | away), FWD first. Has amount
  slider + presets identical to CupWinnerBetModal. Switch between "pick" and "see picks"
  views; shows current bet with cancel button.
- **`components/screens/SpecialsScreen.jsx`** — fixed the pool-fetch loop (was calling
  `/api/cup-winner-bet` for every special including future ones); now routes correctly
  per special. Added `GoalScorerMatchList` component for expanded goalscorer view:
  shows upcoming matches with a bet CTA; calls `onOpenSpecialBet('goalscorer', { matchId })`.
  Accepts new `matches` prop (passed from AdeYaarApp).
- **`components/AdeYaarApp.jsx`** — imports `GoalScorerBetModal`; adds `goalScorerOpen`
  / `goalScorerMatchId` state; passes `matches` to `SpecialsScreen`; renders
  `GoalScorerBetModal` alongside `CupWinnerBetModal`.

### Decisions
- **Parimutuel model** — consistent with match bets and cup-winner. No odds management
  needed. Pool split proportionally among winners; refund all on 0-0 or no winner.
- **Own goal exclusion** — goal's `IdTeam` (team that benefited) is compared to the
  scorer's `IdTeam` from the Players array. Mismatch = own goal → excluded from winners.
- **Lazy player cache** — `match_players` is populated on first visit to the player
  picker. Returns 202 with an informative message if FIFA IDs haven't been synced yet.
- **FIFA IDs sourced at settle time** — `auto-resolve` pulls `IdStage`/`IdMatch` from
  the calendar response in the same request, so no separate sync step is required for
  settlement. The schedule-sync route also stores them for the player-roster endpoint.
- **One active bet per user per match** — switching player cancels and replaces the
  existing bet (same as cup-winner switch flow). No multi-pick.

### Verification
- `npm run build` → 25/25 pages, no errors (same pre-existing viewport warnings).
