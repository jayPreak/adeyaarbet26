-- Lower final_four minimum bet from 500 to 250
CREATE OR REPLACE FUNCTION public.place_special_bet(
  p_user_id UUID,
  p_match_id TEXT,
  p_kind TEXT,
  p_pick TEXT,
  p_amount INT,
  p_multi_pick BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_balance INT;
  v_kickoff TIMESTAMPTZ;
BEGIN
  IF p_kind NOT IN (
    'continent', 'h2h', 'golden_boot', 'goalscorer',
    'r32_loser', 'r32_winner', 'third_place_qualifiers',
    'scoreline', 'over_under', 'pens', 'challenge', 'final_four', 'total_goals',
    'ko_cup_winner', 'halftime'
  ) THEN
    RAISE EXCEPTION 'Invalid kind for special bet';
  END IF;

  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 10000';
  END IF;

  -- Minimum bet enforcement
  IF p_kind = 'final_four' AND p_amount < 100 THEN
    RAISE EXCEPTION 'Minimum bet is 100 for this special';
  END IF;
  IF p_kind = 'ko_cup_winner' AND p_amount < 250 THEN
    RAISE EXCEPTION 'Minimum bet is 250 for this special';
  END IF;

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
  ELSIF p_kind IN ('final_four', 'total_goals', 'ko_cup_winner') THEN
    IF public.qf_deadline() IS NOT NULL AND now() >= public.qf_deadline() THEN
      RAISE EXCEPTION 'Betting closed — quarterfinals have started';
    END IF;
  ELSIF p_kind IN ('scoreline', 'over_under', 'pens') THEN
    SELECT ms.kickoff_ts INTO v_kickoff
      FROM public.match_schedule ms WHERE ms.id = p_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - INTERVAL '30 seconds' THEN
      RAISE EXCEPTION 'Betting closed for this match';
    END IF;
  ELSIF p_kind = 'halftime' THEN
    SELECT ms.kickoff_ts INTO v_kickoff
      FROM public.match_schedule ms WHERE ms.id = p_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff + INTERVAL '40 minutes' THEN
      RAISE EXCEPTION 'Halftime betting closed for this match';
    END IF;
  END IF;

  -- ── Duplicate check (single-pick specials) ──
  IF NOT p_multi_pick THEN
    PERFORM 1 FROM public.bets
      WHERE user_id = p_user_id
        AND match_id = p_match_id
        AND kind = p_kind
        AND status = 'pending';
    IF FOUND THEN
      RAISE EXCEPTION 'You already have a pending bet on this special';
    END IF;
  END IF;

  -- ── Balance check ──
  SELECT 5000 - COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)
             - COALESCE(SUM(amount) FILTER (WHERE status = 'lost'), 0)
             + COALESCE(SUM(payout) FILTER (WHERE status = 'won'), 0)
    INTO v_balance
    FROM public.bets
    WHERE user_id = p_user_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, status, kind)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, 'pending', p_kind)
    RETURNING id INTO v_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'pick', p_pick, 'amount', p_amount, 'kind', p_kind
    ));

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
