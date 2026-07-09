# AI Session Log (append-only)

**Audience: AI agents.** Every Claude Code (or other AI) session that changes this repo
MUST append an entry here before committing. Never edit or delete old entries.
Newest entries at the TOP (below this header block).

**Entry template:**
```
## YYYY-MM-DD — <one-line task summary>
- **Task:** what the user asked for
- **Changes:** files touched + what was done in each
- **Decisions:** non-obvious choices made and why
- **Gotchas / learnings:** anything a future agent should know (stale docs found,
  traps hit, prod quirks) — also promote durable ones into CLAUDE.md
- **Verification:** what was run (npm test / build / manual) and the result
- **Left undone / follow-ups:** anything pending
```

---

## 2026-07-09 — Lower Final minimum bet to 500 (PR #46)
- **Task:** Make the Final's minimum bet 500 instead of 1000.
- **Change:** `lib/currency.js` `STAGE_MINIMUMS.FIN` 1000 → 500; updated the two `getMinBet`
  tests (`min-bet.test.js`, `penalty.test.js`) that pinned `FIN-1 → 1000`.
- **Decision:** No migration — the server `bet_min()` RPC (migration 026) already returns 500
  for `FIN-%`. This was pure client/server drift; the UI was stricter than the backend.
- **Gotcha:** Same drift still exists on QF (client 250 / server 200), SF (350 / 300) and
  3RD (client 350 / server **500** — client lets you attempt a sub-500 bet the server rejects).
  Left as-is (out of scope); flagged in PR #46.
