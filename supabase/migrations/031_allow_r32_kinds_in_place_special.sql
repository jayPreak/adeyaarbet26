-- 031: Add r32_loser and r32_winner to place_special_bet kind whitelist.
-- Migration 030 added these kinds to the bets_kind_check constraint but
-- the RPC still rejects them with "Invalid kind for special bet".

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
  -- Kind whitelist
  IF p_kind NOT IN (
    'continent', 'h2h', 'golden_boot', 'goalscorer', 'halftime',
    'third_place_qualifiers', 'r32_loser', 'r32_winner'
  ) THEN
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
  IF p_kind IN ('continent', 'h2h', 'golden_boot') THEN
    IF now() >= public.cup_winner_deadline() THEN
      RAISE EXCEPTION 'Betting closed for this special';
    END IF;
  ELSIF p_kind = 'third_place_qualifiers' THEN
    IF now() >= '2026-06-26T18:59:00Z'::timestamptz THEN
      RAISE EXCEPTION 'Betting closed for third-place qualifiers';
    END IF;
  ELSIF p_kind IN ('r32_loser', 'r32_winner') THEN
    IF now() >= '2026-07-03T12:30:00Z'::timestamptz THEN
      RAISE EXCEPTION 'Betting closed for KO special';
    END IF;
  ELSIF p_match_id IS NOT NULL THEN
    SELECT kickoff_ts INTO v_kickoff
      FROM public.match_schedule
      WHERE id = p_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Betting closed for this match';
    END IF;
  END IF;

  -- For single-pick specials, cancel existing bet first (idempotent replace)
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
