-- Generic special bet placement (single-pick: cancel-and-replace)
-- Supports: continent, halftime, and future specials without new RPCs per type.

CREATE OR REPLACE FUNCTION public.place_special_bet(
  p_user_id   uuid,
  p_match_id  text,       -- pool identifier: 'CONTINENT', 'HT_SHAKIRA', etc.
  p_kind      text,       -- 'continent', 'halftime', etc.
  p_pick      text,       -- the option: 'UEFA', 'yes', 'no', etc.
  p_amount    integer,
  p_multi_pick boolean DEFAULT false
) RETURNS json AS $$
DECLARE
  v_existing_id     bigint;
  v_existing_pick   text;
  v_existing_amt    integer;
BEGIN
  -- Serialise per-user to prevent double-spend races
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Validate amount
  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 10000';
  END IF;

  IF p_multi_pick THEN
    -- Multi-pick: only reject duplicate on exact same option
    SELECT id, pick, amount INTO v_existing_id, v_existing_pick, v_existing_amt
      FROM public.bets
      WHERE user_id = p_user_id AND match_id = p_match_id
        AND kind = p_kind AND pick = p_pick AND status = 'pending'
      FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
      IF v_existing_amt = p_amount THEN
        RAISE EXCEPTION 'Already bet on this option for this amount';
      END IF;
      -- Same option, different amount: cancel old, place new
      UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
      INSERT INTO public.activity (user_id, type, payload) VALUES (
        p_user_id, 'bet_cancelled', jsonb_build_object('match_id', p_match_id, 'kind', p_kind, 'pick', v_existing_pick, 'refunded', v_existing_amt)
      );
    END IF;
  ELSE
    -- Single-pick: cancel any existing pending bet on this pool (regardless of pick)
    SELECT id, pick, amount INTO v_existing_id, v_existing_pick, v_existing_amt
      FROM public.bets
      WHERE user_id = p_user_id AND match_id = p_match_id
        AND kind = p_kind AND status = 'pending'
      FOR UPDATE;

    IF v_existing_pick IS NOT NULL
       AND v_existing_pick = p_pick
       AND v_existing_amt = p_amount THEN
      RAISE EXCEPTION 'Already bet on this option for this amount';
    END IF;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
      INSERT INTO public.activity (user_id, type, payload) VALUES (
        p_user_id, 'bet_cancelled', jsonb_build_object('match_id', p_match_id, 'kind', p_kind, 'pick', v_existing_pick, 'refunded', v_existing_amt)
      );
    END IF;
  END IF;

  -- Place the new bet
  INSERT INTO public.bets (user_id, match_id, kind, pick, amount, status)
    VALUES (p_user_id, p_match_id, p_kind, p_pick, p_amount, 'pending');

  INSERT INTO public.activity (user_id, type, payload) VALUES (
    p_user_id, 'bet_placed', jsonb_build_object('match_id', p_match_id, 'kind', p_kind, 'pick', p_pick, 'amount', p_amount)
  );

  RETURN json_build_object('success', true, 'pick', p_pick, 'amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic cancel by bet ID (with timing check)
CREATE OR REPLACE FUNCTION public.cancel_special_bet_by_id(
  p_user_id uuid,
  p_bet_id  bigint
) RETURNS json AS $$
DECLARE
  v_id        bigint;
  v_pick      text;
  v_amount    integer;
  v_kind      text;
  v_match_id  text;
  v_kickoff   timestamptz;
BEGIN
  SELECT id, pick, amount, kind, match_id
    INTO v_id, v_pick, v_amount, v_kind, v_match_id
    FROM public.bets
    WHERE id = p_bet_id
      AND user_id = p_user_id
      AND status = 'pending'
    FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Bet not found, not yours, or already resolved';
  END IF;

  -- Timing check for match-scoped bets
  IF v_match_id IS NOT NULL AND v_kind != 'cup_winner' AND v_kind != 'continent' THEN
    SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = v_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Betting closed for this match';
    END IF;
  END IF;

  -- For tournament-level bets (cup_winner, continent), check first match deadline
  IF v_kind = 'cup_winner' OR v_kind = 'continent' THEN
    SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = 'A1';
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff THEN
      RAISE EXCEPTION 'Betting closed — tournament has started';
    END IF;
  END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = v_id;

  INSERT INTO public.activity (user_id, type, payload) VALUES (
    p_user_id, 'bet_cancelled', jsonb_build_object('match_id', v_match_id, 'kind', v_kind, 'pick', v_pick, 'refunded', v_amount)
  );

  RETURN json_build_object('cancelled', true, 'refunded', v_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extend bets_kind_check to allow new kinds
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check
  CHECK (kind IN ('match', 'cup_winner', 'goalscorer', 'continent', 'halftime'));
