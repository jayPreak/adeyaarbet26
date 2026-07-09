# CLAUDE.md — Architecture & Failure Mode Reference

**Purpose:** Dense reference for any AI agent building features on this codebase.
Read this FULLY before touching anything. Every section exists because something
broke when it wasn't followed.

---

## 📋 MANDATORY: Documentation Protocol (every agent, every session)

This repo is documented for AI-assisted development. **You MUST keep the docs in
sync with your changes.** Before ANY commit, complete this checklist:

1. **Update `CHANGELOG.md`** (repo root) — human-readable. Add an entry under today's
   date: what changed, why, and which files. Written for the repo owner and friends,
   plain English, no jargon.
2. **Append to `docs/ai/SESSION_LOG.md`** — AI-readable. Log your session: task,
   files touched, decisions made, gotchas discovered, anything a future agent needs.
   Append-only; never rewrite old entries.
3. **Update `docs/ai/STATE.md`** if you changed what's true about the system
   (new feature live, known issue fixed/introduced, pending manual step).
4. **Update the relevant `CLAUDE.md`** — this file for architecture/invariant changes;
   `app/api/CLAUDE.md`, `components/CLAUDE.md`, or `lib/CLAUDE.md` for changes in
   those directories. If you discovered this documentation was WRONG or stale,
   fix it — stale docs are worse than no docs.
5. **New failure mode discovered?** Add it to "Known Failure Modes & Traps" below.

**Doc map:**
| File | Audience | Purpose |
|------|----------|---------|
| `CLAUDE.md` (this file) | AI | Architecture, invariants, failure modes |
| `app/api/CLAUDE.md`, `components/CLAUDE.md`, `lib/CLAUDE.md` | AI | Directory-level detail (auto-loaded when working there) |
| `docs/ai/SESSION_LOG.md` | AI | Append-only log of every AI session's changes |
| `docs/ai/STATE.md` | AI | Current system state: what's live, known issues, pending manual steps |
| `CHANGELOG.md` | Humans | Plain-English log of all changes |
| `docs/ARCHITECTURE.md` | Both | DB schema deep-dive & financial model (may lag; this file wins on conflict) |
| `PLAN.md` | Both | Historical feature plan (mostly archival) |

---

## System Overview

AdeYaar 26 is a friends' FIFA World Cup 2026 parimutuel betting app.
~10 users, real money (settled at end of tournament), deployed on Vercel + Supabase.

**Stack:** Next.js 15 App Router, Supabase (Postgres + Auth), FIFA API for live data.
**Deploy:** Push to `upstream` remote (jayPreak/adeyaarbet26). Vercel auto-deploys.
**Local dev:** `rm -rf .next && npm run dev`. Local connects to PROD database.

---

## Critical Invariants (break these = money bugs)

