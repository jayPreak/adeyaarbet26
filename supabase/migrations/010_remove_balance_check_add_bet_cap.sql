-- 010: Remove balance sufficiency check from place_bet / place_cup_winner_bet.
-- Net position is just a ledger — bettors may go negative. The only stake guard
-- is a per-bet maximum of 10,000.

CREATE OR REPLACE FUNCTION public.bet_max() RETURNS integer AS $$
  SELECT 10000
$$ LANGUAGE sql IMMUTABLE;

-- ──────────────────────────────────────────────────────────────────
-- place_bet (mirrors 009 but: drops balance check, adds bet_max cap)
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
-- place_cup_winner_bet (drops balance check, adds bet_max cap)
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_cup_winner_bet(
  p_user_id uuid,
  p_team_code text,
  p_amount integer
) RETURNS json AS $$
DECLARE
  v_existing_pick text;
  v_existing_amount integer;
  v_existing_id bigint;
  v_bet_id bigint;
BEGIN
  IF NOT public.is_valid_team_code(p_team_code) THEN
    RAISE EXCEPTION 'Invalid team code';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount > public.bet_max() THEN
    RAISE EXCEPTION 'Bet exceeds maximum (%)', public.bet_max();
  END IF;
  IF now() >= public.cup_winner_deadline() THEN
    RAISE EXCEPTION 'Cup winner betting closed';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT id, pick, amount
    INTO v_existing_id, v_existing_pick, v_existing_amount
    FROM public.bets
    WHERE user_id = p_user_id AND kind = 'cup_winner' AND status = 'pending'
    FOR UPDATE;

  IF v_existing_pick IS NOT NULL
     AND v_existing_pick = p_team_code
     AND v_existing_amount = p_amount THEN
    RAISE EXCEPTION 'Already on this team for this amount';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
    INSERT INTO public.activity (user_id, type, payload)
      VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
        'match_id', 'CUP_WINNER',
        'kind', 'cup_winner',
        'reason', 'cup_winner_switch',
        'old_team', v_existing_pick,
        'new_team', p_team_code,
        'refunded', v_existing_amount
      ));
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, 'CUP_WINNER', p_team_code, p_amount, 'cup_winner')
    RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', 'CUP_WINNER',
      'kind', 'cup_winner',
      'team', p_team_code,
      'amount', p_amount,
      'bet_id', v_bet_id
    ));

  RETURN json_build_object(
    'id', v_bet_id,
    'team_code', p_team_code,
    'amount', p_amount,
    'balance', public.compute_balance(p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
