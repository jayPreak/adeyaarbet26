# lib — Domain Logic Reference (AI)

Read root `CLAUDE.md` first. Before committing changes here, follow its
Documentation Protocol (CHANGELOG.md + docs/ai/SESSION_LOG.md + this file if stale).
Money-math changes MUST keep `npm test` green — tests in `__tests__/` cover this dir.

## Key modules
- `BettingContext.jsx` — ★ central app state provider (`useBetting()`); mounted by
  `app/(tabs)/layout.jsx`. This is where new global state/modal flags go.
- `LeaderboardContext.jsx` — rankings state.
- `data.js` — static MATCHES / TEAM / FRIENDS; `getMatch()`, `getTeam()`,
  `getMatchKickoffTs()` (ISO → epoch ms — ALWAYS use this, never compare raw
  kickoffTs), `isMatchBettingOpen()`, `MATCH_BET_CUTOFF_MS` (30s).
- `ledger.js` — `computeBalance()`, `computeRealisedBalance()`, `resolveMatchBets()`.
  Balance is computed, never stored.
- `specials.js` — SPECIALS registry + `getSpecial(id)` + `formatPick()`.
- `props.js` — pure settlement helpers for scoreline / over_under / pens
  (scoreline uses score after extra time, excluding shootouts; pens knockout-only).
- `achievements.js` — leaderboard Titles, computed client-side from rankings payload.
- `odds.js`, `settlement.js`, `third-place-qualifiers.js`, `cup-winner.js`,
  `countdown.js`, `currency.js` (₹, `fmtMoney`, MAX_BET) — domain helpers.
- `schedule-sync.js` — FIFA→static-ID mapping, `TEAM_CODE_ALIAS` (KSA→SAU etc.).
- Supabase clients: `supabase.js` (server anon), `supabase-admin.js` (service role),
  `supabase-browser.js` (client), `supabase-server.js` (server + auth cookies).

## Invariants (money bugs if broken)
- Match IDs are static strings (`A1`…`L6`, knockout IDs) — never FIFA numeric IDs.
- Balance is derived from the `bets` rows; there is no wallet column.
- Pure functions here must stay pure — settlement helpers are unit-tested and reused
  by `auto-resolve`.
- Exclude `match_id = '_topup'` rows from any user-facing bet aggregation.
- `BettingContext` exposes TWO challenge fields: `challenges` (narrowed to
  `status IN ('open','accepted')`, current user's participation) for the
  active-duels UI, and `allChallenges` (full history including settled/void/
  expired/declined/cancelled) for anywhere that needs to label historical duel
  bets (e.g. `NetWorthGraph` tooltip). Do NOT collapse them — the active-duels
  UI treats resolved rows as "not mine anymore" and would show settled duels
  as still-open if fed the full list.
- Cancel-bet UX (`cancelBet` in `BettingContext.jsx`) must enumerate what's
  affected client-side and show explicit copy about duels being preserved.
  Migration 037 protects duels server-side; the UI mirrors that intent.
