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

## 2026-07-09
- **[fix]** Aligned all knockout minimum bets across the UI and the server, which had
  drifted apart. Final values: R32 50, R16 100, QF 250, SF 350, Final 500, 3rd-place 400.
  The **Final** was ₹1000 on the client but ₹500 on the server (UI blocked valid bets); the
  **3rd-place** match was ₹350 on the client but ₹500 on the server (UI *allowed* a bet the
  server then rejected). Both now agree. Needs migration 036 applied to the DB.
  _Files: lib/currency.js, supabase/migrations/036_align_ko_bet_minimums.sql,
  __tests__/min-bet.test.js, __tests__/penalty.test.js. By: Claude Code (PR #46)._
- **[fix]** Reliability + logging fixes from the audit: a Final Four modal was calling
  `qfDeadlineTs()` with a stray argument; two JSX conditionals could leak a literal `0`
  onto the screen (total-goals projection, live-watch banner); the auto-resolve
  fire-and-forget fetch had no error handling. Also added `console.error` logging at the
  auto-resolve penalty settle and the FIFA/background fetch — the app previously swallowed
  every failure silently, so prod errors vanished without a trace.
  _Files: app/api/auto-resolve/route.js, lib/BettingContext.jsx, components/FinalFourBetModal.jsx,
  components/index.jsx, app/(tabs)/specials/total-goals/page.jsx. By: Claude Code._
- **[chore]** Removed dead code: the `AdeYaarApp.jsx` monolith shell (426 lines, no longer
  rendered), `GoldenBootBetModal.jsx` (its special isn't registered — would crash if mounted),
  and the 8 MB `stadium-crowd.mp4` splash video (the splash only played before kickoff, which
  has passed — swapped for a lightweight gradient). Updated the CLAUDE.md references that
  pointed at these files.
  _Files: components/AdeYaarApp.jsx (del), components/GoldenBootBetModal.jsx (del),
  public/stadium-crowd.mp4 (del), components/CountdownSplash.jsx, CLAUDE.md, components/CLAUDE.md,
  docs/ai/STATE.md. By: Claude Code._
- **[feat]** UX/accessibility safeguards. (1) A visible keyboard-focus ring on all
  buttons/links/inputs — the app had almost no focus styles, so keyboard and switch-control
  users couldn't tell what was selected. (2) Every special-bet cancel now asks "Cancel this
  bet? Your stake will be refunded." before refunding — only the main match-bet cancel
  confirmed before, so one stray tap on a special could refund real money with no undo.
  _Files: app/globals.css, components/{FinalFour,H2H,GoalScorer,ThirdPlaceQualifier,TotalGoals}BetModal.jsx,
  components/R32BetPage.jsx, app/(tabs)/specials/{ko-cup-winner,final-four,total-goals}/page.jsx. By: Claude Code._
- **[perf]** The four special-bet modals (cup winner, continent, H2H, third-place qualifier)
  used to be mounted in the app shell at all times — running their state and effects on every
  screen render even while closed. They now mount only when opened, and their code is
  `next/dynamic`-split into separate chunks fetched on first open. Less work per render.
  _Files: app/(tabs)/layout.jsx. By: Claude Code._
- **[docs]** Added an "Engineering Principles" section to `CLAUDE.md` — behavioural tests
  first (assert outputs, never internal calls), pure domain helpers, strict separation of
  concerns, no silent error swallowing, and a code-review-triggers checklist. Written with
  examples from this repo so it's concrete, not generic.
  _Files: CLAUDE.md. By: Claude Code._
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
