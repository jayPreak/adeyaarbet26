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

## 2026-07-09 — UX/a11y safeguards
- **Task:** Improve accessibility + prevent accidental real-money cancels.
- **Changes:**
  - `app/globals.css` — global `:focus-visible` ring (gold outline) for a/button/input/select/
    textarea/[role=button]/[tabindex]. The app previously had ~1 `:focus` rule total.
  - Added `if (!confirm('Cancel this bet? Your stake will be refunded.')) return;` to every
    special-bet cancel handler: FinalFour, H2H, GoalScorer, ThirdPlaceQualifier, TotalGoals
    modals; R32BetPage; and the ko-cup-winner / final-four / total-goals pages.
- **Decisions:** the main match-bet `cancelBet` in `BettingContext` already confirms, so left
  it. Did NOT touch `GoldenBootBetModal.jsx` (deleted in the dead-code PR) or CupWinner/Continent
  (no `handleCancel` — they cancel via a different path). Used the native `confirm()` to match
  the existing match-cancel pattern rather than introduce a modal component.
- **Gotchas / learnings:** the 5 special modals + 3 special pages each carry a near-identical
  cancel handler — a shared `useSpecialBet` hook would remove this copy-paste (see audit).
- **Verification:** `npm test` 356 pass; `next build` succeeds.
- **Left undone / follow-ups:** win/loss cards still signal by color only (add a ✓/✗ glyph);
  empty states are thin on some screens.

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
