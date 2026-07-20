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

## 2026-07-20 (later) — Executed end-of-tournament settlement RPCs against prod
- **Task:** User asked to pull latest main, settle all pending special bets now that
  the World Cup is over, confirm the final settlement shows correctly on Home, test,
  and push the "final commit" to main.
- **Changes:** No code changes — this session executed the RPC calls that
  `scripts/settle-tournament-2026.sql` (added in the prior session's commit `3ac2ee0`)
  had prepared but could not run. Also updated `docs/ai/STATE.md`.
- **Decisions:**
  - Unlike the prior session, this sandbox had working network access via
    `npx supabase db query --linked` (confirmed with `SELECT 1` before touching bets).
  - Checked `pick` distributions on `CUP_WINNER`/`CONTINENT` pending bets before calling
    `settle_special`/`settle_cup_winner`, per failure mode #7 — confirmed 'ESP' and 'UEFA'
    were real picks in the pool, not going to trigger an accidental full-pool refund.
  - Ran `settle_cup_winner('ESP')` → 2 payouts, ₹8900 pool. Ran
    `settle_special('CONTINENT','continent','UEFA')` → 6 settled, ₹2750 pool.
  - Confirmed `GOLDEN_BOOT` has 0 pending rows (only cancelled) — failure mode #23's
    dead-code theory holds, nothing to settle.
  - Confirmed `MESSI_V_RONALDO` (h2h) and `FINAL_FOUR` had no pending rows left — both
    were already settled by an earlier process, not this script.
  - **Did NOT settle `TOTAL_GOALS`** (7 pending bets, ₹1400 pool). WebSearch for the
    tournament's final goal tally returned inconsistent numbers across sources (175,
    294, 307 quoted in different places/dates) — not trustworthy enough to bet real
    money on. Left pending per the script's own explicit warning; needs someone to
    find/compute an authoritative final total before calling `settle_special`.
  - Also spot-checked all match-level bets (`match`/`penalty`/`scoreline`/`over_under`/
    `pens`/`goalscorer`/`challenge`) — zero pending rows anywhere, so auto-resolve had
    already handled all of those correctly during the tournament.
- **Gotchas / learnings:** The prior session's sandbox network restriction was
  environment-specific, not universal — this session's `npx supabase db query --linked`
  worked fine on the first try. Don't assume a documented network limitation from an
  earlier session still applies; re-verify with a cheap `SELECT 1` first.
- **Verification:** `npm test` → 356/356 passing. `rm -rf .next && npm run build` →
  clean. Hit `curl localhost:3000/api/settlement` directly (full browser login via
  Google OAuth isn't automatable headlessly) and confirmed the new Cup Winner/Continent
  payouts flow into the computed transactions/positions that `SettlementCard`/
  `SettlementPlan` on the Home tab render.
- **Left undone / follow-ups:** Total Goals still needs manual settlement once a
  trustworthy final goal count is available.

## 2026-07-20 (final) — Settled Total Goals per user-confirmed final tally
- **Task:** User confirmed the tournament's final goal tally as 308 (and re-confirmed
  Cup Winner = Spain, already settled) and asked to settle the remaining special bet.
- **Changes:** Ran `settle_special('TOTAL_GOALS','total_goals','over')` (308 > 299.5) —
  4 settled, ₹1400 pool, ₹1100 winning pool. Updated `docs/ai/STATE.md`.
- **Decisions:** Checked `pick` distribution on pending `TOTAL_GOALS` bets first (both
  'over' and 'under' present) before calling `settle_special`, per failure mode #7.
- **Verification:** Confirmed settled count/pool matched the pending pool exactly
  (7 pending bets total → 4 over + 3 under, 4 settled as winners).
- **Left undone / follow-ups:** None — all special bets are now settled. Real-money
  settlement via the `settlements` table remains a human decision.

## 2026-07-20 (final+1) — Settled KO Cup Winner Last 8 (Spain)
- **Task:** User asked to settle the separate "Cup Winner Last 8" (`KO_CUP_WINNER`,
  kind `ko_cup_winner`) special bet, winner Spain.
- **Changes:** Checked pending picks first — pool only had ARG/ENG/FRA/NOR, no ESP.
  Confirmed with the user this would refund everyone (per `settle_special`'s
  no-winner-matched behavior, migration 016), then ran
  `settle_special('KO_CUP_WINNER','ko_cup_winner','ESP')` → refunded all 8 pending
  bets (`reason: "no bets on winner"`). Updated `docs/ai/STATE.md`.
- **Decisions:** This is NOT a bug — nobody in this specific knockout-stage pool
  predicted Spain, so the parimutuel-correct outcome is refund, not "everyone loses
  and money vanishes" (there's no house).
- **Verification:** Row count matched the pending pool exactly (8 in, 8 refunded).
- **Left undone / follow-ups:** None — every special bet in the app is now settled.

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

---

