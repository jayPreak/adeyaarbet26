-- 032: Match props (scoreline, over_under, pens), friend duels (challenge),
--      Final Four special, Total Tournament Goals special.
--
-- New kinds:
--   scoreline    — per-match exact score pool (pick = '2-1' or other_home/other_away/other_draw)
--   over_under   — per-match total goals over/under 2.5 (pick = 'over' | 'under')
--   pens         — knockout-only "goes to penalties?" (pick = 'yes' | 'no')
--   challenge    — 1v1 friend duel stakes (placed ONLY via create_challenge RPC)
--   final_four   — pick 4 semifinalists (pick = comma-joined team codes)
--   total_goals  — tournament total goals over/under (match_id = 'TOTAL_GOALS')

-- ── 1. Extend bets kind constraint ──────────────────────────────────
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check CHECK (
  kind IN (
    'match', 'cup_winner', 'goalscorer', 'continent',
    'halftime', 'h2h', 'golden_boot', 'penalty',
    'third_place_qualifiers', 'r32_loser', 'r32_winner',
    'scoreline', 'over_under', 'pens', 'challenge', 'final_four', 'total_goals'
  )
);

-- ── 2. Helper: deadline for QF-gated tournament specials ────────────
-- Final Four + Total Goals close at the first quarterfinal kickoff.
CREATE OR REPLACE FUNCTION public.qf_deadline()
RETURNS timestamptz AS $$
  SELECT MIN(kickoff_ts) FROM public.match_schedule WHERE id LIKE 'QF-%';
$$ LANGUAGE sql STABLE;

