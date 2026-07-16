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

## 2026-07-11 — Root-caused cancel_bets duel corruption; strict RPCs + trigger; P&L graph duel tooltip
- **Task:** User (Vaper) reported his two won QF-2 duels were missing from his P&L
  graph despite showing correctly on the Duels tab. Trace, root-cause, fix, and
  document.
- **Investigation (all via `npx supabase db query --linked`):**
  1. Found 10 `challenges` rows across R16-5, R16-7, QF-2, QF-3 with terminal
     status (`settled`/`accepted`) but corresponding `bets` rows in `cancelled`
     status. Vaper's two QF-2 wins were among them.
  2. Every corrupted bet has `bets.resolved_at = NULL` — the fingerprint of a
     cancel path that skipped the settle_* RPCs.
  3. `activity` log shows every corrupted bet correlated 1:1 with a
     `bet_cancelled` event whose payload has `count` + `refunded` fields
     (unique fingerprint of `cancel_bets` RPC — other cancel paths log
     `challenge_id` or `reason`).
  4. Arithmetic proof: e.g. event 1670 (Pratyush R16-5 count=3 refunded=300)
     matches exactly bets 1035+1088+1089 = ₹300, all `kind='challenge'`.
  5. Code inspection: `cancel_bets` (migration 020) does
     `UPDATE bets ... WHERE user_id=? AND match_id=? AND status='pending'`
     — no `kind` filter. It sweeps every pending bet including duels.
- **Fix (4 migrations, all applied to prod):**
  - `037_cancel_bets_excludes_duels.sql`: add `AND kind <> 'challenge'` to the
    UPDATE. Duels must go through `cancel_challenge`/`decline_challenge`/
    `settle_challenges`.
  - `038_backfill_duel_bet_corruption.sql`: 10 idempotent UPDATEs restoring the
    broken bet rows per `challenges.winner_id`:
    - 1166, 1167 (Vaper) → won +200 · Vaper vs Ashin, Vaper vs Jayesh QF-2
    - 1088 (Pratyush) → won +200 · Manan vs Pratyush R16-5
    - 1035, 1089, 1135, 1177, 1179, 1217 → lost
    - 1146 → back to pending (QF-3 duel Manan vs Ashin still accepted)
  - `039_settle_challenges_strict.sql`: `GET DIAGNOSTICS ROW_COUNT` after each
    bet UPDATE; RAISE if 0. Turns silent no-ops into hard failures.
  - `040_duel_bet_state_invariant.sql`: BEFORE UPDATE trigger on `challenges`.
    Any transition to `settled`/`void`/`expired` must have matching bet states
    or RAISE. Schema-level guarantee, no RPC discipline required.
- **UI validation** (`lib/BettingContext.jsx:cancelBet`):
  - Enumerate the user's pending bets on the match, split match/penalty vs
    challenge counts.
  - If only duels present: toast "Duels can't be cancelled from here."
  - If both: confirm dialog explicitly says the N active duels are preserved.
  - Local state after success: mirror server behavior — only match/penalty
    bets marked cancelled, challenges stay pending.
- **P&L graph duel tooltip enrichment:**
  - `lib/initDirect.js`: challenges fetch widened from `.in('status', ['open','accepted'])`
    to all statuses, and payload extended with `challenger_pick`, `amount`,
    `winner_id`, `challenger_bet_id`, `opponent_bet_id`.
  - `lib/BettingContext.jsx`: new `allChallenges` state exposes the full
    history; `challenges` stays narrowed to open+accepted for the active
    duels UI (no regression).
  - `components/screens/BetsScreen.jsx:NetWorthGraph`: accepts optional
    `challenges/allUsers/userId` props. Duel bet label:
    `"Duel vs <opponent> · <stage> <home v away> · <pick>"`.
  - `components/screens/LeaderboardScreen.jsx:UserProfileModal`: fetches
    target user's challenges in parallel with bets and passes them through.
