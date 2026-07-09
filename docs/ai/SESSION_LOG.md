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

## 2026-07-09 — Remove dead code + 8 MB splash video
- **Task:** Delete dead code / heavy assets flagged in the audit, ahead of open-sourcing.
- **Changes:** deleted `components/AdeYaarApp.jsx` (verified: nothing imports it),
  `components/GoldenBootBetModal.jsx` (nothing imports it; `getSpecial('golden_boot')`
  returns null so it would crash if mounted), `public/stadium-crowd.mp4` (8 MB).
  `CountdownSplash.jsx` — replaced the `<video>` base layer with a static gradient.
  Updated `CLAUDE.md`, `components/CLAUDE.md`, `docs/ai/STATE.md` to drop the dead-code notes.
- **Decisions:** deliberately did NOT touch `lib/migrate.js` / `lib/db.js` / `/api/setup`
  — `migrate.js` is stale (embeds only 4 of 35 migrations) but is still imported by the
  setup route, so removing it is a larger, separate change. Also did NOT rename the
  duplicate `030_*.sql` migration files: both are already applied to prod and Supabase
  tracks migrations by version prefix, so renaming would look like a new unapplied migration.
- **Verification:** `npm test` 356 pass; `next build` succeeds; grep confirms no code refs
  to the deleted files.
- **Left undone / follow-ups:** stale `lib/migrate.js` + `lib/db.js` + `/api/setup` chain
  (candidate for a follow-up PR); broader stale-doc fixes in root CLAUDE.md (old load
  sequence, "no auth") could be a docs PR.

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