## 2026-07-16 (b) — Fix swapped Final/3rd-place kickoff dates

- **Task:** User's reference screenshot: 3rd place (FRA v ENG) is Sun 19 Jul, Final
  (ESP v ARG) is Mon 20 Jul (IST). App showed them reversed.
- **Root cause:** `match_schedule` had FIN-1 = 2026-07-18 21:00 UTC (→ 19 Jul 2:30am
  IST) and 3RD-1 = 2026-07-19 19:00 UTC (→ 20 Jul 12:30am IST) — the two kickoff_ts
  values were swapped between the static IDs.
- **Fix:** Ran a prod UPDATE swapping them → FIN-1 = 2026-07-19 19:00 UTC (Mon 20 Jul
  IST), 3RD-1 = 2026-07-18 21:00 UTC (Sun 19 Jul IST). Also updated hardcoded bracket
  round-header labels: BracketScreen "Final · Jul 18"→"Jul 20"; DesktopApp
  "Final · Jul 19"→"Jul 20". (3rd-place header already read "Jul 19".)
- **Gotchas:** Per-match nodes render kickoff via formatIST(kickoffTs) from the DB;
  the static STAGE_INFO headers are separate hardcoded strings that must be kept in
  sync manually. Betting-close cutoff and countdowns key off these kickoffs, so the
  swap also fixes when Final/3rd betting closes. DB is prod (local dev → prod DB).
- **Verification:** `/api/init` schedule now returns FIN-1 → Mon 20 Jul 12:30am IST,
  3RD-1 → Sun 19 Jul 2:30am IST (matches screenshot). `npm run build` clean.
- **Left undone:** commit + push (this session).

## 2026-07-20 — Attempt final tournament settlement + Home settlement display

- **Task:** User asked to pull latest main (discard local changes), settle all
  pending special bets and any pending bets now that the World Cup has ended,
  surface the final resolved amounts on the Home page, run tests, review, and
  push a final commit to main.
