-- 034: Add ko_cup_winner kind for the knockout-stage cup winner bet.
-- Separate pool from the original cup_winner (which closed at tournament start).
-- Deadline: qf_deadline() (first QF kickoff, currently pinned to 2026-07-09T19:30:00Z).
-- Only teams still alive in the knockout bracket are valid picks (enforced client-side;
-- the RPC only checks the deadline, not team elimination status).

-- 1. Expand kind constraint
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check CHECK (
  kind IN (
    'match', 'cup_winner', 'goalscorer', 'continent',
    'halftime', 'h2h', 'golden_boot', 'penalty',
    'third_place_qualifiers', 'r32_loser', 'r32_winner',
    'scoreline', 'over_under', 'pens', 'challenge', 'final_four', 'total_goals',
    'ko_cup_winner'
  )
);

-- 2. Add ko_cup_winner to place_special_bet whitelist + deadline check.
-- Recreate with the new kind included.
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
  IF p_kind NOT IN (
    'continent', 'h2h', 'golden_boot', 'goalscorer', 'halftime',
    'third_place_qualifiers', 'r32_loser', 'r32_winner',
    'scoreline', 'over_under', 'pens', 'final_four', 'total_goals',
    'ko_cup_winner'
  ) THEN
    RAISE EXCEPTION 'Invalid kind for special bet';
  END IF;

  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 10000';
  END IF;

  -- Higher minimum for knockout-stage specials
  IF p_kind = 'final_four' AND p_amount < 500 THEN
    RAISE EXCEPTION 'Minimum bet is 500 for this special';
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
    IF v_kickoff IS NOT NULL AND now() >= (v_kickoff - interval '30 seconds') THEN
      RAISE EXCEPTION 'Match betting closed';
    END IF;
  ELSIF p_kind = 'goalscorer' THEN
    SELECT ms.kickoff_ts INTO v_kickoff
      FROM public.match_schedule ms WHERE ms.id = p_match_id;
    IF v_kickoff IS NOT NULL AND now() >= (v_kickoff - interval '30 seconds') THEN
      RAISE EXCEPTION 'Match betting closed';
    END IF;
  END IF;

  -- Duplicate check (single-pick specials: one active bet per user per match_id+kind)
  IF NOT p_multi_pick THEN
    SELECT id INTO v_existing_id FROM public.bets
      WHERE user_id = p_user_id AND match_id = p_match_id AND kind = p_kind AND status = 'pending'
      FOR UPDATE;
    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Already have an active bet for this special';
    END IF;
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind, status)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, p_kind, 'pending');

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'kind', p_kind, 'pick', p_pick, 'amount', p_amount));

  RETURN json_build_object('success', true, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
