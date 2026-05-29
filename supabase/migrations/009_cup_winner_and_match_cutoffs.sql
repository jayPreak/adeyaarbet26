-- 006: Cup-winner bet + per-match betting cutoffs
--
-- 1. Add `kind` column to bets ('match' | 'cup_winner'), relax pick check.
-- 2. Add match_schedule table (id, kickoff_ts) seeded from lib/data.js.
-- 3. Add cup_winner_deadline() helper.
-- 4. Add place_cup_winner_bet / cancel_cup_winner_bet / settle_cup_winner RPCs.
-- 5. Modify place_bet to enforce kickoff_ts - 30s.

-- ──────────────────────────────────────────────────────────────────
-- 1. bets schema changes
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'match';

ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check
  CHECK (kind IN ('match', 'cup_winner'));

-- Relax pick: 'home'|'away'|'draw' for match, team code for cup_winner.
-- Validation now lives in the RPCs.
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_pick_check;

CREATE INDEX IF NOT EXISTS idx_bets_kind ON public.bets(kind);

-- ──────────────────────────────────────────────────────────────────
-- 2. match_schedule
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.match_schedule (
  id text PRIMARY KEY,
  kickoff_ts timestamptz NOT NULL
);

ALTER TABLE public.match_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_schedule readable by everyone" ON public.match_schedule;
CREATE POLICY "match_schedule readable by everyone"
  ON public.match_schedule FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.match_schedule (id, kickoff_ts) VALUES
  ('A1', '2026-06-11T19:00:00Z'),
  ('A2', '2026-06-12T02:00:00Z'),
  ('A3', '2026-06-18T16:00:00Z'),
  ('A4', '2026-06-19T01:00:00Z'),
  ('A5', '2026-06-25T01:00:00Z'),
  ('A6', '2026-06-25T01:00:00Z'),
  ('B1', '2026-06-12T23:00:00Z'),
  ('B2', '2026-06-14T02:00:00Z'),
  ('B3', '2026-06-19T02:00:00Z'),
  ('B4', '2026-06-19T05:00:00Z'),
  ('B5', '2026-06-25T02:00:00Z'),
  ('B6', '2026-06-25T02:00:00Z'),
  ('C1', '2026-06-13T01:00:00Z'),
  ('C2', '2026-06-13T22:00:00Z'),
  ('C3', '2026-06-19T00:30:00Z'),
  ('C4', '2026-06-19T22:00:00Z'),
  ('C5', '2026-06-24T22:00:00Z'),
  ('C6', '2026-06-24T22:00:00Z'),
  ('D1', '2026-06-12T01:00:00Z'),
  ('D2', '2026-06-13T04:00:00Z'),
  ('D3', '2026-06-19T19:00:00Z'),
  ('D4', '2026-06-19T03:00:00Z'),
  ('D5', '2026-06-25T02:00:00Z'),
  ('D6', '2026-06-25T02:00:00Z'),
  ('E1', '2026-06-14T17:00:00Z'),
  ('E2', '2026-06-14T23:00:00Z'),
  ('E3', '2026-06-20T20:00:00Z'),
  ('E4', '2026-06-21T00:00:00Z'),
  ('E5', '2026-06-25T20:00:00Z'),
  ('E6', '2026-06-25T20:00:00Z'),
  ('F1', '2026-06-14T02:00:00Z'),
  ('F2', '2026-06-14T08:00:00Z'),
  ('F3', '2026-06-20T17:00:00Z'),
  ('F4', '2026-06-21T04:00:00Z'),
  ('F5', '2026-06-25T23:00:00Z'),
  ('F6', '2026-06-26T00:00:00Z'),
  ('G1', '2026-06-15T19:00:00Z'),
  ('G2', '2026-06-16T01:00:00Z'),
  ('G3', '2026-06-21T19:00:00Z'),
  ('G4', '2026-06-22T01:00:00Z'),
  ('G5', '2026-06-27T03:00:00Z'),
  ('G6', '2026-06-27T03:00:00Z'),
  ('H1', '2026-06-15T16:00:00Z'),
  ('H2', '2026-06-15T22:00:00Z'),
  ('H3', '2026-06-21T16:00:00Z'),
  ('H4', '2026-06-21T22:00:00Z'),
  ('H5', '2026-06-27T00:00:00Z'),
  ('H6', '2026-06-27T00:00:00Z'),
  ('I1', '2026-06-16T19:00:00Z'),
  ('I2', '2026-06-16T22:00:00Z'),
  ('I3', '2026-06-22T21:00:00Z'),
  ('I4', '2026-06-23T00:00:00Z'),
  ('I5', '2026-06-26T19:00:00Z'),
  ('I6', '2026-06-26T19:00:00Z'),
  ('J1', '2026-06-16T01:00:00Z'),
  ('J2', '2026-06-16T04:00:00Z'),
  ('J3', '2026-06-22T17:00:00Z'),
  ('J4', '2026-06-23T03:00:00Z'),
  ('J5', '2026-06-28T02:00:00Z'),
  ('J6', '2026-06-28T02:00:00Z'),
  ('K1', '2026-06-17T02:00:00Z'),
  ('K2', '2026-06-17T17:00:00Z'),
  ('K3', '2026-06-23T02:00:00Z'),
  ('K4', '2026-06-23T17:00:00Z'),
  ('K5', '2026-06-27T23:30:00Z'),
  ('K6', '2026-06-27T23:30:00Z'),
  ('L1', '2026-06-17T19:00:00Z'),
  ('L2', '2026-06-17T23:00:00Z'),
  ('L3', '2026-06-23T20:00:00Z'),
  ('L4', '2026-06-23T23:00:00Z'),
  ('L5', '2026-06-27T21:00:00Z'),
  ('L6', '2026-06-27T21:00:00Z')