-- ── 3. place_special_bet: allow new kinds + timing rules ────────────
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
  -- Kind whitelist ('challenge' is intentionally excluded: use create_challenge)
  IF p_kind NOT IN (
    'continent', 'h2h', 'golden_boot', 'goalscorer', 'halftime',
    'third_place_qualifiers', 'r32_loser', 'r32_winner',
    'scoreline', 'over_under', 'pens', 'final_four', 'total_goals'
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
  ELSIF p_kind IN ('final_four', 'total_goals') THEN
    IF public.qf_deadline() IS NOT NULL AND now() >= public.qf_deadline() THEN
      RAISE EXCEPTION 'Betting closed — quarterfinals have started';
    END IF;
  ELSIF p_kind IN ('scoreline', 'over_under', 'pens') THEN
    -- Match props require a scheduled match; fail closed on unknown match.
    SELECT kickoff_ts INTO v_kickoff
      FROM public.match_schedule
      WHERE id = p_match_id;
    IF v_kickoff IS NULL THEN
      RAISE EXCEPTION 'Unknown match';
    END IF;
    IF now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Betting closed for this match';
    END IF;
    -- pens only makes sense for knockout matches (dashed static IDs)
    IF p_kind = 'pens' AND position('-' in p_match_id) = 0 THEN
      RAISE EXCEPTION 'Penalty prop only available on knockout matches';
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

-- ── 4. cancel_special_bet_by_id: deadline rules for new kinds ───────
CREATE OR REPLACE FUNCTION public.cancel_special_bet_by_id(p_user_id uuid, p_bet_id bigint)
RETURNS json AS $$
DECLARE
  v_bet    record;
  v_kind   text;
  v_match_id text;
  v_kickoff timestamptz;
BEGIN
  SELECT id, user_id, match_id, kind, status, amount INTO v_bet
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

  IF v_bet.kind = 'challenge' THEN
    RAISE EXCEPTION 'Duel stakes are managed from the duel, not here';
  END IF;

  v_kind := v_bet.kind;
  v_match_id := v_bet.match_id;

  -- Tournament-level specials: check cup_winner_deadline
  IF v_kind IN ('cup_winner', 'continent', 'h2h', 'golden_boot') THEN
    IF now() >= public.cup_winner_deadline() THEN
      RAISE EXCEPTION 'Cannot cancel after tournament deadline';
    END IF;
  -- QF-gated tournament specials
  ELSIF v_kind IN ('final_four', 'total_goals') THEN
    IF public.qf_deadline() IS NOT NULL AND now() >= public.qf_deadline() THEN
      RAISE EXCEPTION 'Cannot cancel — quarterfinals have started';
    END IF;
  -- Match-scoped specials (goalscorer, scoreline, over_under, pens): match kickoff
  ELSIF v_match_id IS NOT NULL THEN
    SELECT kickoff_ts INTO v_kickoff
      FROM public.match_schedule
      WHERE id = v_match_id;
    IF v_kickoff IS NOT NULL AND now() >= v_kickoff - interval '30 seconds' THEN
      RAISE EXCEPTION 'Cannot cancel after match kickoff';
    END IF;
  END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = p_bet_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', v_match_id, 'kind', v_kind
    ));

  RETURN json_build_object('cancelled', true, 'refunded', v_bet.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Friend duels (challenges) ────────────────────────────────────
-- Money flows through the bets ledger (kind = 'challenge') so computed
-- balances stay correct. This table holds the duel metadata only.
CREATE TABLE IF NOT EXISTS public.challenges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          text NOT NULL,
  challenger_id     uuid NOT NULL REFERENCES public.profiles(id),
  opponent_id       uuid NOT NULL REFERENCES public.profiles(id),
  challenger_pick   text NOT NULL CHECK (challenger_pick IN ('home', 'away')),
  amount            integer NOT NULL CHECK (amount > 0 AND amount <= 10000),
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','accepted','declined','cancelled','expired','settled','void')),
  challenger_bet_id bigint REFERENCES public.bets(id),
  opponent_bet_id   bigint REFERENCES public.bets(id),
  winner_id         uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_challenges_match_status ON public.challenges(match_id, status);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges readable by anon" ON public.challenges;
CREATE POLICY "challenges readable by anon"
  ON public.challenges FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "challenges readable by authenticated" ON public.challenges;
CREATE POLICY "challenges readable by authenticated"
  ON public.challenges FOR SELECT TO authenticated USING (true);

-- create_challenge: challenger stakes immediately (pending bet row)
CREATE OR REPLACE FUNCTION public.create_challenge(
  p_challenger uuid,
  p_opponent   uuid,
  p_match_id   text,
  p_pick       text,
  p_amount     integer
) RETURNS json AS $$
DECLARE
  v_kickoff timestamptz;
  v_bet_id  bigint;
  v_id      uuid;
BEGIN
  IF p_pick NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'Pick must be home or away';
  END IF;
  IF p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Amount must be between 1 and 10000';
  END IF;
  IF p_challenger = p_opponent THEN
    RAISE EXCEPTION 'You cannot challenge yourself';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_challenger FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_opponent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opponent not found'; END IF;

  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = p_match_id;
  IF v_kickoff IS NULL THEN RAISE EXCEPTION 'Unknown match'; END IF;
  IF now() >= v_kickoff - interval '30 seconds' THEN
    RAISE EXCEPTION 'Betting closed for this match';
  END IF;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_challenger, p_match_id, p_pick, p_amount, 'challenge')
    RETURNING id INTO v_bet_id;

  INSERT INTO public.challenges (match_id, challenger_id, opponent_id, challenger_pick, amount, challenger_bet_id)
    VALUES (p_match_id, p_challenger, p_opponent, p_pick, p_amount, v_bet_id)
    RETURNING id INTO v_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_challenger, 'bet_placed', jsonb_build_object(
      'match_id', p_match_id, 'kind', 'challenge', 'pick', p_pick,
      'amount', p_amount, 'opponent_id', p_opponent, 'challenge_id', v_id
    ));

  RETURN json_build_object('id', v_id, 'balance', public.compute_balance(p_challenger));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- accept_challenge: opponent stakes the same amount on the opposite side
CREATE OR REPLACE FUNCTION public.accept_challenge(
  p_user_id      uuid,
  p_challenge_id uuid
) RETURNS json AS $$
DECLARE
  v_ch      record;
  v_kickoff timestamptz;
  v_pick    text;
  v_bet_id  bigint;
