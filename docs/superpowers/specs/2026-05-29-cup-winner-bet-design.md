# World Cup Winner Bet — Design

**Date:** 2026-05-29
**Status:** Approved
**Author:** Jayesh + Claude

## Goal

Add a tournament-long meta-bet: pick which of the 48 FIFA World Cup 2026 teams will lift the trophy. Bet opens immediately, closes 1 hour before the opening match kickoff (`2026-06-11T20:00:00-06:00` minus 1h). Users can change their pick freely until the deadline. Settled parimutuel-style after the final.

In parallel, tighten per-match betting cutoff: bets on a specific match close 30 seconds before that match's scheduled kickoff (DB-enforced).

In parallel, remove all "Yaaron" branding strings.

## Non-goals

- Automatic tournament-final detection / auto-settlement (admin runs the settle RPC).
- Desktop-specific polish for the new modal/CTA (works there but not custom-styled).
- Showing the cup-winner pool on the leaderboard screen.
- Renaming the app or the `adeyaar` brand — only the word "Yaaron".

## Decisions

1. **Scope = 48 teams**, not 16. Real WC 2026 data is already in `lib/data.js` with all 48 teams in 12 groups.
2. **Per-match cutoff = 30 seconds before kickoff.** "A few seconds" was the ask; 30s buffers minor client/DB clock skew and is easy to retune.
3. **Cup-winner payout model = parimutuel.** Winners split the total cup-winner pool proportionally to stake — consistent with how match bets resolve today (`resolve_match` in `003_ledger_model.sql`). No fixed odds.
4. **One active cup-winner bet per user.** Changing the pick cancels the existing bet (refunding stake via the existing `bet_cancelled` activity event) and inserts a new one — atomically inside the RPC. This mirrors the "switch sides" flow already in `place_bet`.
5. **Auto-popup uses `localStorage`** (`adeyaar_cup_winner_popup_seen`). Opens once on first login for users without a cup-winner bet; closeable; re-openable any time via the homepage CTA.
6. **DB-enforced match cutoff.** A new `match_schedule` table holds `(id, kickoff_ts)` for all 48 matches, seeded from `MATCHES` inline in the migration. `place_bet` rejects `now() >= kickoff_ts - interval '30 seconds'`.

## Data model

### Reuse `public.bets`

Add one column and relax one check:

```sql
ALTER TABLE public.bets
  ADD COLUMN kind text NOT NULL DEFAULT 'match'
  CHECK (kind IN ('match', 'cup_winner'));

ALTER TABLE public.bets DROP CONSTRAINT bets_pick_check;
-- pick stores 'home'|'away'|'draw' for match bets, team code (e.g. 'ARG') for cup_winner.
-- Validation now lives in the RPCs.
```

Sentinel `match_id = 'CUP_WINNER'` for all cup-winner rows. `pick` holds the team code.

Rationale for reuse: the existing `compute_balance` SQL function, `lib/ledger.js` `computeBalance`, the activity feed, and the leaderboard all aggregate over `bets` and now Just Work for the new bet type with zero changes.

### New `public.match_schedule`

```sql
CREATE TABLE public.match_schedule (
  id text PRIMARY KEY,
  kickoff_ts timestamptz NOT NULL
);
```

Seeded inline with all 48 rows from `lib/data.js` MATCHES (UTC timestamps). Read-only RLS for authenticated/anon select.

### Tournament constant

```sql
CREATE OR REPLACE FUNCTION public.cup_winner_deadline() RETURNS timestamptz AS $$
  SELECT '2026-06-11T20:00:00-06:00'::timestamptz - interval '1 hour'
$$ LANGUAGE sql IMMUTABLE;
```

## Server (RPCs)

### `place_cup_winner_bet(p_user_id, p_team_code, p_amount)`

1. Validate `p_team_code` is a real team (check against a hardcoded array of the 48 codes — kept in the migration so the DB is source-of-truth).
2. Validate `p_amount > 0`.
3. Reject if `now() >= cup_winner_deadline()` → `'Cup winner betting closed'`.
4. Lock user row, find any existing pending row with `kind='cup_winner'` for the user. If found:
   - If same team and same amount → `'Already on this team for this amount'`.
   - Else mark cancelled, write `bet_cancelled` activity with `reason='cup_winner_switch'` and the refunded amount.