- **Verification:** 356/356 tests pass, `next build` clean.
- **Doc note:** This entry lives on the doc-consolidation branch (#45) so it doesn't
  re-introduce the append-conflict; PR #46 itself carries only code + tests.

## 2026-07-09 — Audit fix PRs #40–#44 (consolidated entry)
- **Task:** Multi-PR audit cleanup ahead of open-sourcing. Each concern shipped as its own
  fork PR against `jayPreak:main`. This single entry documents #40–#44 together because the
  per-PR SESSION_LOG/CHANGELOG edits were removed from those branches (see gotcha below).
- **PRs:**
  - **#40 fix/reliability-bugs-and-logging** — `qfDeadlineTs()` stray arg; two JSX `0`-leak
    guards (`total-goals`, live-watch); error handling on the auto-resolve fire-and-forget;
    `console.error` at auto-resolve penalty settle + FIFA/background fetch (app had zero
    error logging → prod failures vanished).
  - **#41 chore/remove-dead-code** — deleted `AdeYaarApp.jsx` (426-line unrendered monolith),
    `GoldenBootBetModal.jsx` (unregistered special, would crash), `stadium-crowd.mp4` (8 MB,
    splash only plays pre-kickoff which has passed → gradient). Verified no imports first.
  - **#42 feat/ux-a11y-safeguards** — global `:focus-visible` ring; confirm-before-cancel on
    every special-bet + duel cancel path (only match-bet cancel confirmed before).
  - **#43 perf/lazy-load-modals** — 4 always-mounted special modals → `next/dynamic`, gated on
    open flag. Runtime win (no effects on closed modals every render), not a bundle-size claim.
  - **#44 docs/engineering-principles** — added "Engineering Principles" section to `CLAUDE.md`
    (behavioural-tests-first, pure helpers, no silent swallows, code-review triggers).
- **Gotcha / learning (IMPORTANT for future parallel PRs):** all N open PRs appended to the
  same top-of-file region of `CHANGELOG.md` and `docs/ai/SESSION_LOG.md`. Once #38/#39 merged,
  every later PR 3-way-conflicted there on every merge. Fix: reverted each branch's edits to
  those two files back to their merge-base (net diff = 0 → git auto-resolves, no manual
  conflict), and consolidated the content here in one PR. Added `.gitattributes` with
  `merge=union` on both log files so future parallel edits auto-concatenate instead of
  conflicting. **Doc protocol still applies — but doc-log edits should land in a single PR,
  or via the union driver, not appended in parallel across many open PRs.**
- **Verification:** `git merge-tree` confirms all five branches merge clean against `origin/main`
  and pairwise; PR diffs no longer include the two log files.
- **Left undone / follow-ups:** rotate the Postgres DB password + scrub git history before the
  repo goes public; the larger LOC/reuse/testability refactor is planned separately.

## 2026-07-09 — Add CI (GitHub Actions)
- **Task:** Set up CI/CD — the repo had none (only a local pre-commit hook + a Vercel cron).
- **Changes:** `.github/workflows/ci.yml` — runs `npm run lint`, `npm test`, `npm run build`
  on push to main + every PR. Node 20, npm cache, placeholder public env for a deterministic build.
  `.eslintrc.json` — new; extends `next/core-web-vitals`.
- **Decisions:** build step gets placeholder `NEXT_PUBLIC_SUPABASE_*` env — the Supabase
  clients no-op without real values, so the build never touches prod. There was **no committed
  ESLint config**, so `next lint` prompted interactively and would hang in CI (earlier "lint clean"
  signals were the RTK proxy fabricating output). Disabled `react/no-unescaped-entities` (cosmetic,
  ~15 false-positives on English apostrophes); kept `exhaustive-deps` + `no-img-element` as warnings.
- **Verification:** real `next lint` → 0 errors, exit 0; `npm test` 356 pass; `next build` exit 0.
- **Left undone / follow-ups:** could add Playwright e2e as a separate job later (needs a test DB).
  This eslintrc must land on main (via this PR) for the other PRs' CI to lint cleanly.
## 2026-07-09 — Repo audit + open-source prep (multi-PR)
- **Task:** Full audit (UI/UX, speed, bugs, CI/CD, SonarQube). Ship fixes as multiple
  focused PRs. Repo is being prepped for open source, so higher quality bar.
- **PR: redact-committed-secrets** — scrubbed the Postgres DB password, Supabase project
  ref, and anon JWT from `docs/ARCHITECTURE.md` and one plan doc. All were committed in
  plain text.
- **Gotchas / learnings:** Secrets remain in git *history* — redaction commits do not
  remove them. The DB password (`SUPABASE_DB_PASSWORD`) MUST be rotated in Supabase
  before the repo goes public. Anon key is public-by-design (RLS-protected) but was
  rotated-worthy hygiene anyway. PRs come from fork `pratyush-skima/adeyaarbet26`
  (no push access to `jayPreak/adeyaarbet26`).
- **SonarQube baseline (2026-07-09):** 0 vulns, 4 bugs, 411 smells (mostly nested
  ternaries S3358 ×201 + complexity S3776 ×77), 5 hotspots (all Math.random for
  animation / dev script → Safe), 7.7% duplication. Reliability rating D from the 4 bugs.
- **Verification:** `git grep` confirms no secrets remain in tracked files.
- **Left undone / follow-ups:** rotate DB password; scrub git history (BFG/filter-repo)
  if required before publishing; remaining PRs (CI, observability, cleanup, UX, speed).

---

## 2026-07-05 — Set up AI documentation system
- **Task:** Make the repo self-documenting for AI work: doc-update protocol enforced
  before every commit, human changelog, AI session log, current-state file,
  directory-level CLAUDE.md files.
- **Changes:**
  - `CLAUDE.md` — added mandatory "Documentation Protocol" section + doc map at top;
    fixed stale Frontend Architecture (real shell is `app/(tabs)/layout.jsx` +
    `lib/BettingContext.jsx`; `components/AdeYaarApp.jsx` is dead code); updated file
    layout (route group, new modals, lib files, migrations now 001–033); added failure
    modes #10 (missing `SUPABASE_SERVICE_ROLE_KEY` on Vercel) and #11 (AdeYaarApp dead
    code); updated feature checklist.
  - `CHANGELOG.md` — new, human-readable, with reconstructed recent history.
  - `docs/ai/SESSION_LOG.md` — this file.
  - `docs/ai/STATE.md` — new, current system state snapshot.
  - `app/api/CLAUDE.md`, `components/CLAUDE.md`, `lib/CLAUDE.md` — new directory-level
    references (Claude Code auto-loads these when working in those dirs).
- **Decisions:** Kept `docs/ARCHITECTURE.md` and `PLAN.md` as-is (marked as
  possibly-lagging in the doc map; root CLAUDE.md wins on conflict). Did not put any
  credentials in repo docs. Nothing committed — user asked for changes only.
- **Gotchas / learnings:** Root CLAUDE.md had significantly drifted: it described the
  pre-refactor AdeYaarApp architecture. Tournament is mid-knockout stage (migrations
  through 033, R32/QF features live).
- **Verification:** Docs-only change; no build/test needed.
- **Left undone / follow-ups:** User to review and commit. Consider a pre-commit hook
  or `.claude/settings` hook to hard-enforce the doc protocol.
