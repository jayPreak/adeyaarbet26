# Current System State

**Audience: AI agents.** Snapshot of what is TRUE about the running system right now.
Update this whenever your change alters what's live, fixes/introduces a known issue,
or creates a pending manual step. Keep it current — this is state, not history
(history goes in SESSION_LOG.md).

_Last updated: 2026-07-05_

## Tournament phase
- FIFA World Cup 2026, mid-tournament (knockout stage era: R32/QF features shipped,
  migrations through 033 which pins `qf_deadline()`).
- Real money among ~10 friends; settlement happens at tournament end.

## What's live
- Match bets, cup winner, continent, H2H, golden boot, goalscorer, third-place
  qualifiers, R32 picks, match props (scoreline / over-under / pens), friend duels
  (challenges), Final Four, Total Goals (rescaled to 96-match window), leaderboard
  titles (client-side achievements), news tab, live commentary links.

## Known issues / risks
- **`SUPABASE_SERVICE_ROLE_KEY` has been missing from Vercel env vars** — breaks
  service_role-only RPCs in prod (duels settlement, `settle_special`). Verify it is
  set before relying on auto-resolve settling props/duels.
- **RLS is disabled on `news_cache` and `spatial_ref_sys`** — exposed to the anon key.
- `continent`, `h2h`, `golden_boot` still have no auto-settlement (manual SQL or
  `settle_special` at tournament end).
- No server-side auth on API routes (accepted risk for friend group).
- (Resolved 2026-07-09) `components/AdeYaarApp.jsx` and `components/GoldenBootBetModal.jsx`
  dead code removed; the 8 MB `public/stadium-crowd.mp4` splash video removed too.

## Pending manual steps (end of tournament)
- Settle: cup winner (`settle_cup_winner`), continent/h2h/golden boot
  (`settle_special` or SQL), total goals
  (`settle_special('TOTAL_GOALS','total_goals','over'|'under')`),
  final four (`settle_final_four`), then real-money settlement via settlements table.

## Testing
- `npm test` — Jest unit tests (financial math). Must pass before push.
- `npm run test:e2e` — Playwright e2e exists.
- Live-app manual testing: use the throwaway **jaytest** account, never real accounts.
- Local dev hits the PROD database — no destructive experiments.