5. Recompute balance, reject if `p_amount > balance` → `'Insufficient balance'`.
6. Insert new row with `kind='cup_winner'`, `match_id='CUP_WINNER'`, `pick=p_team_code`, `amount=p_amount`.
7. Write `bet_placed` activity with `kind='cup_winner'`, `team=p_team_code`, `amount`.
8. Return `{ id, balance, team_code, amount }`.

### `cancel_cup_winner_bet(p_user_id)`

Cancels current pending cup-winner row before deadline. Refund activity. Rejects post-deadline.

### `settle_cup_winner(p_winning_team_code)`

Admin RPC (called manually). Parimutuel distribution across all pending `kind='cup_winner'` rows; mirrors `resolve_match` logic but groups by team code. Idempotent guard: errors if no pending cup-winner bets remain.

### Modify `place_bet`

Add a kickoff cutoff check after the existing pick/amount/user guards:

```sql
SELECT kickoff_ts INTO v_kickoff
  FROM public.match_schedule WHERE id = p_match_id;
IF v_kickoff IS NULL THEN
  RAISE EXCEPTION 'Unknown match';
END IF;
IF now() >= v_kickoff - interval '30 seconds' THEN
  RAISE EXCEPTION 'Betting closed for this match';
END IF;
```

## Client

### `lib/cup-winner.js` (new)

```js
export const CUP_WINNER_DEADLINE_TS = KICKOFF_TS - 60 * 60 * 1000;

export async function placeCupWinnerBet(userId, teamCode, amount) { ... }
export async function getMyCupWinnerBet(userId) { ... }
export async function getCupWinnerPool() { ... } // { byTeam: { ARG: 1500, BRA: 800, ... }, total, bettorCount }
```

### `lib/countdown.js`

Export `CUP_WINNER_DEADLINE_TS` (re-export from `cup-winner.js` is fine, or compute here).

### `lib/data.js`

Add `getMatchKickoffTs(matchId)` → `Date.parse(\`${match.date}T${match.time}:00Z\`)`. Returns ms epoch UTC for client-side cutoff display.

### API: `app/api/cup-winner-bet/route.js` (new)

- `GET ?user_id=...` → `{ myBet: {team_code, amount, status} | null, pool: { byTeam, total, bettorCount }, deadlineTs }`
- `POST { userId, teamCode, amount }` → calls `place_cup_winner_bet` RPC. Error mapping mirrors `app/api/bets/route.js`.

### `components/CupWinnerBetModal.jsx` (new)

Centered modal, dark theme to match existing app. Sections:

- **Header:** trophy emoji, "Pick the World Cup Winner", close button (X).
- **Deadline banner:** live ticking countdown to `CUP_WINNER_DEADLINE_TS`. After deadline: "Locked in".
- **Current pick block (if exists):** flag + team name + stake. "Tap a team to change."
- **Team grid:** 12 group sections (A–L). Each section shows 4 teams as tappable tiles (flag emoji + 3-letter code + full name). Selected tile highlights.
- **Stake input:** integer slider/input. Min 100, default = existing stake or 500, max = current balance + existing stake.
- **Submit button:** "Place bet" / "Update pick" / "Update stake". Disabled if no change.
- **Post-deadline:** all interactive controls disabled, message: "Betting closed — locked on {team}."

Props: `{ open, onClose, user, balance, myCupWinnerBet, onPlaced }`.

### `components/CupWinnerCTA.jsx` (new)

Homepage banner mounted in `HomeScreen.jsx` right after `<HeroMatch>`. States:

- **No bet, pre-deadline:** "🏆 Pick the World Cup winner — closes in {countdown}" + "Bet now" button.
- **Has bet, pre-deadline:** "🏆 You're backing {flag} {team} for {amount} — change in {countdown}" + "Update" button.
- **Post-deadline, has bet:** "🏆 Locked on {flag} {team} for {amount}".
- **Post-deadline, no bet:** "🏆 You missed the cup-winner bet" (muted).

Click → `onOpenCupWinner()`.

### `components/AdeYaarApp.jsx` (modify)

