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
