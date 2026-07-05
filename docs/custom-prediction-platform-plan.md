# Custom Prediction Platform — Migration Plan

**From:** AdeYaar 26 (single-tenant FIFA World Cup 2026 parimutuel betting app for ~10 friends)
**To:** A generic private prediction platform — groups, leagues, matches, predictions — with the FIFA experience preserved as a prebuilt template.
**Status:** Planning document only. No application code changes accompany this document.
**Date:** 2026-07-05 · Branch: `next-step`

---

## Table of Contents

1. [Existing Architecture Summary](#1-existing-architecture-summary)
2. [Reusable Components](#2-reusable-components)
3. [Components Needing Refactoring](#3-components-needing-refactoring)
4. [Database Migration Plan](#4-database-migration-plan)
5. [New Database Schema](#5-new-database-schema)
6. [API Changes](#6-api-changes)
7. [Frontend Changes](#7-frontend-changes)
8. [Authentication Impact](#8-authentication-impact)
9. [Migration Strategy](#9-migration-strategy)
10. [Incremental Implementation Phases](#10-incremental-implementation-phases)
11. [Risks](#11-risks)
12. [Future Roadmap](#12-future-roadmap)
13. [Recommended MVP](#13-recommended-mvp)
14. [Technical Debt to Address During Migration](#14-technical-debt-to-address-during-migration)
15. [Suggested Folder Structure After Refactor](#15-suggested-folder-structure-after-refactor)
16. [Estimated Complexity per Phase](#16-estimated-complexity-per-phase)

---

## 1. Existing Architecture Summary

### Stack
- **Next.js 15 App Router** (JS, not TS), React 18, vanilla `useState` + React Context (no Redux/react-query/SWR)
- **Supabase**: Postgres + Auth (Google OAuth + email/password via `@supabase/ssr`), RLS on all tables
- **Vercel**: auto-deploy from `upstream`, one daily cron (`/api/auto-resolve` at 00:00 UTC)
- **FIFA API**: live scores, schedule sync, player rosters (unreliable; never awaited on hot paths)
- **Tests**: Jest (~22 suites, business logic only) + Playwright e2e

### Core model (money/points)
- **Parimutuel pools.** No fixed odds. Winners split the total pool proportionally: `payout = FLOOR(amount / winning_pool * total_pool)`. No winners → refund everyone.
- **Balance is computed, never stored**: `5000 − SUM(non-cancelled stakes) + SUM(won payouts)` (`compute_balance()` in DB, `computeBalance()` in `lib/ledger.js`). `profiles.balance` exists but is ignored.
- **All money mutations are SECURITY DEFINER Postgres RPCs** with `FOR UPDATE` row locking (`place_bet`, `place_special_bet`, `create_challenge`, `resolve_match`, `settle_*`). API routes never write to `bets` directly. Settlement RPCs have EXECUTE revoked from anon/authenticated — service-role only.
- **Time gates** enforced in the RPCs: match bets close at `kickoff_ts − 30s`; tournament specials have hardcoded ISO deadlines or computed ones (`qf_deadline()` = first QF kickoff).
- **Penalty system** (migration 018): users who don't bet on a popular match (5+ bettors) get an auto-inserted losing "penalty" bet of ₹50 — an inactivity-penalty precedent that the generic platform will formalize as configurable league rules.

### Data model today (33 migrations)
- `profiles` (1 row per auth user), `bets` (every money record; 17 `kind` values from `match` to `total_goals`), `activity` (audit feed), `match_schedule` (static string PKs `A1`…`L6`, `R32-1`…`FIN-1` + FIFA lookup IDs), `match_players` (cached rosters), `challenges` (1v1 duels), `settlements`, `news_cache`.
- Static data hardcoded in `lib/data.js`: 48 teams, 12 groups, 17 venues, ~88 matches, the FRIENDS list.

### Frontend shell
- Real shell: `app/(tabs)/layout.jsx` → `TabsShell` wrapped in `BettingProvider` (`lib/BettingContext.jsx`). **`components/AdeYaarApp.jsx` is dead code.**
- One consolidated `/api/init` fetch hydrates everything (bets, schedule, FIFA data, knockout, pools, users); actions re-fetch after mutation.
- Tabs: Home / Fixtures / Specials / Leaders / Account (+ Tournament bracket, News).
- Dark-only theme via CSS variables in `app/globals.css`; mobile-first with a phone-frame on desktop; `--vvh` visual-viewport hack for iOS Safari sheets.

### Auth & admin
- Supabase SSR cookies; `verifyUser(claimedUserId)` in `lib/auth.js` guards write routes (compares session user to claimed `user_id`). Read routes are unauthenticated.
- "Admin" = a shared `ADMIN_SECRET` env var gating `/api/admin/topup` and `/api/sync-schedule`. No roles, no admin UI.
- Notifications: in-app activity feed only. No push/email.

### Single-tenancy assumptions (the crux)
Everything assumes exactly one tournament, one friend group, one currency (₹), one starting bankroll (5000), and FIFA's structure. There is no `group_id` or `league_id` anywhere — not in tables, RPCs, API routes, or client state.

---

## 2. Reusable Components

These survive largely intact — the parimutuel/prediction core is genuinely generic.

### Backend / database
| Asset | Why it's reusable |
|---|---|
| **Parimutuel settlement math** (`resolve_match`, `settle_special`, `lib/ledger.js:resolveMatchBets`) | Pure pool math; needs only a `league_id` scope added |
| **Computed-balance ledger model** | Works per-league unchanged: `starting_points − stakes + payouts` scoped by league |
| **RPC-with-locking pattern** | The whole "money ops are SECURITY DEFINER RPCs with FOR UPDATE" discipline carries straight over to points |
| **`challenges` (duels) system** | Already generic 1v1 on any match; add league scope |
| **`place_special_bet` / `cancel_special_bet_by_id`** | Already a generic kind-dispatched entry point; the whitelist becomes data-driven |
| **`activity` table + feed** | Generic audit log with jsonb payload; add league scope |
| **Penalty system RPCs** (`apply_match_penalties`, `apply_all_pending_penalties`) | Idempotent inactivity-penalty engine — exactly the "configurable penalties" the vision asks for; parameterize amount/threshold |
| **Auto-resolve idempotency patterns** | Re-runnable settlement, NOT EXISTS guards, resolved_at stamping |
| **`verifyUser()` server-side auth check** | Unchanged; membership checks layer on top |
| **`settlements` table** | Real-money end-of-season squaring; becomes per-league opt-in |

### Frontend
| Asset | Why it's reusable |
|---|---|
| `PlaceBetSheet`, `MatchCard`, `HeroMatch`, `MatchPoolTable`, `MatchActivityModal` | Generic "two sides + optional draw + pool odds" UI once flag/team rendering is parameterized |
| `Toast`, `SectionHead`, `MiniCountdown`, `SearchOverlay`, `LineupSheet`, bottom-sheet CSS, `--vvh` hack, ErrorBoundary | Fully generic |
| `useBettingOpen`, `useAutoReload`, `useUser` hooks | Generic timing/session logic (rename `useBettingOpen` → `usePredictionOpen`) |
| `LeaderboardScreen` + `/api/leaderboard` aggregation (P&L, win rate, streaks, biggest win/loss) | Pure aggregation over bets; scope by league |
| `lib/achievements.js` (Titles) | Client-side computed badges over rankings — works for any league |
| Theme system (`globals.css` CSS vars) | Becomes the default theme; vars make per-league theming cheap later |
| Tab shell + route-group navigation | Generic; gains a league switcher |
| Jest business-logic test suites | Odds/ledger/settlement tests keep guarding the math through the refactor |

---

## 3. Components Needing Refactoring

| Component | Problem | Refactor |
|---|---|---|
| `lib/data.js` (MATCHES, TEAM, GROUPS, VENUES, FRIENDS) | The single biggest hardcoding: all competition data is static JS | Becomes **seed data for the "FIFA WC 2026" template**; runtime reads from DB (`league_matches`, `league_entrants`) |
| `match_schedule` table + static ID scheme (`A1`…`FIN-1`) | IDs are load-bearing strings with meaning baked in (group, stage, deadline computation via `LIKE 'QF-%'`) | Replaced by `matches` rows with UUID PKs + explicit `stage`, `close_ts` columns. Static IDs survive only as a `legacy_id` column for the migrated FIFA league |
| All RPCs (`place_bet`, `resolve_match`, `settle_*`, …) | No league scope; deadlines/minimums/team validation hardcoded (48-team check, `bet_min` by ID prefix, ISO-string deadlines, `qf_deadline()`) | Rewrite as league-scoped v2 RPCs reading rules from `league_rules` / `matches.close_ts`; validation against `league_entrants` |
| `lib/specials.js` SPECIALS registry | Hardcoded FIFA specials (confederations, Messi/Ronaldo, 248.5 line, 96 matches) | Becomes a **market-type registry** + per-league `special_markets` rows (see §5); FIFA entries become template seeds |
| `lib/props.js` | OU_LINE=2.5, TOTAL_GOALS_LINE=248.5, knockout detection via `'-' in match_id` | Lines/params move to market config JSON; knockout flag becomes `matches.stage` metadata |
| `lib/currency.js` | ₹ symbol, MAX_BET, stage minimums hardcoded | Per-league config: points name/symbol, min/max stake, starting balance |
| `lib/schedule-sync.js` + `/api/auto-resolve` FIFA fetches | FIFA competition/season IDs, stage maps, team aliases hardcoded | Becomes a **result-provider adapter** attached only to leagues created from the FIFA template; generic leagues get manual result entry |
| `BettingContext` + `/api/init` | Single global state, no league dimension | Context gains `activeLeague`; `/api/init?league_id=` returns league-scoped state |
| Branding (`AppHeader`, `layout.js` metadata, `CountdownSplash`) | "AdeYaar 26 · World Cup Betting" everywhere | League title/description/image from DB; splash becomes optional league feature |
| Betting terminology | "bet", "stake", "₹" throughout UI | Terminology pass: "prediction", "points". Keep a per-league `pointsLabel` so a money-settled friends league can still say ₹ |
| `Flag` component | Hardcoded FIFA CDN URL | `EntrantBadge` component: image URL from `league_entrants.image_url`, fallback to initials avatar |
| Admin (`ADMIN_SECRET` routes) | Shared-secret pseudo-admin, no UI | Role-based (`league_members.role`), real admin screens for match/result/member management |
| `profiles.balance` column | Dead column, misleading | Drop during migration |
| `components/AdeYaarApp.jsx` | Dead code | Delete during migration |

---

## 4. Database Migration Plan

Guiding principles:

1. **Additive first.** New tables land alongside old ones. Nothing existing breaks while the tournament (live right now — QFs upcoming) finishes.
2. **The current FIFA app becomes "league zero."** A backfill migration creates one group ("AdeYaar"), one league ("FIFA World Cup 2026"), converts `match_schedule` rows to `matches` rows (keeping static IDs in `legacy_id`), converts the 48 teams to `league_entrants`, and stamps `league_id` onto every existing `bets` / `challenges` / `activity` row.
3. **v2 RPCs, not in-place edits.** New league-scoped RPCs (`place_prediction`, `resolve_league_match`, …) are written fresh; old RPCs stay until the FIFA tournament settles, then get dropped.
4. **⛔ Respect the CLAUDE.md invariant.** We do NOT rewrite existing `bets.match_id` values. Old rows keep `A1`/`QF-1` strings; new rows reference `matches.id` UUIDs. A `bets.match_ref` (UUID, nullable) column bridges the two worlds; reads join on `COALESCE(match_ref, legacy lookup)` during transition.

Migration sequence (each is one numbered SQL file):

| Step | Migration | Contents |
|---|---|---|
| M1 | `034_platform_core.sql` | `groups`, `group_members`, `leagues`, `league_members`, `league_rules` tables + RLS |
| M2 | `035_entrants_matches.sql` | `league_entrants`, `matches` tables + RLS; indexes |
| M3 | `036_predictions_scope.sql` | Add `league_id` (nullable) + `match_ref` to `bets`, `challenges`, `activity`; indexes on `(league_id, user_id)`, `(league_id, match_id)` |
| M4 | `037_backfill_fifa_league.sql` | Create AdeYaar group + FIFA league; copy `match_schedule` → `matches` (with `legacy_id`); copy TEAM data → `league_entrants`; `UPDATE bets/challenges/activity SET league_id = <fifa league>` |
| M5 | `038_v2_rpcs.sql` | `place_prediction`, `cancel_prediction`, `resolve_league_match`, `settle_league_market`, `apply_league_penalties` — all league-scoped, rules-driven |
| M6 | `039_invites.sql` | `invites` table (code, group/league, expiry, max uses) + `redeem_invite` RPC |
| M7 | `040_special_markets.sql` | `special_markets` table (generic extension system) + `place_market_prediction` / `settle_market` RPCs |
| M8 (post-tournament) | `041_cleanup.sql` | Set `league_id` NOT NULL; drop old RPCs, `match_schedule`, `profiles.balance`; drop `is_valid_team_code()`, `qf_deadline()`, hardcoded-deadline logic |

Rollback posture: M1–M3 are purely additive (safe). M4 backfill is idempotent (`ON CONFLICT DO NOTHING` / WHERE league_id IS NULL). M8 is the only destructive step and only runs after the tournament is fully settled and verified.

> **Operational caution:** local dev connects to the **production** database. Every migration must be rehearsed as a transaction-wrapped script and run during a no-live-match window.

---

## 5. New Database Schema

```sql
-- ============ Tenancy ============
groups (
  id            uuid PK DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  description   text,
  image_url     text,
  join_policy   text NOT NULL DEFAULT 'invite'          -- 'invite' | 'link' | 'approval'
                CHECK (join_policy IN ('invite','link','approval')),
  owner_id      uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
)

group_members (
  group_id      uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id),
  role          text NOT NULL DEFAULT 'member'           -- 'owner' | 'admin' | 'member'  ('viewer' reserved)
                CHECK (role IN ('owner','admin','member','viewer')),
  status        text NOT NULL DEFAULT 'active'           -- 'active' | 'pending' (approval flow) | 'removed'
  joined_at     timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
)

-- ============ Leagues ============
leagues (
  id            uuid PK DEFAULT gen_random_uuid(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  image_url     text,
  template      text NOT NULL DEFAULT 'custom',          -- 'custom' | 'fifa_wc_2026' | future templates
  starts_at     timestamptz,
  ends_at       timestamptz,
  timezone      text NOT NULL DEFAULT 'UTC',             -- IANA tz for display; storage stays UTC
  visibility    text NOT NULL DEFAULT 'group'            -- 'group' | 'private' (subset) | 'public' (future)
                CHECK (visibility IN ('group','private','public')),
  status        text NOT NULL DEFAULT 'draft'            -- 'draft' | 'active' | 'completed' | 'archived'
                CHECK (status IN ('draft','active','completed','archived')),
  owner_id      uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
)

league_members (
  league_id     uuid REFERENCES leagues(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id),
  role          text NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','member','viewer')),
  joined_at     timestamptz DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
)

-- One row per league; ALL configurable rules live here (nothing hardcoded).
league_rules (
  league_id             uuid PK REFERENCES leagues(id) ON DELETE CASCADE,
  scoring_mode          text NOT NULL DEFAULT 'points'   -- 'points' (fixed award) | 'parimutuel' (pool split)
                        CHECK (scoring_mode IN ('points','parimutuel')),
  starting_balance      integer NOT NULL DEFAULT 5000,   -- parimutuel bankroll (ignored in points mode)
  points_correct        integer NOT NULL DEFAULT 3,      -- points mode: correct winner
  points_bonus          jsonb   NOT NULL DEFAULT '{}',   -- e.g. {"exact_score": 2, "underdog": 1}
  min_stake             integer NOT NULL DEFAULT 1,
  max_stake             integer NOT NULL DEFAULT 10000,
  prediction_lock       text    NOT NULL DEFAULT 'kickoff', -- 'kickoff' | 'custom'
  lock_offset_seconds   integer NOT NULL DEFAULT 30,     -- close N seconds before match time
  hidden_until_lock     boolean NOT NULL DEFAULT false,  -- hide others' predictions until close
  late_join_allowed     boolean NOT NULL DEFAULT true,
  missed_prediction_penalty integer NOT NULL DEFAULT 0,  -- 0 = off (generalizes migration 018)
  penalty_min_bettors   integer NOT NULL DEFAULT 5,      -- penalty only fires when N+ members predicted
  inactivity_penalty    jsonb   NOT NULL DEFAULT '{}',   -- e.g. {"per_missed_week": 10} (future)
  points_label          text    NOT NULL DEFAULT 'pts',  -- display: 'pts', '₹', '🪙'…
  extra                 jsonb   NOT NULL DEFAULT '{}'    -- escape hatch for template-specific rules
)

-- ============ Competition data (replaces lib/data.js + match_schedule) ============
league_entrants (           -- teams, players, or arbitrary names — no sport assumptions
  id            uuid PK DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name          text NOT NULL,
  short_code    text,                                    -- 'BRA', 'CSK', 'Team Rocket'
  image_url     text,                                    -- logo/flag/photo; null → initials avatar
  kind          text NOT NULL DEFAULT 'team'             -- 'team' | 'player' | 'custom'
                CHECK (kind IN ('team','player','custom')),
  metadata      jsonb NOT NULL DEFAULT '{}',             -- group letter, seed, confederation…
  UNIQUE (league_id, short_code)
)

matches (
  id            uuid PK DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  legacy_id     text,                                    -- 'A1', 'QF-1' for migrated FIFA rows
  home_entrant  uuid REFERENCES league_entrants(id),     -- nullable until bracket resolves (TBD slots)
  away_entrant  uuid REFERENCES league_entrants(id),
  home_label    text,                                    -- fallback display when entrant TBD ('Winner QF1')
  away_label    text,
  starts_at     timestamptz,
  close_ts      timestamptz,                             -- explicit prediction close (defaults from rules)
  stage         text,                                    -- free-form: 'group-A', 'semifinal', 'week 3'
  allow_draw    boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'scheduled'        -- 'scheduled' | 'live' | 'finished' | 'cancelled'
                CHECK (status IN ('scheduled','live','finished','cancelled')),
  winner        text CHECK (winner IN ('home','away','draw')),  -- set on resolution
  home_score    integer,                                 -- optional
  away_score    integer,
  external_ref  jsonb NOT NULL DEFAULT '{}',             -- {provider:'fifa', stage_id, match_id} for templates
  created_by    uuid REFERENCES profiles(id),
  UNIQUE (league_id, legacy_id)
)

-- ============ Special markets: the extension system ============
-- One row per custom question/market ("Tournament winner", "Finals MVP", "Most wickets", …)
special_markets (
  id            uuid PK DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  emoji         text,
  option_source text NOT NULL DEFAULT 'custom'           -- 'entrants' (pick a team/player) | 'custom' (own list)
                CHECK (option_source IN ('entrants','custom')),
  options       jsonb NOT NULL DEFAULT '[]',             -- [{id:'over', label:'Over 248.5'}, …] when custom
  multi_pick    boolean NOT NULL DEFAULT false,
  pick_count    integer,                                 -- exact # of picks (e.g. Final Four = 4)
  scoring       text NOT NULL DEFAULT 'parimutuel'       -- 'parimutuel' | 'fixed_points' | 'most_correct'
                CHECK (scoring IN ('parimutuel','fixed_points','most_correct')),
  close_ts      timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'open'             -- 'open' | 'locked' | 'settled' | 'voided'
                CHECK (status IN ('open','locked','settled','voided')),
  winning_picks jsonb,                                   -- set on settlement
  created_by    uuid REFERENCES profiles(id),
  config        jsonb NOT NULL DEFAULT '{}'              -- lines, thresholds, template metadata
)

-- ============ Predictions (evolves `bets`) ============
-- Existing `bets` table is EXTENDED, not replaced (money rows must not be rewritten):
ALTER TABLE bets ADD COLUMN league_id uuid REFERENCES leagues(id);
ALTER TABLE bets ADD COLUMN match_ref uuid REFERENCES matches(id);      -- new rows use this
ALTER TABLE bets ADD COLUMN market_ref uuid REFERENCES special_markets(id);
-- match_id (text) retained for legacy FIFA rows and as a denormalized pool key.

-- ============ Invitations ============
invites (
  id            uuid PK DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,                    -- short random slug for links/QR
  group_id      uuid REFERENCES groups(id) ON DELETE CASCADE,
  league_id     uuid REFERENCES leagues(id) ON DELETE CASCADE,  -- optional: direct-to-league invite
  role          text NOT NULL DEFAULT 'member',
  created_by    uuid REFERENCES profiles(id),
  expires_at    timestamptz,
  max_uses      integer,
  use_count     integer NOT NULL DEFAULT 0,
  revoked       boolean NOT NULL DEFAULT false
)

-- ============ Payments placeholder (design only — NOT built) ============
-- league_prize_pools (league_id PK, currency, buy_in, provider text, provider_ref jsonb, status)
-- Points stay the unit of play; a prize pool maps final standings → real payouts at settlement.
-- The existing `settlements` table is the manual version of this and remains per-league opt-in.
```

**RLS strategy:** membership-scoped instead of today's "anon can read everything."
- `groups`/`leagues`/`matches`/`league_entrants`/`special_markets`: SELECT where the requesting user is in `group_members`/`league_members` (or via service role).
- `bets`: SELECT for league members — but when `league_rules.hidden_until_lock` is true, non-own pending predictions are filtered in the API layer (RPC-computed pool aggregates stay visible).
- All writes continue through SECURITY DEFINER RPCs; RPCs assert membership + role internally.

**Scoring engine — two modes, one settlement path:**
- `parimutuel` (today's behavior): stake points, pool split. Preserves the entire existing math.
- `points` (simpler, mass-market): no stakes; correct pick = `points_correct` + bonuses. Implemented as amount=0 predictions with fixed `payout` on resolution — same `bets` rows, same leaderboard aggregation, so the leaderboard/achievements code needs no fork.
- Weekly/season rankings: computed from `bets.resolved_at` bucketed by week within `[starts_at, ends_at]` — no new tables needed.

---

## 6. API Changes

### Route reorganization (all new routes take/derive `league_id`; `verifyUser` + membership check on every write)

| New route | Replaces / Notes |
|---|---|
| `POST/GET /api/groups`, `GET/PATCH /api/groups/[id]`, `POST /api/groups/[id]/members` | New — group CRUD, member management, approval queue |
| `POST/GET /api/leagues`, `GET/PATCH /api/leagues/[id]` | New — league CRUD (create from template or blank), rules editing |
| `GET /api/leagues/[id]/init` | Replaces `/api/init` — one consolidated league-scoped hydration payload |
| `POST/GET/PATCH /api/leagues/[id]/matches`, `POST .../matches/[matchId]/result` | New — admin match CRUD + manual result entry (the generic replacement for FIFA auto-resolve) |
| `POST/GET/DELETE /api/leagues/[id]/predictions` | Replaces `/api/bets` + `/api/bets/cancel` → `place_prediction` / `cancel_prediction` RPCs |
| `GET /api/leagues/[id]/pool?match=…` | Replaces `/api/pool` |
| `GET /api/leagues/[id]/leaderboard?period=all\|week\|season` | Replaces `/api/leaderboard`; adds period bucketing |
| `GET /api/leagues/[id]/activity` | Replaces `/api/activity` |
| `POST/GET /api/leagues/[id]/markets`, `POST .../markets/[id]/predict`, `POST .../markets/[id]/settle` | Replaces the six special-bet routes (`cup-winner-bet`, `special-bet`, `goalscorer-bet`, `third-place-qualifier-bet`, `h2h-goals`, r32) with one generic market API |
| `POST/GET /api/leagues/[id]/challenges` + accept/decline | Replaces `/api/challenge` (duels stay a first-class feature) |
| `POST /api/invites`, `POST /api/invites/redeem` | New — invite links (`/join/[code]` page) |
| `GET /api/auto-resolve` | Kept, generalized: iterates leagues with a `result_provider` configured (FIFA template only); manual-result leagues skip it |
| `/api/admin/topup`, `/api/sync-schedule`, `/api/setup` | Replaced by role-gated league-admin endpoints; `ADMIN_SECRET` retired |
| `/api/fifa/*`, `/api/news`, `/api/h2h-goals`, `/api/r32-standings` | Move behind the FIFA template adapter or retire post-tournament |

### Result-provider adapter (extensibility seam)
```
lib/providers/
  index.js        — getProvider(league.template)
  fifa.js         — wraps today's schedule-sync + auto-resolve FIFA logic
  manual.js       — no-op; results come from admin UI
```
Auto-resolve becomes: *for each active league with a provider → fetch results → `resolve_league_match` → `settle_market`*. Adding IPL/Champions League later = writing one adapter file, no core changes.

---

## 7. Frontend Changes

### New surfaces
1. **League switcher + onboarding**: post-login you land on "My Leagues" (grid of league cards) instead of the FIFA home. Deep routes become `app/(league)/[leagueId]/(tabs)/…`. `localStorage` remembers the last active league.
2. **Group/league creation wizard**: name → template ("FIFA World Cup" prebuilt vs "Custom") → entrants → matches → rules → invite link. Templates pre-fill everything.
3. **Admin screens** (owner/admin roles): match CRUD, result entry, member management, rules editor, market creator.
4. **Join flow**: `/join/[code]` — accept invite, join group/league, honoring approval-required policy.

### Refactors to existing surfaces
- `BettingContext` → `LeagueContext`: same shape, plus `activeLeague`, `rules`, `myRole`; all fetches league-scoped. Keep vanilla Context (fine at this scale — adopting react-query is optional debt work, §14).
- `MatchCard`/`HeroMatch`/`PlaceBetSheet`: replace `Flag` with `EntrantBadge` (image or initials), read labels from match/entrant rows, read min/max/lock from `rules`. `allow_draw=false` hides the draw button (badminton, chess with no draws agreed, knockouts).
- `SpecialsScreen`: renders `special_markets` rows generically (title/emoji/options/close time) instead of the hardcoded SPECIALS registry; the seven FIFA modals collapse into two generic ones: `MarketPredictionModal` (single/multi pick) and the existing challenge/duel modal.
- Terminology pass: "Place bet" → "Predict", "stake" → "points", currency symbol from `rules.points_label`.
- Branding: header shows league image + title; `CountdownSplash` becomes an optional league setting.
- Leaderboard: adds All-time / This week / Season tabs (same aggregation, time-bucketed).
- Keep: theme, phone-frame layout, tab structure, toasts, sheets, search, activity feed UI.

---

## 8. Authentication Impact

- **Supabase Auth is untouched** (Google OAuth + email/password + SSR cookies). No new IdP work.
- **Authorization is the new work**: today's model is "any authenticated user is a member." The platform needs membership + role checks on every read and write:
  - Write RPCs assert `EXISTS (SELECT 1 FROM league_members WHERE league_id=… AND user_id=… AND role >= required)` before acting.
  - Read routes verify membership before returning league data (RLS as backstop, API check as primary — consistent with the existing `verifyUser` pattern).
- **Roles**: owner > admin > member (> viewer, future). Stored per group and per league; league roles default from group roles.
- **Existing gap to close**: GET routes currently have *no* auth at all (fine for 10 friends, unacceptable multi-tenant). Every league-scoped GET must require a session + membership. This is the single biggest security lift of the migration.
- `ADMIN_SECRET` retires in favor of roles; platform-level superadmin can be a `profiles.is_superadmin` flag or a Supabase dashboard-only concern initially.

---

## 9. Migration Strategy

**Strangler-fig, keeping the live tournament untouched until it completes (~July 19, 2026):**

1. **Freeze window** — no schema changes to money paths while QF/SF/Final are live. Build phases 0–1 (below) as additive-only.
2. **Dual-write bridge** — once v2 RPCs exist, the FIFA league's writes go through them (they produce identical `bets` rows plus `league_id`/`match_ref`); old RPCs remain callable but unused. Read paths join both shapes.
3. **Backfill** (migration M4) stamps historical rows with the FIFA `league_id` — leaderboard/settlement history carries over byte-identical.
4. **Flip the shell** — route users through the league switcher; the FIFA league is just the first card. Old routes 307-redirect to `/league/<fifa-id>/…`.
5. **Settle & clean** — after final settlement is verified against a pre-migration snapshot of `computeBalance()` per user, run M8 cleanup (drop old RPCs, `match_schedule`, dead code).
6. **Template extraction** — package the FIFA data as `templates/fifa-wc-2026.json` seed so future World Cup leagues are one click.

Verification gates between steps: `npm test` (extend suites to v2 math), balance-parity script (old ledger vs new per-user, must be exactly equal), Playwright smoke on the FIFA league.

---

## 10. Incremental Implementation Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **P0 — Foundations** | Migrations M1–M3 (tables only), `lib/providers/` scaffolding, terminology constants, delete dead code | Schema deployed; existing app behavior unchanged; tests green |
| **P1 — Tenancy core** | Groups/leagues/members CRUD APIs + RPC membership checks; league switcher shell; FIFA backfill (M4) | FIFA league accessible via `/league/[id]`; balances match pre-migration snapshot |
| **P2 — Generic matches & predictions** | `matches`/`league_entrants` CRUD, v2 prediction RPCs (M5), manual result entry, generic MatchCard/PlaceBetSheet, points-mode scoring | A custom league (e.g. office badminton) can run end-to-end: create → predict → resolve → leaderboard |
| **P3 — Invites & roles** | Invite links (M6), join flows, approval queue, admin screens, role enforcement on all routes | Non-members cannot read/write; invite → join → predict works |
| **P4 — Special markets** | `special_markets` (M7), generic market UI, migrate FIFA specials as seed examples, configurable penalties via `league_rules` | League owner can create/settle a custom question without code changes |
| **P5 — Leaderboard & polish** | Weekly/season rankings, achievements per league, league theming/branding, activity feed scoping | Rankings tabs live; per-league branding renders |
| **P6 — Template & cleanup** | FIFA template extraction, M8 destructive cleanup, docs, RLS tightening audit | New "World Cup"-style league creatable from template; legacy code gone |

Phases P0–P1 can ship during the live tournament (additive only). P2+ ship after or behind the league switcher without touching the FIFA league.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Corrupting live-tournament money data** (real ₹ owed between friends) | Critical | Additive-only until settlement; balance-parity script as a hard gate; transaction-wrapped rehearsed migrations; DB snapshot before each |
| **Local dev = prod DB** | Critical | Highest-priority debt item (§14): create a Supabase branch/staging project *before* any platform migration runs |
| **Static match-ID invariant** (CLAUDE.md ⛔; PR #15 precedent) | High | Never rewrite existing `bets.match_id`; bridge via `match_ref`; keep legacy IDs queryable forever for the FIFA league |
| **RLS/auth gaps in multi-tenant mode** (today everything is world-readable with the anon key; `news_cache`/`spatial_ref_sys` already have RLS off) | High | P3 gate: penetration checklist — every route asserts membership; RLS policies membership-scoped; fix the two exposed tables |
| **Scope creep** (the vision lists ~10 subsystems) | High | Hard MVP boundary (§13); everything else is roadmap |
| **Double-entry drift between `bets` (legacy text match_id) and new UUID refs** | Medium | Single write path (v2 RPCs) as soon as M5 lands; consistency check in CI |
| **`SUPABASE_SERVICE_ROLE_KEY` missing in Vercel** (known issue — already breaks duel settlement) | Medium | Fix before P1; v2 settlement is service-role-only and will hard-fail without it |
| **Prop-drilled Context state buckling under multi-league state** | Medium | League-scoped context (one league active at a time) keeps state size identical to today |
| **FIFA adapter rot after tournament** | Low | Isolated in `lib/providers/fifa.js`; deleting it later touches nothing else |

---

## 12. Future Roadmap

Post-MVP, roughly ordered:

1. **Richer prediction markets** — exact score, MVP, first scorer, total goals as reusable market *types* (the `special_markets.scoring`/`config` design already accommodates them).
2. **Notifications** — web push ("match closes in 1h", "you won"), email digests; the `activity` table is the event source.
3. **Viewer role** and public/read-only leagues.
4. **QR-code + email invitations** (invites table already supports codes; QR is a rendering concern).
5. **Prize-pool integration** — `league_prize_pools` + a payment provider (UPI/Stripe), mapping final standings to payouts; the manual `settlements` flow is the interim.
6. **More templates** — IPL, Champions League, generic "single-elimination bracket," "round robin"; template = entrants + matches + markets + rules JSON.
7. **Result-provider marketplace** — cricket/football score APIs as adapters for auto-resolution.
8. **Per-league theming** — accent color/logo on the existing CSS-var system.
9. **Season/multi-league aggregation** — group-level "champion of champions" leaderboards.
10. **Mobile PWA** — manifest + service worker + offline shell (currently absent).
11. **TypeScript migration** — incremental, starting with `lib/`.

---

## 13. Recommended MVP

**Goal: one custom league can run end-to-end alongside the finished FIFA league.** That is phases **P0–P3 plus the points-mode scorer**, deliberately excluding special markets, weekly rankings, theming, templates beyond FIFA, and notifications.

MVP contents:
- Groups (invite-link joining only; approval flow deferred), leagues with title/description/image/dates/timezone.
- Roles: owner/admin/member (viewer deferred).
- Admin: create/edit matches (two entrants, date, close time, optional score), enter results manually.
- Members: predict winner; parimutuel **or** simple points mode per league rules.
- Rules: points per correct pick, lock offset, hidden-until-lock, late join, missed-prediction penalty (the four the vision names — all already designed into `league_rules`).
- Leaderboard: all-time per league (reusing existing aggregation).
- FIFA league migrated in as league zero, history intact.

Why this cut: it proves the tenancy model, the generic match model, and the dual scoring engine — the three architecturally risky pieces — while every deferred item (markets, notifications, templates, payments) is additive on top and needs no further schema redesign.

---

## 14. Technical Debt to Address During Migration

Ordered by leverage:

1. **Prod-DB-as-dev-DB** — create a staging Supabase project + seed script; make it a precondition for all platform migrations. *(Critical, do first.)*
2. **Missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel** — already silently breaks duel settlement; v2 settlement depends on it.
3. **Unauthenticated GET routes / world-readable RLS** — acceptable for 10 friends, fatal for multi-tenant; fixed structurally in P3. Also re-enable RLS on `news_cache` (and exclude `spatial_ref_sys` from the anon grant).
4. **Delete dead code** — `components/AdeYaarApp.jsx`, unused assets (`stadium-crowd.mp4`), the `halftime` rollback remnants, duplicate-numbered migrations (`030_*` twice — adopt strict sequential numbering going forward).
5. **Drop `profiles.balance`** — misleading dead column.
6. **Consolidate the seven special-bet API routes + seven modals** into the generic market pattern (P4 does this by design).
7. **Scattered deadline constants** — ISO strings live in migrations 009/021/024/032/033; v2 moves all deadlines to data (`matches.close_ts`, `special_markets.close_ts`).
8. **Double-submission guard** — known race (two taps can both pass balance check); add idempotency keys to v2 prediction RPCs (client-generated UUID, unique index).
9. **No component tests** — add smoke tests for the new wizard/admin surfaces; keep business-logic-first testing culture.
10. **`bets.match_id` overloading** (match IDs, pool sentinels like `CUP_WINNER`, `_topup` convention) — v2 separates concerns via `match_ref`/`market_ref`; `_topup` becomes a proper `adjustments` concept or a market-less bet kind with explicit filtering in one shared query helper.
11. **Env/config hygiene** — retire `ADMIN_SECRET` and the `adeyaar26-setup` magic string for `/api/setup`.

---

## 15. Suggested Folder Structure After Refactor

```
app/
  (marketing)/                 # landing, login, join
    login/
    join/[code]/               # invite redemption
  (platform)/
    leagues/                   # "My Leagues" home + creation wizard
      new/
    groups/[groupId]/          # group settings, members, approvals
  (league)/[leagueId]/         # ← everything league-scoped lives here
    (tabs)/
      home/
      matches/                 # was fixtures/
      markets/                 # was specials/
      leaders/
      account/
    admin/                     # owner/admin only
      matches/                 # match CRUD + result entry
      members/
      rules/
      markets/
  api/
    groups/…
    leagues/[leagueId]/
      init/  matches/  predictions/  pool/  markets/  challenges/
      leaderboard/  activity/  members/  rules/
    invites/
    auto-resolve/              # provider-driven cron
components/
  ui/                          # Toast, SectionHead, sheets, EntrantBadge, countdowns
  match/                       # MatchCard, HeroMatch, PlaceBetSheet→PredictSheet, pool table
  market/                      # MarketCard, MarketPredictionModal (replaces 7 FIFA modals)
  league/                      # LeagueCard, switcher, wizard steps, rules editor
  admin/
  screens/                     # per-tab screen compositions
lib/
  core/                        # ledger.js, scoring.js (points+parimutuel), odds.js
  providers/                   # fifa.js, manual.js, index.js
  templates/                   # fifa-wc-2026.json (extracted lib/data.js)
  supabase*.js  auth.js  LeagueContext.jsx
supabase/migrations/           # 034+ platform migrations
docs/
  custom-prediction-platform-plan.md   # this document
__tests__/                     # existing suites + scoring-mode + membership tests
```

---

## 16. Estimated Complexity per Phase

T-shirt sizes assume one experienced developer with AI assistance; "weeks" are calendar-ish, part-time-friendly.

| Phase | Size | Est. effort | Dominant work | Risk level |
|---|---|---|---|---|
| P0 Foundations | **S** | 2–4 days | SQL DDL, scaffolding, deletions | Low (additive) |
| P1 Tenancy core + FIFA backfill | **L** | 1.5–2.5 wks | Backfill correctness, membership checks, league switcher | **High** (touches live money data) |
| P2 Generic matches & predictions | **L** | 2–3 wks | v2 RPCs, dual scoring engine, generic match UI, result entry | Medium-high |
| P3 Invites & roles | **M** | 1–1.5 wks | Invite flows, role enforcement sweep across all routes, RLS tightening | Medium (security-sensitive) |
| P4 Special markets | **M** | 1–1.5 wks | Generic market model/UI, FIFA specials as seeds, penalties config | Medium |
| P5 Leaderboard & polish | **S–M** | ~1 wk | Time-bucketed rankings, theming, terminology sweep | Low |
| P6 Template & cleanup | **S** | 2–4 days | Seed extraction, destructive migration M8, docs | Low (but destructive — gated) |

**Total: roughly 7–10 weeks part-time; MVP (P0–P3) ≈ 4–6 weeks.**

---

## Appendix: Design Decisions Worth Recording

- **Extend `bets`, don't replace it.** Money history is sacred (real settlement pending); a new `predictions` table would force a risky copy of live financial rows. Column additions + v2 RPCs get the same result with zero data movement.
- **Two scoring modes, one table.** Points mode as amount-0/fixed-payout bets keeps every downstream consumer (leaderboard, achievements, activity, settlement) working unmodified.
- **Rules as a row, not columns on `leagues`.** `league_rules` isolates the churn-prone config surface and gives the `extra` jsonb escape hatch templates will need.
- **Markets as data, not code.** The FIFA experience proved specials churn constantly (17 bet kinds in 33 migrations). `special_markets` turns "add a special" from a migration + modal + route into an admin-UI action.
- **Provider adapters, not a FIFA rewrite.** The FIFA coupling is quarantined behind one interface rather than generalized prematurely; a manual-entry provider is the universal fallback that makes the platform sport-agnostic on day one.