- Add state: `cupWinnerOpen`, `myCupWinnerBet`.
- Load `myCupWinnerBet` via GET `/api/cup-winner-bet?user_id=...` whenever bets refresh.
- On first user load: if `!myCupWinnerBet` && `Date.now() < CUP_WINNER_DEADLINE_TS` && `localStorage.getItem('adeyaar_cup_winner_popup_seen') !== '1'` → `setCupWinnerOpen(true)`.
- On modal close: `localStorage.setItem('adeyaar_cup_winner_popup_seen', '1')`.
- Pass `onOpenCupWinner={() => setCupWinnerOpen(true)}` down to `HomeScreen`.
- Mount `<CupWinnerBetModal>` at app root.

### `components/screens/HomeScreen.jsx` (modify)

Accept `onOpenCupWinner`, `myCupWinnerBet` props. Render `<CupWinnerCTA>` directly after `<HeroMatch>`.

### Per-match 30s cutoff (client)

In `components/HeroMatch` / `MatchCard` / `PlaceBetSheet` (wherever bet buttons render): compute `kickoffTs = getMatchKickoffTs(match.id)` and disable the bet button when `Date.now() >= kickoffTs - 30_000`. A small label appears: "Closed".

Server already enforces; client disable is UX polish so users don't try and fail.

## Rebrand: remove "Yaaron"

Six string replacements:

| File | Line | Before | After |
|---|---|---|---|
| `components/CountdownSplash.jsx` | 251 | `The Yaaron Cup` | `The World Cup` |
| `components/CountdownSplash.jsx` | 271 | `adeyaar.app / yaaron-cup-2026` | `adeyaar.app / world-cup-2026` |
| `components/CountdownSplash.jsx` | 317 | `Yaaron Cup` | `World Cup` |
| `components/desktop/DesktopApp.jsx` | 66 | `Group · Yaaron` | `Group · Friends` |
| `components/desktop/DesktopApp.jsx` | 86 | `My position · Yaaron Cup` | `My position · World Cup` |
| `components/desktop/DesktopApp.jsx` | 878 | `Yaaron group · friend betting pool` | `Friends · friend betting pool` |

`adeyaar` / `AdeYaar` / package name unchanged — that's the app brand.

## Files

**New**
- `supabase/migrations/006_cup_winner_and_match_cutoffs.sql`
- `lib/cup-winner.js`
- `components/CupWinnerBetModal.jsx`
- `components/CupWinnerCTA.jsx`
- `app/api/cup-winner-bet/route.js`

**Modified**
- `lib/data.js` — add `getMatchKickoffTs`.
- `lib/countdown.js` — export `CUP_WINNER_DEADLINE_TS`.
- `components/index.jsx` — export new components.
- `components/AdeYaarApp.jsx` — wire popup state, modal mount, CTA prop wiring.
- `components/screens/HomeScreen.jsx` — render CTA banner.
- `components/HeroMatch.jsx` (or `components/index.jsx`) — 30s pre-kickoff disable.
- `components/CountdownSplash.jsx` — rebrand strings.
- `components/desktop/DesktopApp.jsx` — rebrand strings.

## Test plan

1. **Migration applies cleanly** via `supabase db push`.
2. **First-login popup** opens on a fresh browser profile; closing sets localStorage flag; reload does not re-open.
3. **CTA on homepage** shows correct state in all four conditions (with/without bet × before/after deadline — simulate "after" by temporarily flipping `CUP_WINNER_DEADLINE_TS`).
4. **Place / update flow:** bet on Argentina ₹500 → balance drops by 500. Change to Brazil ₹800 → activity log shows cancellation + new bet, balance drops by an additional 300.
5. **Insufficient balance** rejected with a toast.
6. **Deadline guard:** with system clock past deadline (or `CUP_WINNER_DEADLINE_TS` mocked), modal is read-only and POST returns 400.
7. **Per-match cutoff:** mock a match in `match_schedule` with `kickoff_ts = now() + 20s`; verify `place_bet` rejects after 5s wait. UI also disables.
8. **Settlement:** seed two users with cup-winner bets on different teams; run `settle_cup_winner('ARG')`; verify parimutuel payouts and `bet_won` activity rows.
9. **Build:** `npm run build` succeeds, no type/lint errors.

## Risks / followups

- **Clock skew:** server-side `now()` is authoritative; client countdown is display-only. A user with a wildly fast clock won't bypass it.
- **Multiple devices:** localStorage popup-seen flag is per-browser. Acceptable.
- **No team for "withdrew from tournament":** if FIFA pulled a team, refund logic isn't built. Out of scope.
- **Settle button in admin UI:** not built; admin uses SQL editor for now.
