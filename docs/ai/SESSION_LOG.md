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

## 2026-07-09 — Import engineering best-practices into CLAUDE.md
- **Task:** Fold the maintainer's engineering standards into the project `CLAUDE.md`.
- **Changes:** new "Engineering Principles" section — behavioural-tests-first, pure domain
  helpers, separation of concerns, no silent error swallowing, and a code-review-triggers
  checklist. Adapted the maintainer's global rules to this repo's JS/Next/Supabase stack
  (dropped the Python/uv/pytest specifics) and used real repo examples (ledger.js purity,
  the duplicate bet modals, the 46-field BettingContext).
- **Decisions:** did NOT import the "context.md telephone book" convention — this repo already
  has an equivalent doc system (CLAUDE.md + docs/ai/{SESSION_LOG,STATE}); adding a foreign
  convention would duplicate it.
- **Verification:** doc-only; `npm test` still 356 pass.
- **Left undone / follow-ups:** NEXT — audit `__tests__/` to confirm every test is behavioural
  (per the new rule the maintainer emphasised).

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
