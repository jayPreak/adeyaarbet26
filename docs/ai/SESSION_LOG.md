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

## 2026-07-09 — Lazy-mount special modals
- **Task:** Reduce per-render work in the app shell (speed goal).
- **Changes:** `app/(tabs)/layout.jsx` — the 4 special modals (CupWinner, Continent, H2H,
  ThirdPlaceQualifier) were statically imported and rendered unconditionally (they returned
  null when closed but still ran their hooks/effects every shell render). Converted to
  `next/dynamic` + gated render on the open flag, so they mount only when opened.
- **Decisions / honesty:** measured per-route "First Load JS" is basically unchanged — those
  modals weren't the bundle's weight — so this is a *runtime* win (fewer mounted components /
  effects per render), not a bundle win. Did NOT attempt the bigger lever: splitting the
  46-field `BettingContext` value (which re-renders the whole tree on any change) — that's a
  risky refactor touching every consumer, better done deliberately with review, not in an
  automated pass on a real-money app.
- **Verification:** `npm test` 356 pass; `next build` compiles.
- **Left undone / follow-ups:** BettingContext value split; code-split the 1400-line
  `components/index.jsx`; host FIFA flag images locally instead of the FIFA CDN.

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
