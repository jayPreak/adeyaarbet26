# Changelog

Human-readable log of every change made to AdeYaar 26 — including changes made by AI
(Claude Code). Newest entries first. Every commit should have a matching entry here.

**Format:**
```
## YYYY-MM-DD
- **[feat|fix|docs|chore]** Short plain-English description of what changed and why.
  _Files: main files touched. By: human name or "Claude Code"._
```

---

## 2026-07-20 (final)
- **[chore]** Settled the last open special bet: **Total Goals O/U 299.5** →
  over (final tally confirmed at 308 goals), 4 winners, ₹1400 pool. All
  special bets for the tournament are now settled. _Files: docs/ai/STATE.md,
  docs/ai/SESSION_LOG.md. By: Claude._

## 2026-07-20 (later)
- **[chore]** Actually ran the settlement RPCs the prior entry below could only
  prepare: **Cup Winner** settled to Spain (2 payouts), **Winning Continent**
  settled to UEFA (6 payouts). Golden Boot and Messi-v-Ronaldo/Final Four had
  nothing pending to settle. **Total Goals O/U is still open** — couldn't find
  a trustworthy final goal count for the tournament, so left it pending rather
  than guess with real money on the line. The Home tab settlement card now
  reflects the real final numbers for everyone. _Files: none (DB-only via
  Supabase RPCs), docs/ai/STATE.md, docs/ai/SESSION_LOG.md. By: Claude._

## 2026-07-20
- **[feat]** Home tab now shows the final real-money settlement once the
  tournament is over — your personal "you owe / you receive" card and the
  full who-pays-whom plan, right at the top of Home instead of only living
  on the Bets/Leaders tabs. Reuses the existing settlement components as-is
  (no new money math), gated by whether the cup-winner special has resolved.
  _Files: components/screens/HomeScreen.jsx. By: Claude._
- **[chore]** Added `scripts/settle-tournament-2026.sql` with the real-world
  2026 World Cup results (Spain won the Final 1-0 AET over Argentina; Mbappé
  won the Golden Boot with 10 goals; England beat France 6-4 for 3rd; the
  semifinalists were Spain, Argentina, France, England) mapped to the actual
  settlement RPCs (`settle_cup_winner`, `settle_special`,
  `settle_final_four`). **These have NOT been run yet** — see docs/ai/STATE.md
  and the note below.
