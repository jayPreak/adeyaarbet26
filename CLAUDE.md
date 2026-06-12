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

### Verification
- `npm run build` → 25/25 pages, no errors (same pre-existing viewport warnings).

---

## 2026-06-12 — Migrate match IDs to FIFA IdMatch (Sonnet 4.6)

### Why
Group-position labels like A1/B2 stop working for knockout matches (no group label).
Using FIFA's own `IdMatch` string (e.g. `'400021443'`) as the primary key works for
every stage of the tournament without manual mapping.

### What changed
- **`supabase/migrations/013_fifa_match_id_primary_keys.sql`** (new) —
  1. Adds `group_label` column to `match_schedule` (populated from the old `id` before migration, e.g. `'A1'`)
  2. Updates `match_schedule.id` from group labels to FIFA IdMatch strings for all 72 group-stage matches
  3. Updates `bets.match_id` for all group-stage match bets (special bets like `CUP_WINNER`, `HT_SHAKIRA` etc. are untouched — no FK constraint on that column)
  4. Updates `match_players.match_id` similarly
  5. Keeps `fifa_id_match = id` in sync for backward-compat during rollout
- **`lib/data.js`** — `MATCHES` array entries now use `id: '400021443'` (FIFA IdMatch);
  `label: 'A1'` property retained for UI display.
- **`lib/schedule-sync.js`** — simplified: `mapFifaToSchedule` now uses `IdMatch`
  directly as the row `id`. No more fuzzy team-code matching to resolve a group label.

### Adding knockout matches (future agents)
When FIFA announces a knockout match (round of 32, R16, QF, SF, Final), just run
`/api/sync-schedule` with the service role key. The sync will automatically upsert the
match using its FIFA IdMatch as the `id`. Add the match to `BRACKET` in `lib/data.js`
with the same `id` field. No manual label needed.

### Complete label → FIFA IdMatch mapping (for reference)
A1=400021443 A2=400021441 A3=400021440 A4=400021442 A5=400021444 A6=400021445
B1=400021449 B2=400021447 B3=400021446 B4=400021450 B5=400021451 B6=400021448
C1=400021453 C2=400021456 C3=400021457 C4=400021454 C5=400021455 C6=400021452
D1=400021458 D2=400021463 D3=400021462 D4=400021460 D5=400021459 D6=400021461
E1=400021464 E2=400021467 E3=400021469 E4=400021465 E5=400021468 E6=400021466
F1=400021474 F2=400021470 F3=400021472 F4=400021475 F5=400021471 F6=400021473
G1=400021478 G2=400021476 G3=400021477 G4=400021480 G5=400021479 G6=400021481
H1=400021482 H2=400021486 H3=400021483 H4=400021487 H5=400021485 H6=400021484
I1=400021490 I2=400021488 I3=400021492 I4=400021491 I5=400021489 I6=400021493
J1=400021496 J2=400021498 J3=400021494 J4=400021499 J5=400021497 J6=400021495
K1=400021504 K2=400021502 K3=400021501 K4=400021503 K5=400021505 K6=400021500
L1=400021507 L2=400021510 L3=400021506 L4=400021511 L5=400021508 L6=400021509