- **Environment blockers hit immediately (see CLAUDE.md failure mode #24):**
  - The mounted repo folder rejected `rm`/`git reset --hard`/`git pull` with
    `Operation not permitted` on `.git/index.lock`, `.git/objects/maintenance.lock`,
    and several tracked files — this was Cowork's file-delete safety gate, not
    a real OS/lock issue. Resolved via `allow_cowork_file_delete`, then
    `git fetch && git reset --hard origin/main && git clean -fd` succeeded
    cleanly (repo now at `f6acd59`, working tree matches origin/main exactly).
  - `git push` has no credentials in this sandbox (`could not read Username
    for 'https://github.com'`) — confirmed via `--dry-run`. No `gh` CLI, no
    token in env.
  - All outbound requests to `*.supabase.co` (and `api.github.com`,
    `raw.githubusercontent.com`, `codeload.github.com`) return `403
    blocked-by-allowlist` from the sandbox's egress proxy — confirmed via
    `curl -sI` and DNS lookups (`getaddrinfo EAI_AGAIN`, `network unreachable`).
    No Supabase MCP connector was available either (checked the registry).
  - **Net effect: I could not read the `bets` table, could not run any
    settlement RPC, and could not push.** Everything below is prepared but
    unexecuted against the real DB/remote.
- **Research done (WebSearch, all sourced):** FIFA World Cup 2026 Final —
  Spain 1-0 Argentina (AET, Ferran Torres 106'). 3rd place — England 6-4
  France. Golden Boot — Mbappé, 10 goals (Messi 2nd, 8 — so Messi beats
  Ronaldo's 3 for the h2h special). Semifinalists — Spain, Argentina, France,
  England. Total tournament goals: could NOT get a single authoritative final
  figure (saw conflicting mid-tournament snapshots: "175/177 goals", "294
  goals through 101 matches") — deliberately left `total_goals` unsettled
  rather than guess on a real-money over/under.
- **Code inspected to build the settlement script:**
  `lib/specials.js` (SPECIALS registry — discovered `golden_boot` has no
  entry at all), `components/GoldenBootBetModal.jsx` (imports `getSpecial
  ('golden_boot')` which would be `null` — confirmed via grep it's never
  rendered anywhere, so this bet type is unreachable dead code, same class
  of bug as `AdeYaarApp.jsx`), migrations `016_indexes_and_settle_specials.sql`
  (`settle_special` — generic RPC that already covers continent/h2h/
  golden_boot; CLAUDE.md failure mode #7 was wrong claiming otherwise, fixed
  it), `022_revoke_settle_rpcs_and_fix_cancel_timing.sql` (confirms
  service_role-only grants), `032_props_duels_final_four.sql`
  (`settle_final_four(text[])` signature).
- **Deliverable:** `scripts/settle-tournament-2026.sql` — every settlement
  RPC call needed, with the exact real-world winner values filled in for cup
  winner / continent / h2h / final four, explicit sanity-check SELECTs before
  each destructive call, and loud warnings on golden_boot (unknown `pick`
  format, likely zero rows) and total_goals (unresolved figure — don't guess).
- **Home page change (this part I *could* do — pure file edits, no network
  needed):** `components/screens/HomeScreen.jsx` now renders the existing
  `SettlementCard` (from `BetsScreen.jsx`) and `SettlementPlan` (from
  `LeaderboardScreen.jsx`) at the top of Home, gated by
  `isTournamentSettled()` (checks `getSpecial('cup_winner').resolvesTs` vs
  now — same pattern `SpecialsScreen.jsx` already uses to move cards to
  "Settled"). Deliberately did NOT reimplement any settlement math — both
  components already read `settlementByUser`/`/api/settlement`, which is the
  one normalized-to-zero-sum source of truth (failure mode #14). Verified no
  new circular-import issue (BetsScreen/LeaderboardScreen already import from
  each other; HomeScreen isn't imported by either).
- **Verification:** `npm test` → 356/356 passed. `rm -rf .next && npm run
  build` → clean, all 60 routes generated, `/home` bundle grew from prior
  size to 10.2 kB (expected — two new components pulled in). Could not do a
  live manual check against prod (no network), and could not verify the
  settlement script against real DB rows for the same reason.
- **Left undone / follow-ups (all require someone with real DB + GitHub
  access):**
  1. Run `scripts/settle-tournament-2026.sql` against prod, resolving
     `total_goals` and `golden_boot` first (per the warnings in that file).
  2. Verify match-level bets (group/R32/R16/QF/SF/3rd/Final) actually got
     auto-settled by `/api/auto-resolve` throughout the tournament — spot
     check per the query in the script; if `SUPABASE_SERVICE_ROLE_KEY` was
     ever missing on Vercel (known risk, failure mode #10) some may be stuck
     pending.
  3. Check `challenges` for any still-`accepted` duels on FIN-1/3RD-1/SF that
     need `settle_challenges`.
  4. `git push origin main` this commit.
  5. Decide whether to fix or delete the dead `golden_boot` UI (failure mode
     #23) — separate from settlement, no urgency.

---

## 2026-07-20 — AdeYaar '26 Wrapped (Spotify-Wrapped-style stat story)

- **Task:** Build a Spotify-Wrapped-style stat story (≥10 slides) for the app and
  surface it on the Home page.
- **Files touched:**
  - `components/WrappedStory.jsx` (NEW) — self-contained full-screen story overlay.
    Computes all stats client-side via `computeWrapped()` from `bets` +
    `allChallenges` + `settlementByUser` + `allUsers`. 14 slides (some conditional
    on data presence, deck always ≥12): intro, total bets, total staked, biggest
    bet, hit rate, biggest win, roughest loss, favourite team, duel W–L, specials
    count, finishing rank, net result headline, betting personality, outro.
    Story mechanics: auto-advance (6s/slide, holds on last), tap-right=next /
    tap-left=prev, hold-to-pause (250ms pointer hold), keyboard (←/→/space/esc),
    animated progress bars, per-slide gradient bg, entrance animation.
  - `components/screens/HomeScreen.jsx` — added `WrappedStory` import, new props
    `allChallenges` + `settlementByUser`, a `wrappedOpen` useState (placed BEFORE
    the `showAllActivity` early return — Rules of Hooks, failure mode #15), a
    gradient banner trigger shown when `tournamentSettled`, and the mounted overlay.
  - `app/(tabs)/home/page.jsx` — pulled `allChallenges` + `settlementByUser` from
    `useBetting()` and passed them to HomeScreen.
- **Decisions / gotchas:**
  - Stats reuse existing context data — no new API routes, RPCs, or DB work.
    `net` uses `settlementByUser[userId]` (the settlement-normalized number, per
    failure mode #14) so it matches what the Settlement Plan actually pays.
  - Excludes `_topup` rows and cancelled bets from all tallies (failure mode #8).
  - Duel record reads `allChallenges` (full history), NOT the narrowed `challenges`
    (open+accepted only) — see lib/CLAUDE.md challenge-fields invariant.
  - Match/team labels resolved via `getMatch`/`getTeam` — never raw ids shown.
  - Gated behind `isTournamentSettled()` (cup_winner resolvesTs passed), same gate
    HomeScreen already uses for the final-settlement section.
- **Verification:** `rm -rf .next && npm run build` → clean. Could not log into the
  live authenticated app (Google OAuth unavailable in this browser), so verified
  the component via a TEMPORARY `app/wrapped-preview/page.jsx` harness with mock
  data driven through the in-app browser: stepped through all 14 slides, confirmed
  progress bars, tap-nav, flag/label resolution ("🇰🇷 South Korea vs 🇨🇿 Czech
  Republic"), personality logic (net ₹4,200 → "The Shark"), personalized name, and
  Done-button close. Harness route deleted afterwards.
- **Follow-ups:** none required. `git push` pending (user pushes when ready).