ON CONFLICT (id) DO UPDATE SET kickoff_ts = EXCLUDED.kickoff_ts;

-- ──────────────────────────────────────────────────────────────────
-- 3. Cup-winner deadline helper
-- Mirrors lib/countdown.js KICKOFF_TS (2026-06-11T20:00:00-06:00) minus 1h
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cup_winner_deadline() RETURNS timestamptz AS $$
  SELECT '2026-06-12T02:00:00Z'::timestamptz - interval '1 hour'
$$ LANGUAGE sql IMMUTABLE;

-- Valid team codes (the 48 participants)
CREATE OR REPLACE FUNCTION public.is_valid_team_code(p_code text) RETURNS boolean AS $$
  SELECT p_code = ANY(ARRAY[
    'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR','HAI','SCO',
    'USA','PAR','AUS','TUR','GER','CUW','CIV','ECU','NED','JPN','SWE','TUN',
    'BEL','EGY','IRN','NZL','ESP','CPV','SAU','URU','FRA','SEN','IRQ','NOR',
    'ARG','ALG','AUT','JOR','POR','COD','UZB','COL','ENG','CRO','GHA','PAN'
  ])
$$ LANGUAGE sql IMMUTABLE;

-- ──────────────────────────────────────────────────────────────────
-- 4. place_cup_winner_bet
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_cup_winner_bet(
  p_user_id uuid,
  p_team_code text,
  p_amount integer
) RETURNS json AS $$
DECLARE
  v_balance integer;
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
  IF now() >= public.cup_winner_deadline() THEN
    RAISE EXCEPTION 'Cup winner betting closed';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Find existing pending cup-winner bet for this user
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

  -- Cancel existing (refund via the standard activity entry)
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

  v_balance := public.compute_balance(p_user_id);
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance';
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

-- ──────────────────────────────────────────────────────────────────
-- cancel_cup_winner_bet
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_cup_winner_bet(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_id bigint;
  v_pick text;
  v_amount integer;
BEGIN
  IF now() >= public.cup_winner_deadline() THEN
    RAISE EXCEPTION 'Cup winner betting closed';
  END IF;

  SELECT id, pick, amount INTO v_id, v_pick, v_amount
    FROM public.bets
    WHERE user_id = p_user_id AND kind = 'cup_winner' AND status = 'pending'
    FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No active cup-winner bet';
  END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = v_id;
  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', 'CUP_WINNER',
      'kind', 'cup_winner',
      'reason', 'user_cancelled',
      'team', v_pick,
      'refunded', v_amount
    ));

  RETURN json_build_object('cancelled', true, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────
-- settle_cup_winner — admin RPC, parimutuel distribution
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.settle_cup_winner(p_winning_team_code text)
RETURNS json AS $$
DECLARE
  v_total_pool integer;
  v_winning_pool integer;
  v_bet record;
  v_payout integer;
  v_payouts_made integer := 0;
BEGIN
  IF NOT public.is_valid_team_code(p_winning_team_code) THEN
    RAISE EXCEPTION 'Invalid team code';
  END IF;

  PERFORM 1 FROM public.bets
    WHERE kind = 'cup_winner' AND status = 'pending'
    FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets WHERE kind = 'cup_winner' AND status = 'pending';

  IF v_total_pool = 0 THEN
    RAISE EXCEPTION 'No pending cup-winner bets to settle';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_winning_pool
    FROM public.bets
    WHERE kind = 'cup_winner' AND status = 'pending' AND pick = p_winning_team_code;

  -- No winners: refund all
  IF v_winning_pool = 0 THEN
    UPDATE public.bets SET status = 'cancelled'
      WHERE kind = 'cup_winner' AND status = 'pending';
    RETURN json_build_object('refunded', true, 'pool', v_total_pool);
  END IF;

  UPDATE public.bets SET status = 'lost'
    WHERE kind = 'cup_winner' AND status = 'pending' AND pick != p_winning_team_code;

  FOR v_bet IN
    SELECT id, user_id, amount FROM public.bets
      WHERE kind = 'cup_winner' AND status = 'pending' AND pick = p_winning_team_code
  LOOP
    v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool)::integer;
    UPDATE public.bets SET status = 'won', payout = v_payout WHERE id = v_bet.id;
    v_payouts_made := v_payouts_made + 1;
    INSERT INTO public.activity (user_id, type, payload)
      VALUES (v_bet.user_id, 'bet_won', jsonb_build_object(
        'match_id', 'CUP_WINNER',
        'kind', 'cup_winner',
        'team', p_winning_team_code,
        'payout', v_payout,
        'bet_id', v_bet.id
      ));
  END LOOP;

  RETURN json_build_object(
    'pool', v_total_pool,
    'winning_pool', v_winning_pool,
    'payouts_made', v_payouts_made,
    'winner', p_winning_team_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────────
-- 5. place_bet — enforce kickoff_ts - 30s
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid, p_match_id text, p_pick text, p_amount integer
) RETURNS json AS $$
DECLARE
  v_balance integer;
  v_existing_pick text;
  v_bet_id bigint;
  v_kickoff timestamptz;
BEGIN
  IF p_pick NOT IN ('home', 'away', 'draw') THEN RAISE EXCEPTION 'Invalid pick'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

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

  v_balance := public.compute_balance(p_user_id);
  IF p_amount > v_balance THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, p_match_id, p_pick, p_amount, 'match') RETURNING id INTO v_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'pick', p_pick, 'amount', p_amount, 'bet_id', v_bet_id));

  RETURN json_build_object('id', v_bet_id, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
