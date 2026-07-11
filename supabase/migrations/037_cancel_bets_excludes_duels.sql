-- 037: cancel_bets must NOT touch challenge (duel) bets.
--
-- Bug: `cancel_bets(user_id, match_id)` (migration 020) cancels every pending
-- bet the user has on the match — including live duels. Duels are contract
-- bets with a locked-in opponent; users can't cancel them from the UI
-- (there's no button, and `cancel_special_bet_by_id` explicitly rejects
-- `kind='challenge'`). But `cancel_bets` bypasses that rule.
--
-- Real-world impact: Vaper (2026-07-07) and Ashin (2026-07-08) each tapped
-- "Cancel bet" on QF-2, intending to cancel one match bet. `cancel_bets`
-- silently nuked their two/three active duel bets too. Then when the
-- challenges settled, `settle_challenges` tried to flip status='pending'
-- to 'won'/'lost' — no-op'd because the bets were already 'cancelled' —
-- but still flipped the challenge to 'settled'. Result: 8 challenge rows
-- across R16-5, R16-7, QF-2 have `settled` challenges with `cancelled`
-- bets, and the users' P&L graphs miss the wins/losses.
--
-- Fix: add `AND kind <> 'challenge'` to the UPDATE. Duel cancellation
-- must go through `cancel_challenge` (open duels only) or expire via
-- `settle_challenges` when the match ends.

CREATE OR REPLACE FUNCTION public.cancel_bets(p_user_id uuid, p_match_id text)
RETURNS json AS $$
DECLARE
  v_kickoff_ts timestamptz;
  v_cancelled  integer;
  v_refunded   integer;
BEGIN
  SELECT kickoff_ts INTO v_kickoff_ts
    FROM public.match_schedule
    WHERE id = p_match_id;

  IF v_kickoff_ts IS NOT NULL AND now() >= v_kickoff_ts - interval '30 seconds' THEN
    RAISE EXCEPTION 'Cannot cancel — match has already started';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  WITH cancelled AS (
    UPDATE public.bets
      SET status = 'cancelled'
      WHERE user_id = p_user_id
        AND match_id = p_match_id
        AND status = 'pending'
        AND kind IS DISTINCT FROM 'challenge'
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
