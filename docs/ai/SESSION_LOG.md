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

## 2026-07-10 — Live match stream on Home (per FEATURE_live-stream.md spec)
- **Task:** Implement the pre-written spec at `docs/ai/FEATURE_live-stream.md` — a
  collapsible embedded live-video panel on the Home page for live matches, with
  a row of source-switch buttons so users can flip between stream mirrors.
- **Changes:**
  - `lib/streams.js` — NEW. Hardcoded `MATCH_STREAMS` map keyed by our static
    match ids (`QF-1`…`QF-4`), each value = array of `{label, url}` mirrors.
    Snapshot fetched from streamed.pk `/api/matches/football` + `/api/stream/{source}/{id}`
    on 2026-07-10. `getStreams(matchId)` returns `[]` for unknown ids.
  - `components/LiveStreamPanel.jsx` — NEW. Collapsed by default. Renders
    nothing when the match has no stream mapping. When expanded, mounts a
    single 16:9 iframe (`allow="encrypted-media; picture-in-picture"`,
    `allowFullScreen`, `loading="lazy"`) with source-switch buttons below.
    Iframe is NOT rendered while collapsed, so it doesn't autoplay/eat data.
  - `components/screens/HomeScreen.jsx` — imported `LiveStreamPanel`; rendered
    ABOVE `<HeroMatch>` when `featured?.status === 'live'`, and above the
    non-featured live match cards.
- **Decisions:**
  - Followed the spec's "no runtime API call" decision — the map is a static
    build-time snapshot. Refresh instructions are in `lib/streams.js` header.
  - Did NOT add an iframe `sandbox` attribute yet (spec suggests testing without
    first; too-strict sandboxes break embedded players).
  - Skipped SF/FIN/3RD in the map — those matches don't exist on streamed.pk
    yet (QFs still being played). Add closer to those kickoffs.
  - QF-4 (Argentina vs Switzerland) shipped with an empty array — streams
    weren't populated at snapshot time. Panel simply won't render until URLs
    are added.
- **Gotchas / learnings:**
  - `streamed.pk` `admin` source returns `embed.st` URLs matching exactly the
    verbatim iframe examples in the spec — the spec's slug pattern
    (`ppv-{home}-vs-{away}/{sourceNo}`) held for both matches checked.
  - `golf` source `/api/stream/golf/{id}` returned empty for `23636` and
    `23656` (not always populated). Preferred `admin` mirrors when available.
- **Verification:**
  - `rm -rf .next && npm run build` → passes, `/home` route builds at 6.2 kB.
  - `npm test` → 356/356 pass.
  - Manual browser: (user to verify — dev server not started here).
- **Left undone / follow-ups:**
  - Populate SF-1, SF-2, FIN-1, 3RD-1 in `MATCH_STREAMS` when streams appear
    on streamed.pk.
  - Populate QF-4 mirrors when they appear.
  - Optional: add `sandbox="allow-scripts allow-same-origin allow-presentation"`
    if PPV embeds prove abusive with popups.

---

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
