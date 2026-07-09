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
- **[chore]** Added CI. A GitHub Actions workflow now runs lint + the Jest suite +
  a production build on every push to `main` and every pull request, so regressions
  get caught before merge instead of only by the local pre-commit hook. Also added a
  committed ESLint config (`.eslintrc.json`) — there wasn't one, so `next lint` used to
  prompt interactively and couldn't run in CI. The cosmetic `react/no-unescaped-entities`
  rule is disabled (it trips on ordinary English apostrophes); real rules stay as warnings.
  _Files: .github/workflows/ci.yml, .eslintrc.json. By: Claude Code._

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
