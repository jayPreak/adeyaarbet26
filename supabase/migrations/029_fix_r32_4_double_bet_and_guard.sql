-- 029: Fix R32-4 double-bet for rohan + add DB-level guard against future occurrences.
--
-- What happened:
--   rohan placed away ₹50 (id=900) at 06:33 UTC Jun 29.
--   At 21:37 UTC, place_bet (023) logged a side-switch cancel (count=1) and
--   placed home ₹100 (id=931). Despite the cancel, id=900 ended up settled
--   as 'won' — likely a race / READ COMMITTED concurrency window between the
--   cancel UPDATE and the INSERT in place_bet. Both bets were in the pool when
--   resolve_match ran at 06:18 UTC Jun 30, inflating the pool by ₹50.
--
-- Correct state: keep id=931 (home ₹100, the latest bet), cancel id=900.
-- Pool without id=900 = ₹700.  Away winners each get FLOOR(100/300*700) = 233.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Data repair for R32-4
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Cancel the erroneous early away bet for rohan
UPDATE public.bets
  SET status = 'cancelled', payout = NULL, resolved_at = NULL
  WHERE id = 900;

-- Step 2: Reset all R32-4 match bets from won/lost back to pending for re-settlement
UPDATE public.bets
  SET status = 'pending', payout = NULL, resolved_at = NULL
  WHERE match_id = 'R32-4'
    AND kind = 'match'
    AND status IN ('won', 'lost');

-- Step 3: Re-settle R32-4 (Morocco = away won on penalties)
SELECT public.resolve_match('R32-4', 'away');

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: DB-level guard — one pending match bet per user per match
--
-- If place_bet's cancel step somehow fails to cancel an existing pending bet
-- before inserting the new one (concurrency, rollback, future bug), the INSERT
-- will fail with a unique-violation rather than silently leaving two pending
-- bets to both get settled.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS bets_one_pending_match_per_user
  ON public.bets (user_id, match_id)
  WHERE kind = 'match' AND status = 'pending';
