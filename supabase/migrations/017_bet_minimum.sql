-- 017: Stage-based minimum bet enforcement.
-- Knockout matches (R32+) require higher minimum stakes.
-- Specials (CUP_WINNER, CONTINENT, etc.) are exempt.

CREATE OR REPLACE FUNCTION public.bet_min(p_match_id text) RETURNS integer AS $$
  SELECT CASE
    WHEN p_match_id LIKE 'R32-%' THEN 200
    WHEN p_match_id LIKE 'R16-%' THEN 200
    WHEN p_match_id LIKE 'QF-%'  THEN 200
    WHEN p_match_id LIKE 'SF-%'  THEN 200
    WHEN p_match_id LIKE 'FIN-%' THEN 200
    ELSE 50
  END
$$ LANGUAGE sql IMMUTABLE;

-- ──────────────────────────────────────────────────────────────────
-- place_bet: add minimum check (rest unchanged from 010)
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid, p_match_id text, p_pick text, p_amount integer
) RETURNS json AS $$
DECLARE
  v_existing_pick text;
  v_bet_id bigint;
  v_kickoff timestamptz;
BEGIN
  IF p_pick NOT IN ('home', 'away', 'draw') THEN RAISE EXCEPTION 'Invalid pick'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount < public.bet_min(p_match_id) THEN RAISE EXCEPTION 'Bet below minimum (%) for this stage', public.bet_min(p_match_id); END IF;
  IF p_amount > public.bet_max() THEN RAISE EXCEPTION 'Bet exceeds maximum (%)', public.bet_max(); END IF;

  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN
    RAISE EXCEPTION 'Unknown match';
  END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.bets WHERE match_id = p_match_id AND status IN ('won', 'lost') LIMIT 1) THEN
    RAISE EXCEPTION 'Match already resolved';
  END IF;

  SELECT pick INTO v_existing_pick FROM public.bets
    WHERE user_id = p_user_id AND match_id = p_match_id AND kind = 'match' AND status = 'pending' FOR UPDATE;

  IF v_existing_pick IS NOT NULL AND v_existing_pick = p_pick THEN
    RAISE EXCEPTION 'Already bet on this side';
  END IF;

  IF v_existing_pick IS NOT NULL AND v_existing_pick != p_pick THEN
    UPDATE public.bets SET status = 'cancelled'
      WHERE user_id = p_user_id AND match_id = p_match_id AND kind = 'match' AND status = 'pending';
    INSERT INTO public.activity (user_id, type, payload)
      VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
        'match_id', p_match_id, 'reason', 'side_switch', 'new_pick', p_pick));
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, 'match') RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'pick', p_pick, 'amount', p_amount, 'bet_id', v_bet_id));

  RETURN json_build_object('id', v_bet_id, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────
-- place_goalscorer_bet: add minimum check
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_goalscorer_bet(
  p_user_id uuid, p_match_id text, p_player_id text, p_amount integer
) RETURNS json AS $$
DECLARE
  v_bet_id bigint;
  v_existing_id bigint;
  v_kickoff timestamptz;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount < public.bet_min(p_match_id) THEN RAISE EXCEPTION 'Bet below minimum (%) for this stage', public.bet_min(p_match_id); END IF;
  IF p_amount > public.bet_max() THEN RAISE EXCEPTION 'Bet exceeds maximum (%)', public.bet_max(); END IF;

  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN RAISE EXCEPTION 'Unknown match'; END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT id INTO v_existing_id FROM public.bets
    WHERE user_id = p_user_id AND match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
    FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
    INSERT INTO public.activity (user_id, type, payload)
      VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
        'match_id', p_match_id, 'kind', 'goalscorer', 'reason', 'goalscorer_switch'));
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_player_id, p_amount, 'goalscorer')
    RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'kind', 'goalscorer', 'pick', p_player_id, 'amount', p_amount, 'bet_id', v_bet_id));

  RETURN json_build_object('id', v_bet_id, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
