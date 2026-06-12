-- 012: Goalscorer bets
-- Parimutuel "anytime goalscorer" market, one pool per match.
-- Winners = bettors who picked any player that scored a regular goal (own goals excluded).
-- 0-goal match or no matching bets → full refund.

-- ──────────────────────────────────────────────────────────────────
-- 1. Relax activity type constraint (allow bet_cancelled used since 009)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.activity DROP CONSTRAINT IF EXISTS activity_type_check;
ALTER TABLE public.activity ADD CONSTRAINT activity_type_check
  CHECK (type IN ('bet_placed', 'bet_won', 'bet_lost', 'bet_cancelled', 'joined'));

-- ──────────────────────────────────────────────────────────────────
-- 2. Extend bets kind constraint
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check
  CHECK (kind IN ('match', 'cup_winner', 'goalscorer'));

-- ──────────────────────────────────────────────────────────────────
-- 3. Add FIFA identifiers to match_schedule for live-endpoint lookup
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.match_schedule
  ADD COLUMN IF NOT EXISTS fifa_id_stage text,
  ADD COLUMN IF NOT EXISTS fifa_id_match  text;

-- ──────────────────────────────────────────────────────────────────
-- 4. Player cache per match (populated lazily by API route)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.match_players (
  match_id    text NOT NULL,
  player_id   text NOT NULL,
  player_name text NOT NULL,
  team_code   text NOT NULL,
  jersey_num  text,
  position    integer, -- 0=GK 1=DEF 2=MID 3=FWD
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_players readable by authenticated" ON public.match_players;
CREATE POLICY "match_players readable by authenticated"
  ON public.match_players FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "match_players readable by anon" ON public.match_players;
CREATE POLICY "match_players readable by anon"
  ON public.match_players FOR SELECT TO anon USING (true);

-- ──────────────────────────────────────────────────────────────────
-- 5. place_goalscorer_bet
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_goalscorer_bet(
  p_user_id   uuid,
  p_match_id  text,
  p_player_id text,
  p_amount    integer
) RETURNS json AS $$
DECLARE
  v_existing_id   bigint;
  v_existing_pick text;
  v_existing_amt  integer;
  v_bet_id        bigint;
  v_kickoff       timestamptz;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > public.bet_max() THEN RAISE EXCEPTION 'Bet exceeds maximum (%)', public.bet_max(); END IF;

  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN RAISE EXCEPTION 'Unknown match'; END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bets
      WHERE match_id = p_match_id AND kind = 'goalscorer' AND status IN ('won', 'lost')
      LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Match already resolved';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT id, pick, amount
    INTO v_existing_id, v_existing_pick, v_existing_amt
    FROM public.bets
    WHERE user_id = p_user_id AND match_id = p_match_id
      AND kind = 'goalscorer' AND status = 'pending'
    FOR UPDATE;

  IF v_existing_pick IS NOT NULL
     AND v_existing_pick = p_player_id
     AND v_existing_amt  = p_amount THEN
    RAISE EXCEPTION 'Already bet on this player for this amount';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.bets SET status = 'cancelled' WHERE id = v_existing_id;
    INSERT INTO public.activity (user_id, type, payload) VALUES (
      p_user_id, 'bet_cancelled', jsonb_build_object(
        'match_id', p_match_id, 'kind', 'goalscorer',
        'reason', 'player_switch',
        'old_player', v_existing_pick, 'new_player', p_player_id,
        'refunded', v_existing_amt
      )
    );
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_player_id, p_amount, 'goalscorer')
    RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload) VALUES (
    p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'kind', 'goalscorer',
      'player_id', p_player_id, 'amount', p_amount, 'bet_id', v_bet_id
    )
  );

  RETURN json_build_object(
    'id', v_bet_id,
    'player_id', p_player_id,
    'amount', p_amount,
    'balance', public.compute_balance(p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────
-- 6. cancel_goalscorer_bet
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_goalscorer_bet(
  p_user_id  uuid,
  p_match_id text
) RETURNS json AS $$
DECLARE
  v_id      bigint;
  v_pick    text;
  v_amount  integer;
  v_kickoff timestamptz;
BEGIN
  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN RAISE EXCEPTION 'Unknown match'; END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  SELECT id, pick, amount INTO v_id, v_pick, v_amount
    FROM public.bets
    WHERE user_id = p_user_id AND match_id = p_match_id
      AND kind = 'goalscorer' AND status = 'pending'
    FOR UPDATE;

  IF v_id IS NULL THEN RAISE EXCEPTION 'No active goalscorer bet'; END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = v_id;
  INSERT INTO public.activity (user_id, type, payload) VALUES (
    p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', p_match_id, 'kind', 'goalscorer',
      'reason', 'user_cancelled', 'player_id', v_pick, 'refunded', v_amount
    )
  );

  RETURN json_build_object('cancelled', true, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────
-- 7. settle_goalscorer
-- Called by /api/auto-resolve after match finishes.
-- p_scoring_player_ids: FIFA player IDs who scored (own goals excluded by caller).
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_goalscorer(
  p_match_id           text,
  p_scoring_player_ids text[]
) RETURNS json AS $$
DECLARE
  v_total_pool   integer;
  v_winning_pool integer;
  v_bet          record;
  v_payout       integer;
  v_payouts_made integer := 0;
BEGIN
  PERFORM 1 FROM public.bets
    WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
    FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets
    WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending';

  IF v_total_pool = 0 THEN
    RETURN json_build_object('skipped', true, 'reason', 'no_bets');
  END IF;

  -- No scorers or empty array → refund all (0-0 draw, etc.)
  IF p_scoring_player_ids IS NULL
     OR array_length(p_scoring_player_ids, 1) IS NULL THEN
    UPDATE public.bets SET status = 'cancelled'
      WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending';
    RETURN json_build_object('refunded', true, 'pool', v_total_pool, 'reason', 'no_scorers');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_winning_pool
    FROM public.bets
    WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
      AND pick = ANY(p_scoring_player_ids);

  -- Scorers existed but nobody bet on them → refund all
  IF v_winning_pool = 0 THEN
    UPDATE public.bets SET status = 'cancelled'
      WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending';
    RETURN json_build_object('refunded', true, 'pool', v_total_pool, 'reason', 'no_winners');
  END IF;

  UPDATE public.bets SET status = 'lost'
    WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
      AND NOT (pick = ANY(p_scoring_player_ids));

  FOR v_bet IN
    SELECT id, user_id, amount FROM public.bets
      WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
        AND pick = ANY(p_scoring_player_ids)
  LOOP
    v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool)::integer;
    UPDATE public.bets SET status = 'won', payout = v_payout WHERE id = v_bet.id;
    v_payouts_made := v_payouts_made + 1;
    INSERT INTO public.activity (user_id, type, payload) VALUES (
      v_bet.user_id, 'bet_won', jsonb_build_object(
        'match_id', p_match_id, 'kind', 'goalscorer',
        'player_id', v_bet.pick, 'payout', v_payout, 'bet_id', v_bet.id
      )
    );
  END LOOP;

  RETURN json_build_object(
    'pool', v_total_pool,
    'winning_pool', v_winning_pool,
    'payouts_made', v_payouts_made,
    'scorers', p_scoring_player_ids
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