- **Decisions:**
  - Backfill order: fixed the 10 rows in prod BEFORE shipping the strict
    trigger (migration 040) — otherwise the trigger would have blocked my
    own UPDATE statements. Applied 037 first, then 038, then 039, then 040.
  - Level 3 fix (schema restructure to eliminate dual-write between `bets` and
    `challenges`) was rejected as too big mid-tournament. Trigger + strict
    RPC + kind-filter is the durable defense-in-depth path.
  - Kept `challenges` filtered to open+accepted for the active-duels UI
    (`BettingContext.challenges`); added `allChallenges` as separate field
    for anywhere that needs history.
- **Verification:**
  - Post-backfill DB query confirms all 10 rows have correct final state
    (Vaper's 1166/1167 → `won payout=200`, 1146 → `pending`, others → `lost`).
  - Migration 037 verified live via user's 11:00 QF-3 cancel today: refunded
    ₹250/count=1 (one match bet only), the 3 pending QF-3 duels untouched.
  - `npm run build` passes.
- **Gotchas / durable learnings (promoted into CLAUDE.md):**
  - Invariant #6: any bulk-UPDATE on `bets` MUST filter by `kind`.
  - Invariant #7: `challenges` and `bets` must agree; trigger enforces at DB level.
  - Failure mode #20: full trace of the cancel_bets duel-nuke bug.
  - Failure mode #21: P&L graph reads `bets`, duels tab reads `challenges`;
    two views can diverge without invariant enforcement.
- **Left undone / follow-ups:**
  - Add `kind` filter audit for every other RPC that touches `bets` in bulk
    (grep pass done, resolve_match/place_special_bet/cup winner all check
    out — deferred formal audit doc).
  - Consider a partial unique index on `(user_id, match_id, kind) WHERE status='pending'`
    for singleton kinds. Skipped this session because kind='challenge' legitimately
    allows multiple pending per user per match (multiple duels), and the schema
    constraint would need to exclude that.

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

---

## 2026-07-16 — Fix Final/3rd-place matchups + Final min bet

- **Task:** User reported the Final and 3rd-place match showed the wrong teams;
  wanted Final = Spain vs Argentina, 3rd = France vs England, and Final min bet 500.
- **Root cause:** FIFA API returns stage `289291` = FRA vs ENG (match #103) and
  stage `289292` = ESP vs ARG (match #104, the last match = the true Final). Our
  stage-ID→label maps had `289291`→Final / `289292`→3rd, i.e. swapped. So the app
  displayed FRA vs ENG as the Final.
- **Fix:** Swapped `289291`↔`289292` in every stage-mapping table:
  init/route.js, fifa/matches/route.js, fifa/knockout/route.js (id→label);
  auto-resolve/route.js (id→static prefix, used for settlement);
  goalscorer-players/[matchId]/route.js (label→id, reversed); schedule-sync.js.
  Now `289292`→Final→FIN-1 (kickoff Jul 18 from DB), `289291`→3rd→3RD-1 (Jul 19).
- **Min bet:** `lib/currency.js` STAGE_MINIMUMS.FIN 1000→500. Updated two tests
  (min-bet.test.js, penalty.test.js) that asserted 1000.
- **Gotchas:** The stage-ID mapping is duplicated across 6 files — all must stay in
  sync or display/settlement diverge. Static IDs FIN-1/3RD-1 and their kickoffs live
  in `match_schedule` independent of FIFA; the client assigns the static ID from the
  (now-corrected) stage label. Match-bet minimums are client-side only (no server
  RPC gate for match bets).
- **Verification:** `npm test` 356/356 green; `npm run build` clean. Confirmed live
  against prod-backed dev server: `/api/fifa/knockout` and `/api/init` both return
  Final = ESP vs ARG, 3rd = FRA vs ENG. UI is auth-gated so verified at the API
  layer that feeds it. Confirmed no existing bets on FIN-1/3RD-1 (no mis-settlement
  risk from the semantic swap of home/away).
- **Left undone:** User to commit/push to upstream.