BEGIN
  SELECT * INTO v_ch FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel not found'; END IF;
  IF v_ch.opponent_id != p_user_id THEN RAISE EXCEPTION 'This duel is not for you'; END IF;
  IF v_ch.status != 'open' THEN RAISE EXCEPTION 'Duel is no longer open'; END IF;

  SELECT kickoff_ts INTO v_kickoff FROM public.match_schedule WHERE id = v_ch.match_id;
  IF v_kickoff IS NULL OR now() >= v_kickoff - interval '30 seconds' THEN
    -- Too late: refund challenger and expire the duel
    UPDATE public.bets SET status = 'cancelled' WHERE id = v_ch.challenger_bet_id AND status = 'pending';
    UPDATE public.challenges SET status = 'expired', resolved_at = now() WHERE id = p_challenge_id;
    RAISE EXCEPTION 'Duel expired — match already started';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  v_pick := CASE WHEN v_ch.challenger_pick = 'home' THEN 'away' ELSE 'home' END;

  INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
    VALUES (p_user_id, v_ch.match_id, v_pick, v_ch.amount, 'challenge')
    RETURNING id INTO v_bet_id;

  UPDATE public.challenges
    SET status = 'accepted', opponent_bet_id = v_bet_id
    WHERE id = p_challenge_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_placed', jsonb_build_object(
      'match_id', v_ch.match_id, 'kind', 'challenge', 'pick', v_pick,
      'amount', v_ch.amount, 'opponent_id', v_ch.challenger_id, 'challenge_id', p_challenge_id
    ));

  RETURN json_build_object('accepted', true, 'balance', public.compute_balance(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- decline_challenge: opponent declines an open duel → challenger refunded
CREATE OR REPLACE FUNCTION public.decline_challenge(
  p_user_id      uuid,
  p_challenge_id uuid
) RETURNS json AS $$
DECLARE
  v_ch record;
BEGIN
  SELECT * INTO v_ch FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel not found'; END IF;
  IF v_ch.opponent_id != p_user_id THEN RAISE EXCEPTION 'This duel is not for you'; END IF;
  IF v_ch.status != 'open' THEN RAISE EXCEPTION 'Duel is no longer open'; END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = v_ch.challenger_bet_id AND status = 'pending';
  UPDATE public.challenges SET status = 'declined', resolved_at = now() WHERE id = p_challenge_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (v_ch.challenger_id, 'bet_cancelled', jsonb_build_object(
      'match_id', v_ch.match_id, 'kind', 'challenge', 'reason', 'declined',
      'refunded', v_ch.amount, 'challenge_id', p_challenge_id
    ));

  RETURN json_build_object('declined', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cancel_challenge: challenger withdraws an open (unaccepted) duel
CREATE OR REPLACE FUNCTION public.cancel_challenge(
  p_user_id      uuid,
  p_challenge_id uuid
) RETURNS json AS $$
DECLARE
  v_ch record;
BEGIN
  SELECT * INTO v_ch FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel not found'; END IF;
  IF v_ch.challenger_id != p_user_id THEN RAISE EXCEPTION 'Not your duel'; END IF;
  IF v_ch.status != 'open' THEN RAISE EXCEPTION 'Duel is no longer open'; END IF;

  UPDATE public.bets SET status = 'cancelled' WHERE id = v_ch.challenger_bet_id AND status = 'pending';
  UPDATE public.challenges SET status = 'cancelled', resolved_at = now() WHERE id = p_challenge_id;

  INSERT INTO public.activity (user_id, type, payload)
    VALUES (p_user_id, 'bet_cancelled', jsonb_build_object(
      'match_id', v_ch.match_id, 'kind', 'challenge', 'reason', 'user_cancelled',
      'refunded', v_ch.amount, 'challenge_id', p_challenge_id
    ));

  RETURN json_build_object('cancelled', true, 'refunded', v_ch.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- settle_challenges: called by auto-resolve after a match finishes.
-- p_winner: 'home' | 'away' | 'draw'. Draw (group stage) voids duels — both refunded.
-- Unaccepted duels on a finished match expire with a refund.
CREATE OR REPLACE FUNCTION public.settle_challenges(
  p_match_id text,
  p_winner   text
) RETURNS json AS $$
DECLARE
  v_ch          record;
  v_settled     integer := 0;
  v_expired     integer := 0;
  v_voided      integer := 0;
  v_winner_id   uuid;
  v_winner_bet  bigint;
  v_loser_bet   bigint;
BEGIN
  FOR v_ch IN
    SELECT * FROM public.challenges
      WHERE match_id = p_match_id AND status IN ('open', 'accepted')
      FOR UPDATE
  LOOP
    IF v_ch.status = 'open' THEN
      -- Never accepted: refund the challenger
      UPDATE public.bets SET status = 'cancelled' WHERE id = v_ch.challenger_bet_id AND status = 'pending';
      UPDATE public.challenges SET status = 'expired', resolved_at = now() WHERE id = v_ch.id;
      v_expired := v_expired + 1;
    ELSIF p_winner NOT IN ('home', 'away') THEN
      -- Draw: void the duel, refund both sides
      UPDATE public.bets SET status = 'cancelled'
        WHERE id IN (v_ch.challenger_bet_id, v_ch.opponent_bet_id) AND status = 'pending';
      UPDATE public.challenges SET status = 'void', resolved_at = now() WHERE id = v_ch.id;
      v_voided := v_voided + 1;
    ELSE
      IF v_ch.challenger_pick = p_winner THEN
        v_winner_id  := v_ch.challenger_id;
        v_winner_bet := v_ch.challenger_bet_id;
        v_loser_bet  := v_ch.opponent_bet_id;
      ELSE
        v_winner_id  := v_ch.opponent_id;
        v_winner_bet := v_ch.opponent_bet_id;
        v_loser_bet  := v_ch.challenger_bet_id;
      END IF;

      UPDATE public.bets SET status = 'won', payout = v_ch.amount * 2, resolved_at = now()
        WHERE id = v_winner_bet AND status = 'pending';
      UPDATE public.bets SET status = 'lost', resolved_at = now()
        WHERE id = v_loser_bet AND status = 'pending';
      UPDATE public.challenges
        SET status = 'settled', winner_id = v_winner_id, resolved_at = now()
        WHERE id = v_ch.id;

      INSERT INTO public.activity (user_id, type, payload)
        VALUES (v_winner_id, 'bet_won', jsonb_build_object(
          'match_id', p_match_id, 'kind', 'challenge',
          'payout', v_ch.amount * 2, 'challenge_id', v_ch.id
        ));
      v_settled := v_settled + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('settled', v_settled, 'expired', v_expired, 'voided', v_voided);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. settle_final_four: most correct semifinalists wins ───────────
-- p_semifinalists: the 4 team codes that reached the semis.
-- Bets with the highest number of correct picks split the pool proportionally.
-- If the max correct count is 0, everyone is refunded.
CREATE OR REPLACE FUNCTION public.settle_final_four(
  p_semifinalists text[]
) RETURNS json AS $$
DECLARE
  v_total_pool   integer;
  v_max_correct  integer := 0;
  v_winner_pool  integer := 0;
  v_bet          record;
  v_correct      integer;
  v_payout       integer;
  v_settled      integer := 0;
BEGIN
  PERFORM 1 FROM public.bets
    WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending'
    FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets
    WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending';

  IF v_total_pool = 0 THEN
    RETURN json_build_object('settled', 0, 'message', 'no pending bets');
  END IF;

  -- Find the best correct-count across all bets
  FOR v_bet IN
    SELECT id, pick, amount FROM public.bets
      WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending'
  LOOP
    SELECT COUNT(*) INTO v_correct
      FROM unnest(string_to_array(v_bet.pick, ',')) t
      WHERE t = ANY(p_semifinalists);
    IF v_correct > v_max_correct THEN v_max_correct := v_correct; END IF;
  END LOOP;

  IF v_max_correct = 0 THEN
    UPDATE public.bets SET status = 'cancelled'
      WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending';
    RETURN json_build_object('refunded', true, 'reason', 'nobody got any correct');
  END IF;

  -- Winner pool = stakes of bets with the max correct count
  FOR v_bet IN
    SELECT id, pick, amount FROM public.bets
      WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending'
  LOOP
    SELECT COUNT(*) INTO v_correct
      FROM unnest(string_to_array(v_bet.pick, ',')) t
      WHERE t = ANY(p_semifinalists);
    IF v_correct = v_max_correct THEN
      v_winner_pool := v_winner_pool + v_bet.amount;
    END IF;
  END LOOP;

  FOR v_bet IN
    SELECT id, user_id, pick, amount FROM public.bets
      WHERE match_id = 'FINAL_FOUR' AND kind = 'final_four' AND status = 'pending'
  LOOP
    SELECT COUNT(*) INTO v_correct
      FROM unnest(string_to_array(v_bet.pick, ',')) t
      WHERE t = ANY(p_semifinalists);
    IF v_correct = v_max_correct THEN
      v_payout := FLOOR((v_bet.amount::numeric / v_winner_pool) * v_total_pool);
      UPDATE public.bets SET status = 'won', payout = v_payout, resolved_at = now() WHERE id = v_bet.id;
      INSERT INTO public.activity (user_id, type, payload) VALUES (
        v_bet.user_id, 'bet_won', jsonb_build_object(
          'match_id', 'FINAL_FOUR', 'kind', 'final_four',
          'payout', v_payout, 'correct', v_correct
        )
      );
      v_settled := v_settled + 1;
    ELSE
      UPDATE public.bets SET status = 'lost', resolved_at = now() WHERE id = v_bet.id;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'settled', v_settled, 'max_correct', v_max_correct,
    'total_pool', v_total_pool, 'winner_pool', v_winner_pool
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Lock down settlement RPCs (022 pattern) ──────────────────────
REVOKE ALL ON FUNCTION public.settle_challenges(text, text) FROM public;
REVOKE ALL ON FUNCTION public.settle_challenges(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_challenges(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.settle_final_four(text[]) FROM public;
REVOKE ALL ON FUNCTION public.settle_final_four(text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_final_four(text[]) TO service_role;
