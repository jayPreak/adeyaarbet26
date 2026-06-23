-- 023: Fix place_bet vulnerability where SELECT INTO only captures one row
-- when multiple pending bets exist for the same user/match.
--
-- Bug: The old SELECT pick INTO v_existing_pick fetched at most one pending bet.
-- If a user somehow ended up with two pending bets on different sides (e.g. B4
-- bug: draw ₹250 + away ₹100 both pending), the same-side check only inspected
-- the first row returned. The second pending bet would survive the cancel step
-- and inflate the pool.
--
-- Fix: Replace SELECT INTO + IF branches with:
--   1. EXISTS check for same-pick → reject immediately
--   2. Unconditional UPDATE to cancel ALL pending bets before placing new one
--
-- Part B: Repair B4 data — reset bets, cancel erroneous draw bet, re-settle.
-- Part C: Delete 9 stale cancelled rows for pending matches.

-- ──────────────────────────────────────────────────────────────────────────────
-- PART A: Fixed place_bet RPC
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid, p_match_id text, p_pick text, p_amount integer
) RETURNS json AS $$
DECLARE
  v_cancel_count integer;
  v_bet_id       bigint;
  v_kickoff      timestamptz;
BEGIN
  -- Basic validation
  IF p_pick NOT IN ('home', 'away', 'draw') THEN RAISE EXCEPTION 'Invalid pick'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount < public.bet_min(p_match_id) THEN
    RAISE EXCEPTION 'Bet below minimum (%) for this stage', public.bet_min(p_match_id);
  END IF;
  IF p_amount > public.bet_max() THEN
    RAISE EXCEPTION 'Bet exceeds maximum (%)', public.bet_max();
  END IF;

  -- Kickoff / match existence check
  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN
    RAISE EXCEPTION 'Unknown match';
  END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  -- Lock profile row to serialize concurrent bets
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Reject if match is already resolved
  IF EXISTS (
    SELECT 1 FROM public.bets
    WHERE match_id = p_match_id AND status IN ('won', 'lost') LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Match already resolved';
  END IF;

  -- Reject if user already has a pending bet on this exact pick
  -- (use EXISTS to correctly handle multiple pending rows)
  IF EXISTS (
    SELECT 1 FROM public.bets
    WHERE user_id = p_user_id
      AND match_id = p_match_id
      AND kind = 'match'
      AND status = 'pending'
      AND pick = p_pick
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Already bet on this side';
  END IF;

  -- Cancel ALL pending bets for this user/match (handles both normal side-switch
  -- and the prior multi-pending bug state where multiple picks were active)
  UPDATE public.bets
    SET status = 'cancelled'
    WHERE user_id = p_user_id
      AND match_id = p_match_id
      AND kind = 'match'
      AND status = 'pending';

  GET DIAGNOSTICS v_cancel_count = ROW_COUNT;

  IF v_cancel_count > 0 THEN
    INSERT INTO public.activity (user_id, type, payload)
      VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
        'match_id', p_match_id,
        'reason', 'side_switch',
        'new_pick', p_pick,
        'count', v_cancel_count
      ));
  END IF;

  -- Place the new bet
  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, 'match')
    RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'pick', p_pick, 'amount', p_amount, 'bet_id', v_bet_id));

  RETURN json_build_object('id', v_bet_id, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────────────────
-- PART B: B4 data repair
--
-- B4 (Group B match 4) had an erroneous duplicate pending bet:
--   id=247  jayesh  draw  ₹250  (should never have been active alongside id=423)
--   id=423  jayesh  away  ₹100  (the valid final bet)
--
-- The pool was inflated by ₹250, causing all home-winner payouts to be ~20% too high:
--   rahul  id=301  payout was 96  → should be 80
--   rohan  id=308  payout was 483 → should be 400
--   vaper  id=315  payout was 193 → should be 160
--   boidu  id=412  payout was 193 → should be 160
--   ashin  id=450  payout was 483 → should be 400
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1: Reset all B4 match bets from won/lost back to pending for re-settlement
UPDATE public.bets
  SET status = 'pending', payout = NULL, resolved_at = NULL
  WHERE match_id = 'B4' AND kind = 'match' AND status IN ('won', 'lost');

-- Step 2: Cancel the erroneous double-counted draw bet
UPDATE public.bets SET status = 'cancelled' WHERE id = 247;

-- Step 3: Re-settle B4 with corrected pool (home won)
SELECT public.resolve_match('B4', 'home');

-- ──────────────────────────────────────────────────────────────────────────────
-- PART C: Delete stale cancelled rows for pending matches
--
-- These are old cancelled bets on matches that are still upcoming/pending.
-- They clutter the bets table and activity feed without contributing to any pool.
-- ──────────────────────────────────────────────────────────────────────────────

DELETE FROM public.bets WHERE id IN (604, 574, 569, 562, 542, 539, 535, 443, 261, 446);
