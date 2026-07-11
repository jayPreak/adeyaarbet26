-- 038: Backfill duel bets that were silently cancelled by the cancel_bets bug (fixed in 037).
--
-- Before 037, `cancel_bets(user_id, match_id)` mass-cancelled ALL pending bets on a match
-- regardless of `kind`, including active duels. When the corresponding challenges later
-- settled via `settle_challenges`, the RPC's `UPDATE bets ... WHERE status='pending'`
-- silently no-op'd on those already-cancelled bets, but still flipped the challenge to
-- 'settled'. Result: challenges and bets disagree.
--
-- Root cause proven via direct DB queries:
--   Every corrupted bet has resolved_at IS NULL and matches a bet_cancelled activity
--   event by the same user on the same match with (count, refunded) fingerprint of
--   cancel_bets. See conversation for full trace.
--
-- This migration restores the 10 corrupted bet rows to the state they should have
-- had if cancel_bets had properly excluded challenge kind. Idempotent via
-- `AND status='cancelled'` guards.
--
-- Financial reconciliation: each user's P&L graph, net win/loss, and real-money
-- settlement will now match the duels tab.

-- ── QF-2 settled duels (all resolved 2026-07-10 21:03:58) ──

-- Vaper vs Ashin (challenge 789fea4f, Vaper won)
UPDATE public.bets SET status='won',  payout=200, resolved_at='2026-07-10 21:03:58.50164+00'
  WHERE id=1166 AND status='cancelled';
UPDATE public.bets SET status='lost', resolved_at='2026-07-10 21:03:58.50164+00'
  WHERE id=1177 AND status='cancelled';

-- Vaper vs Jayesh (challenge c8162ebd, Vaper won)
UPDATE public.bets SET status='won',  payout=200, resolved_at='2026-07-10 21:03:58.50164+00'
  WHERE id=1167 AND status='cancelled';

-- Ashin vs Boidu (challenge 8e814c47, Boidu won → Ashin lost)
UPDATE public.bets SET status='lost', resolved_at='2026-07-10 21:03:58.50164+00'
  WHERE id=1179 AND status='cancelled';

-- Pratyush vs Ashin (challenge 32ce4132, Pratyush won → Ashin lost)
UPDATE public.bets SET status='lost', resolved_at='2026-07-10 21:03:58.50164+00'
  WHERE id=1217 AND status='cancelled';

-- ── R16-7 settled duel (resolved 2026-07-07 18:08:47) ──

-- Ashin vs Vaper (challenge ad7de8f2, Vaper won → Ashin lost)
UPDATE public.bets SET status='lost', resolved_at='2026-07-07 18:08:47.110661+00'
  WHERE id=1135 AND status='cancelled';

-- ── R16-5 settled duels (resolved 2026-07-06 21:09:34) ──

-- Pratyush vs Vaper (challenge 79e9285e, Vaper won → Pratyush lost)
UPDATE public.bets SET status='lost', resolved_at='2026-07-06 21:09:34.064336+00'
  WHERE id=1035 AND status='cancelled';

-- Manan vs Pratyush (challenge 189445d1, Pratyush won)
UPDATE public.bets SET status='won', payout=200, resolved_at='2026-07-06 21:09:34.064336+00'
  WHERE id=1088 AND status='cancelled';

-- Boidu vs Pratyush (challenge d713a9b7, Boidu won → Pratyush lost)
UPDATE public.bets SET status='lost', resolved_at='2026-07-06 21:09:34.064336+00'
  WHERE id=1089 AND status='cancelled';

-- ── QF-3 accepted duel (match not yet finished) ──
-- Manan vs Ashin (challenge 45273764, status='accepted') — restore Ashin's opponent
-- bet to 'pending' so settle_challenges can settle it correctly when QF-3 finishes.
UPDATE public.bets SET status='pending', resolved_at=NULL
  WHERE id=1146 AND status='cancelled' AND kind='challenge';