- **[docs]** Fixed several stale spots in `CLAUDE.md`: the "Specials Without
  Settlement RPCs" failure mode (#7) claimed continent/h2h/golden_boot need
  manual `UPDATE bets` — they don't, `settle_special` already handles all
  three and hand-editing `bets` would have bypassed the row lock. Also
  removed a reference to a `GOLDEN_BOOT_CANDIDATES` export that doesn't
  exist, and documented that the Golden Boot special has no live UI path
  (dead code, see new failure mode #23).
- ⚠️ **Could not actually settle any bets or push this commit myself.** The
  session I ran in had no network route to Supabase (`*.supabase.co` blocked
  by the sandbox's egress allowlist) and no GitHub push credentials. See
  failure mode #24. Someone with real DB/GitHub access needs to run
  `scripts/settle-tournament-2026.sql` and push this branch.
  _Files: CLAUDE.md, docs/ai/STATE.md, scripts/settle-tournament-2026.sql. By: Claude._

---

## 2026-07-16
- **[fix]** The Final and 3rd-place kickoff dates were swapped. The DB had the
  Final on Jul 19 IST and 3rd place on Jul 20 IST; the real schedule is 3rd place
  **Sun 19 Jul** (France vs England) and Final **Mon 20 Jul** (Spain vs Argentina).
  Swapped the `kickoff_ts` on `FIN-1` (→ 2026-07-19 19:00 UTC) and `3RD-1`
  (→ 2026-07-18 21:00 UTC) in `match_schedule`, and updated the hardcoded bracket
  round-header date labels to match.
  _Files: match_schedule (prod DB), components/screens/BracketScreen.jsx,
  components/desktop/DesktopApp.jsx. By: Claude Code._
- **[fix]** The Final and 3rd-place match were showing the wrong teams. The FIFA
  API labels the two matches with stage IDs that our code had mapped backwards:
  stage `289292` (the last match, #104) is the actual Final and stage `289291` is
  the 3rd-place playoff, but we'd mapped `289291`→Final and `289292`→3rd. Swapped
  the mapping everywhere it appears so the Final now correctly shows **Spain vs
  Argentina** (Jul 18) and 3rd place shows **France vs England** (Jul 19). This
  flows through the bracket display, the betting fixtures page, goalscorer player
  lists, and auto-settlement. No bets existed on either match yet, so nothing was
  mis-settled. Also lowered the **Final minimum bet from ₹1000 to ₹500**.
  _Files: app/api/init/route.js, app/api/fifa/matches/route.js,
  app/api/fifa/knockout/route.js, app/api/auto-resolve/route.js,
  app/api/goalscorer-players/[matchId]/route.js, lib/schedule-sync.js,
  lib/currency.js, __tests__/min-bet.test.js, __tests__/penalty.test.js.
  By: Claude Code._

---

## 2026-07-11
- **[fix]** Fixed a money-consistency bug where clicking "Cancel bet" on a match
  card also silently cancelled the user's active duels on that match. Ten
  duels across R16-5, R16-7, and QF-2 were affected — the challenges tab showed
  them as won/lost correctly, but the P&L graph and net win/loss missed those
  amounts because the underlying `bets` rows were `cancelled`. Root cause: the
  `cancel_bets` SQL function's WHERE clause didn't exclude `kind='challenge'`.
  Fixed at the RPC level (migration 037), backfilled the 10 corrupted rows
  (038), made the settlement RPC fail loud on any future mismatch (039), and
  added a database trigger that enforces the invariant "if a challenge is
  settled, both bets must be won/lost — otherwise abort" (040). The cancel-bet
  button in the UI now shows an explicit confirmation that duels will NOT be
  affected.
  _Files: supabase/migrations/037-040*.sql, lib/BettingContext.jsx, CLAUDE.md,
  docs/ai/STATE.md, docs/ai/SESSION_LOG.md. By: Claude Code._
- **[feat]** P&L graph tooltip now shows duel opponent and pick when a node is
  tapped. Instead of a generic "Duel · +₹200", nodes read
  "Duel vs Ashin · QF ESP v BEL · ESP · +₹200 (100%)". Works on both the
  account overview and the leaderboard profile modal.
  _Files: lib/initDirect.js, lib/BettingContext.jsx, components/screens/BetsScreen.jsx,
  components/screens/LeaderboardScreen.jsx. By: Claude Code._

---

## 2026-07-10
- **[feat]** Live match stream on Home page. When a match is live, a collapsible
  "📺 Watch <Home> vs <Away> — live" bar now appears above the hero match card
  (and above any other live match card on Home). Tapping expands an embedded
  video player with source-switch buttons so users can flip between mirrors if a
  feed buffers/dies. Streams are hardcoded per match id in `lib/streams.js` — no
  runtime API call to the third-party streaming site. Display-only feature: no
  money, betting, pool, or settlement logic touched. Snapshot of mirror URLs
  taken 2026-07-10 covering QF-1 through QF-4; extend `MATCH_STREAMS` for SF/FIN.
  _Files: lib/streams.js (new), components/LiveStreamPanel.jsx (new),
  components/screens/HomeScreen.jsx. By: Claude Code._

---

## 2026-07-09
- **[chore]** Added CI. A GitHub Actions workflow now runs lint + the Jest suite +
  a production build on every push to `main` and every pull request, so regressions
  get caught before merge instead of only by the local pre-commit hook. Also added a
  committed ESLint config (`.eslintrc.json`) — there wasn't one, so `next lint` used to
  prompt interactively and couldn't run in CI. The cosmetic `react/no-unescaped-entities`
  rule is disabled (it trips on ordinary English apostrophes); real rules stay as warnings.
  _Files: .github/workflows/ci.yml, .eslintrc.json. By: Claude Code._
- **[fix]** Redacted committed credentials from docs ahead of open-sourcing: the
  Postgres DB password, the Supabase project ref, and the anon JWT were sitting in
  plain text in `docs/ARCHITECTURE.md` and one plan doc. Replaced with placeholders.
  ⚠️ These are still in git *history* — the DB password MUST be rotated in Supabase
  before the repo is made public.
  _Files: docs/ARCHITECTURE.md, docs/superpowers/plans/2026-06-11-schedule-sync-and-bet-cutoffs.md. By: Claude Code._

---

## 2026-07-05
- **[docs]** Set up the AI documentation system: rewrote stale parts of `CLAUDE.md`
  (the app shell is now `app/(tabs)/layout.jsx` + `BettingContext`, not the old
  `AdeYaarApp.jsx`), added directory-level `CLAUDE.md` files for `app/api`,
  `components`, and `lib`, created this changelog, and added `docs/ai/SESSION_LOG.md`
  (AI session log) and `docs/ai/STATE.md` (current system state). Every AI agent is
  now required to update these docs before committing.
  _Files: CLAUDE.md, CHANGELOG.md, docs/ai/*, app/api/CLAUDE.md, components/CLAUDE.md,
  lib/CLAUDE.md. By: Claude Code._

---

## Earlier (reconstructed from git history)

## 2026-07 (early)
- **[feat]** Total-goals line rescaled to the 96-match window with a live goal tally. (8e2d1b0)
- **[feat]** Duels v2 — fight-card layout, head-to-head records, activity modal. (9dda4d7)
- **[fix]** Match cards no longer show a green outline for duel/prop-only bets. (cf70a3a, 40c4f51)
- **[fix]** iOS Safari bottom-sheet fixes: real visible viewport height (`--vvh`),
  modals above the tab bar, pinned submit buttons, safe-area padding. (6c066ad, a6a5bed, 4a9ee62, 8f562f4, abd6b15)

## 2026-06 (mid-tournament)
- **[feat]** Match props (exact score, over/under 2.5, penalties), friend duels,
  Final Four & Total Goals specials, leaderboard titles. Migration 032. (1a8ddea)
- **[feat]** Live commentary links, min-bet display on knockout cards, R32 support.

_For anything older, see `git log` and PLAN.md._
