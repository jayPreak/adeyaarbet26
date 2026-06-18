-- 022: Close remaining cheat vectors
--
-- 1. REVOKE settlement RPCs from anon/authenticated (anyone could call
--    settle_goalscorer/settle_cup_winner/settle_special from browser console)
-- 2. Fix cancel_special_bet_by_id to block h2h/golden_boot cancels after deadline
-- 3. Add kind whitelist to place_special_bet (prevent cup_winner via special-bet route)

-- ── 1. Revoke settlement functions from all, grant only to service_role ──────────
REVOKE ALL ON FUNCTION public.settle_goalscorer(text, text[]) FROM public;
REVOKE ALL ON FUNCTION public.settle_cup_winner(text) FROM public;
REVOKE ALL ON FUNCTION public.settle_special(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.settle_goalscorer(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_cup_winner(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_special(text, text, text) TO service_role;

-- ── 2. Fix cancel_special_bet_by_id timing for h2h and golden_boot ──────────────
-- Previously: h2h (MESSI_V_RONALDO) and golden_boot (GOLDEN_BOOT) match_ids don't
-- exist in match_schedule, so the kickoff_ts lookup returned NULL and the check was
-- silently skipped. Now we check cup_winner_deadline() for ALL tournament specials.
CREATE OR REPLACE FUNCTION public.cancel_special_bet_by_id(p_user_id uuid, p_bet_id bigint)
RETURNS json AS $$
DECLARE
  v_bet    record;
  v_kind   text;
  v_match_id text;
  v_kickoff timestamptz;
BEGIN
  -- Find and lock the bet
  SELECT id, user_id, match_id, kind, status INTO v_bet
    FROM public.bets
    WHERE id = p_bet_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  IF v_bet.user_id != p_user_id THEN
    RAISE EXCEPTION 'Not your bet';
  END IF;

  IF v_bet.status != 'pending' THEN
    RAISE EXCEPTION 'Bet is not pending';
  END IF;

  v_kind := v_bet.kind;
  v_match_id := v_bet.match_id;

  -- Tournament-level specials: check cup_winner_deadline
  IF v_kind IN ('cup_winner', 'continent', 'h2h', 'golden_boot') THEN
    IF now() >= public.cup_winner_deadline() THEN
      RAISE EXCEPTION 'Cannot cancel after tournament deadline';
    END IF;
  -- Match-scoped specials (e.g. goalscorer): check match kickoff
  ELSIF v_match_id IS NOT NULL THEN
    SELECT kickoff_ts INTO v_kickoff
      FROM public.match_schedule
      WHERE id = v_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Cannot cancel after match kickoff';
    END IF;
  END IF;

  -- Cancel the bet
  UPDATE public.bets SET status = 'cancelled' WHERE id = p_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', v_match_id, 'kind', v_kind
    ));

  RETURN json_build_object('cancelled', true, 'refunded', v_bet.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Add kind whitelist to place_special_bet ──────────────────────────────────
-- Prevent using place_special_bet to place cup_winner bets (bypassing deadline)
CREATE OR REPLACE FUNCTION public.place_special_bet(
  p_user_id  uuid,
  p_match_id text,
  p_kind     text,
  p_pick     text,
  p_amount   integer,
  p_multi_pick boolean DEFAULT false
)
RETURNS json AS $$
DECLARE
  v_existing_id bigint;
  v_kickoff     timestamptz;
BEGIN
  -- Kind whitelist: cup_winner must use its own dedicated RPC
  IF p_kind NOT IN ('continent', 'h2h', 'golden_boot', 'goalscorer', 'halftime') THEN
    RAISE EXCEPTION 'Invalid kind for special bet';
  END IF;

  -- Validate amount
  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 10000';
  END IF;

  -- Lock profile to serialize
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- ── Deadline/timing checks ──
  -- Tournament-level specials: deadline = first match kickoff (cup_winner_deadline)
  IF p_kind IN ('continent', 'h2h', 'golden_boot') THEN
    IF now() >= public.cup_winner_deadline() THEN
      RAISE EXCEPTION 'Betting closed for this special';
    END IF;
  -- Match-scoped specials: check match kickoff
  ELSIF p_match_id IS NOT NULL THEN
    SELECT kickoff_ts INTO v_kickoff
      FROM public.match_schedule
      WHERE id = p_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Betting closed for this match';
    END IF;
  END IF;

  -- Balance check
  IF p_amount > public.compute_balance(p_user_id) THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- For single-pick specials, cancel existing bet first
  IF NOT p_multi_pick THEN
    SELECT id INTO v_existing_id
      FROM public.bets
      WHERE user_id = p_user_id
        AND match_id = p_match_id
        AND kind = p_kind
        AND status = 'pending'
      LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
    END IF;
  END IF;

  -- Place the bet
  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, p_kind);

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'kind', p_kind, 'pick', p_pick, 'amount', p_amount
    ));

  RETURN json_build_object(
    'placed', true,
    'balance', public.compute_balance(p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
