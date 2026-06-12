# CLAUDE.md — Architecture & Failure Mode Reference

**Purpose:** Dense reference for any AI agent building features on this codebase.
Read this FULLY before touching anything. Every section exists because something
broke when it wasn't followed.

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

components/
  AdeYaarApp.jsx           — Root app shell. ALL state lives here. Passes props down.
  index.jsx                — Shared widgets: MatchCard, HeroMatch, PlaceBetSheet, BetCard,
                             Flag, SectionHead, Toast, useBettingOpen hook
  screens/
    HomeScreen.jsx         — Featured match + activity feed
    FixturesScreen.jsx     — All matches by group/date + bracket
    SpecialsScreen.jsx     — Special bets (cup winner, continent, h2h, golden boot, goalscorer)
    LeaderboardScreen.jsx  — Rankings with tabs (P&L, wins, losses, biggest bettor)
    BetsScreen.jsx         — Account page: profile, settlement, net worth graph, my bets
  CupWinnerBetModal.jsx    — Cup winner bet placement modal
  H2HBetModal.jsx          — Messi vs Ronaldo H2H bet modal
  GoldenBootBetModal.jsx   — Golden Boot multi-pick bet modal
  GoalScorerBetModal.jsx   — Per-match goalscorer bet modal

lib/
  data.js                  — Static: MATCHES (72), TEAM (48), FRIENDS, getMatch(), getTeam(),
                             getMatchKickoffTs(), isMatchBettingOpen(), MATCH_BET_CUTOFF_MS
  ledger.js                — computeBalance(), computeRealisedBalance(), resolveMatchBets()
  specials.js              — SPECIALS registry, getSpecial(id), GOLDEN_BOOT_CANDIDATES
  currency.js              — CURRENCY_SYMBOL (₹), fmtMoney(), MAX_BET
  schedule-sync.js         — mapFifaToSchedule(): FIFA API → static ID mapping
  cup-winner.js            — cupWinnerDeadlineFromKickoffs()
  supabase.js              — Server anon client
  supabase-admin.js        — Server service-role client (for writes that bypass RLS)
  supabase-browser.js      — Client-side Supabase (for auth, file uploads)

supabase/migrations/       — Sequential SQL migrations (001–015)
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
5. Wire modal open state in `AdeYaarApp.jsx`
6. If auto-settlement is needed, add logic to `auto-resolve/route.js`

---

## Frontend Architecture

### State Management
ALL app state lives in `AdeYaarApp.jsx` as ~15 `useState` hooks. Props drill down to screens.
Key state: `user`, `bets`, `matches`, `scheduleMap`, `balance`, `poolMap`, `allUsers`.

### Screen Navigation
Tab-based: `screen` state = `'home' | 'fixtures' | 'specials' | 'leaderboard' | 'account'`.
Modals: `betSheet`, `cupWinnerOpen`, `h2hOpen`, `goldenBootOpen`, `goalScorerOpen` + `goalScorerMatchId`.

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

### 10. CSS/Theming
All styles are inline or in `app/globals.css`. CSS vars: `--ink`, `--ink-2`, `--ink-3`, `--surface-2`, `--line`, `--gold`, `--win`, `--loss`. Dark theme only. Mobile-first (phone frame on desktop via media queries).

---

## Adding a New Feature — Checklist

1. **Read this file first.** Then `lib/specials.js` and the relevant screen.
2. **If it touches money:** Write a Supabase RPC (PL/pgSQL). Use `FOR UPDATE`. Never modify `bets` directly from JS.
3. **If it needs a new bet kind:** Add to `bets_kind_check` via migration. Add to `SPECIALS` in `lib/specials.js` with `formatPick()`.
4. **If it reads schedule data:** Use `scheduleMap` from props, not a fresh fetch. Match IDs are ALWAYS static strings (A1, B1, etc.).
5. **If it fetches FIFA API:** Never await on the response path. Use fire-and-forget or a separate route with timeout.
6. **If it adds a modal:** Add open state in `AdeYaarApp.jsx`, render alongside other modals at the bottom. Wire via `onOpenSpecialBet` handler.
7. **If it shows bet labels:** Use `getSpecial(kind).formatPick(pick)` for specials, `getTeam(match.home).name` for match bets. Never show raw `match_id` or `pick` values to users.
8. **Before pushing:** `rm -rf .next && npm run build` must pass. `npm test` must pass. Push to `upstream` (not `origin`).

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