1. **Balance is COMPUTED, never stored.** `balance = 5000 - SUM(pending stakes) - SUM(lost amounts) + SUM(won payouts)`. See `lib/ledger.js:computeBalance()`. There is NO wallet column.
2. **All money operations are Supabase RPCs** with `FOR UPDATE` row locking. Never modify `bets` table directly from API routes. Always call the appropriate RPC.
3. **Match IDs are static strings** (`A1`, `B1`, ..., `L6`) defined in `lib/data.js:MATCHES`. The DB `match_schedule` table uses these as primary keys. FIFA has its own numeric IDs (`400021443`) — these must NEVER be stored as `match_id` in `bets` or `match_schedule`.
   > **⛔ DO NOT refactor MATCHES to use FIFA IDs as the `id` field.** This was attempted (PR #15 / commit `928932a`) and catastrophically broke the entire app: activity feed showed raw IDs, bet cards couldn't resolve teams, fixtures disappeared, pool tables vanished. The static ID system (`A1`–`L6`) is load-bearing across: `bets.match_id`, `match_schedule.id`, `activity.payload.match_id`, `poolMap` keys, `scheduleMap` keys, `getMatch()` lookups, and every UI component. For knockout stage support, add new static IDs (e.g. `R16_1`, `QF_1`) — do NOT replace the existing scheme with FIFA numeric IDs. Tests explicitly verify static IDs; `npm test` MUST pass before pushing.
4. **Betting closes 30s before kickoff** — enforced server-side in `place_bet` RPC. UI mirrors this via `useBettingOpen()` hook which uses `getMatchKickoffTs()`.
5. **`kickoffTs` is an ISO string** from Supabase, NOT epoch ms. `getMatchKickoffTs()` in `lib/data.js` normalizes it to epoch ms. Always use this helper.

---

## File Layout

```
app/
  api/
    bets/route.js          — GET (user's bets), POST (place match bet via place_bet RPC)
    bets/cancel/route.js   — POST (cancel via cancel_bets RPC)
    schedule/route.js      — GET (reads match_schedule table, returns {schedule, cupWinnerDeadlineTs})
    auto-resolve/route.js  — GET (settles finished matches + goalscorer bets via FIFA)
    pool/route.js          — GET (pool data for a match)
    leaderboard/route.js   — GET (rankings, biggest wins/losses, biggest bettor)
    cup-winner-bet/route.js— GET/POST/DELETE (cup winner special)
    special-bet/route.js   — GET/POST/DELETE (generic special bets: continent, h2h, golden_boot)
    goalscorer-bet/route.js— GET/POST/DELETE (goalscorer per-match special)
    fifa/matches/route.js  — GET (proxies FIFA live scores)
    settlement/route.js    — GET (real-money settlement positions)
    activity/route.js      — GET (friend activity feed)
    sync-schedule/route.js — POST (manual FIFA→DB schedule sync, rarely needed)
  login/page.js            — Google OAuth login

app/(tabs)/               — REAL app shell (route group). layout.jsx = TabsShell:
                             BettingProvider + AppHeader + TabBar + shared modals + ErrorBoundary.
  home/ fixtures/ specials/ leaders/ account/ news/ tournament/ — one route per tab

components/
  index.jsx                — Shared widgets: MatchCard, HeroMatch, PlaceBetSheet, BetCard,
                             AppHeader, TabBar, Flag, SectionHead, Toast, useBettingOpen hook
  screens/                 — Screen bodies rendered by the (tabs) route pages:
                             HomeScreen, FixturesScreen, BracketScreen, SpecialsScreen,
                             LeaderboardScreen, BetsScreen
  desktop/DesktopApp.jsx   — Desktop layout variant
  *BetModal.jsx            — Special-bet modals (CupWinner, Continent, H2H, GoldenBoot,
                             GoalScorer, FinalFour, TotalGoals, ThirdPlaceQualifier)
  MatchPropsSheet.jsx      — Per-match props (scoreline, o/u, pens) + duels sheet
  LineupSheet.jsx, SearchOverlay.jsx, CountdownGate.jsx, R32BetPage.jsx — misc UI

lib/
  BettingContext.jsx       — ★ Central app state (React context). The real state owner —
                             replaces the old AdeYaarApp useState pile.
  LeaderboardContext.jsx   — Leaderboard/rankings state
  data.js                  — Static: MATCHES, TEAM, FRIENDS, getMatch(), getTeam(),
                             getMatchKickoffTs(), isMatchBettingOpen(), MATCH_BET_CUTOFF_MS
  ledger.js                — computeBalance(), computeRealisedBalance(), resolveMatchBets()
  specials.js              — SPECIALS registry, getSpecial(id), GOLDEN_BOOT_CANDIDATES
  props.js                 — Pure helpers for match props settlement (scoreline/o-u/pens)
  achievements.js          — Leaderboard "Titles", computed client-side
  odds.js, settlement.js, third-place-qualifiers.js, cup-winner.js — domain helpers
  currency.js              — CURRENCY_SYMBOL (₹), fmtMoney(), MAX_BET
  schedule-sync.js         — mapFifaToSchedule(): FIFA API → static ID mapping
  supabase.js              — Server anon client
  supabase-admin.js        — Server service-role client (for writes that bypass RLS)
  supabase-browser.js      — Client-side Supabase (for auth, file uploads)
  supabase-server.js       — Server client w/ auth cookies

supabase/migrations/       — Sequential SQL migrations (001–033). RPCs live here;
                             the LAST migration touching an RPC is its current definition.
```

---

## Data Model

### Tables

| Table | PK | Purpose |
|-------|-----|---------|
| `profiles` | `id` (UUID, FK auth.users) | username, display_name, avatar_url |
| `bets` | `id` (UUID) | ALL money records. kind: match/cup_winner/continent/h2h/golden_boot/goalscorer |
| `activity` | `id` (UUID) | Audit log of bet_placed/bet_cancelled/bet_won events |
| `match_schedule` | `id` (VARCHAR, e.g. "A1") | kickoff_ts, fifa_id_stage, fifa_id_match |
| `match_players` | composite | Cached player rosters for goalscorer feature |
| `settlements` | `id` (UUID) | Real-money transfers between users (end of tournament) |

### `bets` table columns
```
id, user_id, match_id, pick, amount, status, payout, kind, created_at, resolved_at
```
- `status`: pending | won | lost | cancelled
- `kind`: match | cup_winner | continent | h2h | golden_boot | goalscorer
- `match_id` for specials: CUP_WINNER | CONTINENT | MESSI_V_RONALDO | GOLDEN_BOOT | {static match id for goalscorer}
- `pick` for match bets: home | away | draw
- `pick` for specials: team code | confederation code | messi/ronaldo | player slug | player FIFA ID

### Key RPCs (in supabase/migrations/)
| RPC | Does |
|-----|------|
| `place_bet(user_id, match_id, pick, amount)` | Match bet. Checks balance, kickoff cutoff, duplicate side. |
| `cancel_bets(user_id, match_id)` | Cancels all pending bets for user on that match. |
| `resolve_match(match_id, winner)` | Settles all pending bets. Winners get proportional payout. |
| `place_cup_winner_bet(user_id, pick, amount)` | One active bet per user. Rejects duplicate. |
| `cancel_cup_winner_bet(user_id)` | Cancels + refunds. |
| `settle_cup_winner(winning_team)` | Pays out cup winner pool. |
| `place_special_bet(user_id, match_id, pick, amount, kind)` | Generic for h2h/golden_boot/continent. |
| `cancel_special_bet(user_id, match_id, pick, kind)` | Cancels specific special bet. |
| `place_goalscorer_bet(user_id, match_id, pick, amount)` | One per user per match. |
| `cancel_goalscorer_bet(user_id, match_id)` | Cancel goalscorer bet. |
| `settle_goalscorer(match_id, winner_ids[])` | Settle goalscorer pool. |
| `settle_special(match_id, kind, winner)` | Generic single-winner pool settle (scoreline, over_under, pens, total_goals, continent, h2h…). service_role only. |
| `create_challenge / accept_challenge / decline_challenge / cancel_challenge` | Friend duels (1v1). Stakes are `bets` rows with `kind='challenge'` — never touch them directly; the `challenges` table holds duel metadata. |
| `settle_challenges(match_id, winner)` | Settles/voids/expires duels on a finished match. service_role only, called by auto-resolve. |
| `settle_final_four(semifinalists[])` | Most-correct-picks wins the FINAL_FOUR pool. service_role only, run manually after SF matchups are known. |

### Match props & duels (migration 032, added mid-tournament)
- Kinds `scoreline` / `over_under` / `pens` are per-match specials placed via `place_special_bet` (match_id = static match id). Auto-settled in `auto-resolve/route.js` via `settle_special` using `lib/props.js` pure helpers (scoreline settles on the score after extra time, excluding shootouts; pens = knockout only).
- Kind `challenge` (duels): money must flow through the challenge RPCs so `challenges` metadata and `bets` stay in sync. Winner's bet gets `payout = 2×amount`. Draw → both refunded (`void`). Unaccepted at kickoff → challenger refunded (`expired`).
- Kinds `final_four` / `total_goals`: tournament specials gated by `qf_deadline()` (first QF kickoff, read from `match_schedule`). `total_goals` is settled manually at tournament end via `settle_special('TOTAL_GOALS','total_goals','over'|'under')`.
- Leaderboard "Titles" (achievements) are computed client-side in `lib/achievements.js` from the rankings payload — no DB involvement.

---

## Match ID System (CRITICAL)

Static IDs in `lib/data.js:MATCHES`: `A1`–`A6`, `B1`–`B6`, ..., `L1`–`L6` (72 group matches).
Format: `{group_letter}{match_number_within_group}`.

The FIFA API uses numeric IDs like `400021443`. These are ONLY stored in `match_schedule.fifa_id_match` for lookup purposes. They must NEVER be used as:
- `bets.match_id`
- `match_schedule.id` (primary key)
- Keys in the schedule API response

### How the mapping works
`lib/schedule-sync.js:mapFifaToSchedule()` builds a lookup: `"${group}|${home_code}|${away_code}"` → static ID. FIFA team code aliases: `KSA` → `SAU`.

### What went wrong before (FIFA ID contamination)
The `match_schedule` table got rows with FIFA IDs as primary keys. This caused:
- Schedule API returned FIFA IDs as keys → frontend stored bets with FIFA IDs
- `getMatch(fifaId)` returned undefined → bet cards disappeared
- Leaderboard showed raw numeric IDs
- All countdowns broke (no kickoffTs found for valid match objects)

**Current fix:** Schedule route (`/api/schedule`) is a simple DB read. The schedule data was manually inserted with correct static IDs. `sync-schedule` POST route exists for manual re-sync if needed.

---

## Special Bets System

All specials are registered in `lib/specials.js:SPECIALS[]`. Each has:
```js
{ id, matchId, title, description, emoji, options, optionType, multiPick, deadlineTs?, resolvesTs?, formatPick(pick) }
```

| Special | matchId | Kind | Settlement |
|---------|---------|------|-----------|
| Cup Winner | CUP_WINNER | cup_winner | Manual: `settle_cup_winner(team)` |
| Continent | CONTINENT | continent | Manual: settle via SQL or future RPC |
| H2H Messi/Ronaldo | MESSI_V_RONALDO | h2h | Manual: settle via SQL or future RPC |
| Golden Boot | GOLDEN_BOOT | golden_boot | Manual: settle via SQL or future RPC |
| Goalscorer | {match_id} | goalscorer | Auto: `settle_goalscorer` in auto-resolve |

**⚠️ continent, h2h, golden_boot have NO settlement RPC yet.** They accept bets but must be settled manually via SQL at tournament end. Don't promise auto-settlement for these.

### Adding a new special bet
1. Add entry to `SPECIALS[]` in `lib/specials.js` with `formatPick()`
2. Add the kind to `bets_kind_check` constraint (new migration)
3. The `/api/special-bet` route handles GET/POST/DELETE generically via `place_special_bet` / `cancel_special_bet` RPCs
4. Add UI: card in `SpecialsScreen.jsx` + expanded detail view + modal for placement
5. Wire modal open state in `lib/BettingContext.jsx` and render the modal in `app/(tabs)/layout.jsx`
6. If auto-settlement is needed, add logic to `auto-resolve/route.js`

---

## Frontend Architecture

### State Management
App state lives in `lib/BettingContext.jsx` (`BettingProvider`), mounted in
`app/(tabs)/layout.jsx` (the real shell — "TabsShell"). Screens consume via `useBetting()`.
Key state: `user`, `bets`, `matches`, `scheduleMap`, `balance`, `poolMap`, `allUsers`.

### Screen Navigation
Next.js App Router route group `app/(tabs)/` — one directory per tab
(`home`, `fixtures`, `specials`, `leaders`, `account`, `news`, `tournament`).
Shared modals (bet sheet, special-bet modals, toasts) render in `app/(tabs)/layout.jsx`.

### Data Flow on Load
```
1. Auth check → user
2. Fetch /api/bets?user_id=X → bets
3. Fire-and-forget: /api/auto-resolve (settles finished matches)
4. Fetch /api/schedule → scheduleMap (used for kickoff times / betting cutoff)
5. Fetch /api/fifa/matches → fifaData (live scores, merged onto matches)
6. Fetch /api/pool → poolMap (bet pool sizes per match)
7. Fetch /api/cup-winner-bet → cupWinnerDeadlineTs
8. Compute balance client-side from bets via computeBalance()
```

### The `matches` Array
Built from static `MATCHES` in `lib/data.js`, enriched with:
- `kickoffTs` from `scheduleMap`
- `status` (`upcoming`/`live`/`finished`), `homeScore`, `awayScore` from FIFA merge

### Betting Open/Closed Logic
`useBettingOpen(matchOrTs)` in `components/index.jsx`:
- Returns `false` (closed) when `kickoffTs` is null (fail-safe)
- Returns `false` when `now >= kickoffTs - 30000`
- Re-evaluates via setTimeout exactly at cutoff

---

## API Patterns

### Authentication Model
**⚠️ There is NO server-side auth verification on API routes.** Routes trust `user_id` from request params/body. This is acceptable for a 10-person friend group but NOT for public use.

### Supabase Clients
- `lib/supabase.js` — anon key, used for reads
- `lib/supabase-admin.js` — service role key, used for writes that need to bypass RLS (auto-resolve, schedule sync)
- Routes prefer `supabaseAdmin || supabase` for DB operations

### Response Patterns
- All routes return `NextResponse.json(data)` or `NextResponse.json({error}, {status})`
- Pool endpoints: `{ total, bySide: {home, away, draw}, bettorCount }`
- Special bet endpoints: `{ pool: {total, bettorCount, byOption}, myBets, picks }`

---

## Known Failure Modes & Traps

### 1. FIFA API Fetch Hangs Inside Next.js Server
The FIFA API (`api.fifa.com`) is unreliable from server-side Next.js `fetch()`. It can hang indefinitely. **NEVER await FIFA fetch on a hot path.** Use fire-and-forget or timeout with AbortController. The schedule route was rewritten to avoid this after it caused the app to hang.

### 2. Fire-and-Forget Races
If you fire-and-forget a DB write and then immediately read, the read returns stale data. This is why schedule sync was made a separate manual step — the response needs to reflect the current DB state, not a pending async write.

### 3. `kickoffTs` ISO String vs Epoch Ms
`match.kickoffTs` = ISO string from Supabase (e.g., `"2026-06-11T19:00:00+00:00"`).
`getMatchKickoffTs(match)` = epoch ms (e.g., `1749668400000`).
Comparing an ISO string to a number via `<` gives `NaN`. Always use the helper.

### 4. Multiple FIFA ID Aliases
FIFA uses `KSA` for Saudi Arabia, we use `SAU`. This alias is in `lib/schedule-sync.js:TEAM_CODE_ALIAS`. If you encounter new mismatches, add them there.

### 5. `place_special_bet` Allows Duplicate Bets
Unlike `place_cup_winner_bet` (which rejects if you already have a pending bet), `place_special_bet` has NO uniqueness guard. The frontend must prevent double-submission. For single-pick specials (h2h), the modal checks for existing bet and shows cancel first.

### 6. Double-Tap Race Condition
Two rapid POST requests can both pass the balance check before either completes. Frontend should disable the button on first tap (set `submitting = true`). The RPC's `FOR UPDATE` prevents some races but not all.

### 7. Specials Without Settlement RPCs
`continent`, `h2h`, `golden_boot` have NO `settle_*` RPC. Bets can be placed but settlement requires manual SQL: `UPDATE bets SET status='won', payout=X WHERE ...` and `UPDATE bets SET status='lost' WHERE ...`. Build the RPCs if you want auto-settlement.

### 8. The `_topup` Convention
Admin top-ups are stored as bets with `match_id = '_topup'`. These are ALWAYS filtered out in leaderboard, settlement, and bet display. Any query on `bets` should exclude `_topup` unless it's computing raw balance.

### 9. Net Worth Graph Needs `resolved_at` or `created_at` Ordering
The graph plots chronological P&L. If a bet has no `resolved_at`, it falls back to `created_at` for ordering. New RPCs that resolve bets should set `resolved_at = now()`.

### 10. `SUPABASE_SERVICE_ROLE_KEY` May Be Missing on Vercel
The service-role key has (at times) not been set in Vercel env vars, silently breaking
service_role-only RPCs in production (e.g. duels settlement via `settle_challenges`).
Routes fall back to the anon client (`supabaseAdmin || supabase`) which then fails RLS.
If a service_role RPC works locally but not in prod, check Vercel env vars first.

### 11. The live shell is `app/(tabs)/layout.jsx`, not a monolith component
The app shell is `app/(tabs)/layout.jsx` + `lib/BettingContext.jsx`. (A legacy
`components/AdeYaarApp.jsx` monolith used to sit here as dead code — removed 2026-07-09.
Don't reintroduce a parallel shell.)

### 12. CSS/Theming
All styles are inline or in `app/globals.css`. CSS vars: `--ink`, `--ink-2`, `--ink-3`, `--surface-2`, `--line`, `--gold`, `--win`, `--loss`. Dark theme only. Mobile-first (phone frame on desktop via media queries).

---

## Adding a New Feature — Checklist

1. **Read this file first.** Then `lib/specials.js` and the relevant screen.
2. **If it touches money:** Write a Supabase RPC (PL/pgSQL). Use `FOR UPDATE`. Never modify `bets` directly from JS.
3. **If it needs a new bet kind:** Add to `bets_kind_check` via migration. Add to `SPECIALS` in `lib/specials.js` with `formatPick()`.
4. **If it reads schedule data:** Use `scheduleMap` from props, not a fresh fetch. Match IDs are ALWAYS static strings (A1, B1, etc.).
5. **If it fetches FIFA API:** Never await on the response path. Use fire-and-forget or a separate route with timeout.
6. **If it adds a modal:** Add open state in `lib/BettingContext.jsx`, render in `app/(tabs)/layout.jsx` alongside the other modals.
7. **If it shows bet labels:** Use `getSpecial(kind).formatPick(pick)` for specials, `getTeam(match.home).name` for match bets. Never show raw `match_id` or `pick` values to users.
8. **Update the docs** per the Documentation Protocol at the top of this file: `CHANGELOG.md`, `docs/ai/SESSION_LOG.md`, `docs/ai/STATE.md`, and any stale `CLAUDE.md`.
9. **Before pushing:** `rm -rf .next && npm run build` must pass. `npm test` must pass. Push to `upstream` (not `origin`).

---

## Dev Commands

```bash
rm -rf .next && npm run dev    # Always clear cache before dev
npm run build                  # Verify no errors before push
npm test                       # 359+ unit tests (financial math)
git push upstream main         # Deploy to Vercel (jayPreak/adeyaarbet26)
npx supabase db query --linked "SQL"  # Run queries on prod DB
```

---

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only, bypasses RLS)
- Local `.env.local` has all three. Vercel has them in env vars.
- **Local dev connects to PROD database.** There is no local DB. Be careful with destructive queries.
