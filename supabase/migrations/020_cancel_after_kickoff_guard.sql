-- 020: Prevent bet cancellation after match kickoff.
--
-- Bug: users could cancel bets on live/finished matches before auto-resolve
-- ran, effectively getting a free look at the result and refunding losing bets.
-- Fix: check kickoff_ts in cancel_bets and reject if betting window has closed.

CREATE OR REPLACE FUNCTION public.cancel_bets(p_user_id uuid, p_match_id text)
RETURNS json AS $$
DECLARE
  v_kickoff_ts timestamptz;
  v_cancelled  integer;
  v_refunded   integer;
BEGIN
  -- Check if match betting window has closed (same 30s rule as place_bet)
  SELECT kickoff_ts INTO v_kickoff_ts
    FROM public.match_schedule
    WHERE id = p_match_id;

  IF v_kickoff_ts IS NOT NULL AND now() >= v_kickoff_ts - interval '30 seconds' THEN
    RAISE EXCEPTION 'Cannot cancel — match has already started';
  END IF;

  -- Lock profile row to serialize with place_bet (prevents race)
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  WITH cancelled AS (
    UPDATE public.bets
      SET status = 'cancelled'
      WHERE user_id = p_user_id
        AND match_id = p_match_id
        AND status = 'pending'
      RETURNING amount
  )
  SELECT COUNT(*)::integer, COALESCE(SUM(amount), 0)::integer
    INTO v_cancelled, v_refunded
    FROM cancelled;

  IF v_cancelled = 0 THEN
    RAISE EXCEPTION 'No pending bets to cancel';
  END IF;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', p_match_id, 'refunded', v_refunded, 'count', v_cancelled
    ));

  RETURN json_build_object(
    'cancelled', v_cancelled,
    'refunded', v_refunded,
    'balance', public.compute_balance(p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
