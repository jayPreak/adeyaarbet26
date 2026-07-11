# Current System State

**Audience: AI agents.** Snapshot of what is TRUE about the running system right now.
Update this whenever your change alters what's live, fixes/introduces a known issue,
or creates a pending manual step. Keep it current — this is state, not history
(history goes in SESSION_LOG.md).

_Last updated: 2026-07-11_

## Tournament phase
- FIFA World Cup 2026, mid-tournament (knockout stage era: R32/QF features shipped,
  migrations through 040). QF-1 & QF-2 settled; QF-3, QF-4, SF, FIN pending.
- Real money among ~10 friends; settlement happens at tournament end.

## What's live
- Match bets, cup winner, continent, H2H, golden boot, goalscorer, third-place
  qualifiers, R32 picks, match props (scoreline / over-under / pens), friend duels
  (challenges), Final Four, Total Goals (rescaled to 96-match window), leaderboard
  titles (client-side achievements), news tab, live commentary links.
- **Live match stream panel on Home** (2026-07-10): collapsible embedded video
  player above the hero card for live matches, with source-switch buttons.
  Sources hardcoded in `lib/streams.js` (streamed.pk snapshot). QF-1…QF-3
  populated; QF-4/SF/FIN pending stream availability. Display-only.
- **Live match chat panel** (2026-07-10): WebSocket to `wss://chat.cdn-lab.shop`
  behind a "Connect to chat" button in the stream card. Autoscroll via
  IntersectionObserver sentinel, exponential-backoff reconnect (6 attempts),
  desktop-only theater view modal with stream + chat side-by-side. Local
  ErrorBoundary fails closed so chat crashes never break Home.
- **P&L graph duel tooltip** (2026-07-11): tapping a duel node on
  `NetWorthGraph` (account overview + leaderboard profile modal) shows
  `Duel vs <opponent> · <stage> <home v away> · <pick>`. Data joined
  from `challenges` (widened fetch in `lib/initDirect.js`) + `allUsers`.

## Recently fixed (this session, 2026-07-11)
- **cancel_bets nuked accepted duels** (root cause of 10 corrupted rows across
  R16-5, R16-7, QF-2, QF-3). Migration 037 adds `kind <> 'challenge'` filter.
- **10-row backfill** applied (migration 038). Vaper's two QF-2 wins vs Jayesh
  and Ashin are now `won +200`, other users' losses correctly `lost`, my QF-3
  accepted duel bet 1146 restored to `pending`.
- **settle_challenges is strict now** (migration 039): RAISEs on any bet-vs-
  challenge inconsistency instead of silently no-op'ing.
- **Trigger on challenges** (migration 040): terminal-state transitions
  (settled/void/expired) MUST match the underlying bet states or the
  transaction rolls back.
- **UI cancel flow** now enumerates match vs duel counts and shows explicit
  confirmation copy before firing the cancel API.

## Known issues / risks
- **⚠️ Committed secrets in git history (open-source blocker):** the Postgres DB
  password, project ref, and anon JWT were committed in docs. They're redacted from
  the working tree (2026-07-09) but remain in history. Rotate the DB password in
  Supabase and scrub history (BFG / git-filter-repo) before making the repo public.
- **`SUPABASE_SERVICE_ROLE_KEY` has been missing from Vercel env vars** — breaks
  service_role-only RPCs in prod (duels settlement, `settle_special`). Verify it is
  set before relying on auto-resolve settling props/duels.
- **RLS is disabled on `news_cache` and `spatial_ref_sys`** — exposed to the anon key.
- `continent`, `h2h`, `golden_boot` still have no auto-settlement (manual SQL or
  `settle_special` at tournament end).
- No server-side auth on API routes (accepted risk for friend group).
- `components/AdeYaarApp.jsx` is dead code and still in the tree — deleting it is a
  candidate cleanup, but verify nothing imports it first.

## Pending manual steps (before/during tournament)
- Extend `lib/streams.js` `MATCH_STREAMS` with mirrors for SF-1, SF-2, FIN-1,
  3RD-1, and QF-4 once streamed.pk populates them. Refresh recipe is in the
  file header.

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
