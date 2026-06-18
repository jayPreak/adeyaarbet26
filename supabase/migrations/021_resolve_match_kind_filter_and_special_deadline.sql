-- 021: Fix resolve_match to exclude goalscorer bets from match pool,
-- and add deadline enforcement to place_special_bet.
--
-- Bug 1: resolve_match queries `WHERE match_id = X AND status = 'pending'`
-- with no kind filter. Goalscorer bets share match_id with match bets,
-- so they'd be absorbed into the match pool and marked lost.
--
-- Bug 2: place_special_bet has no deadline/timing check. Users can place
-- continent/h2h/golden_boot bets after their deadlines via direct API call.

-- ── 1. Fix resolve_match to only include match + penalty bets ────────────────
CREATE OR REPLACE FUNCTION public.resolve_match(p_match_id text, p_winner text)
RETURNS json AS $$
DECLARE
  v_total_pool   integer;
  v_winning_pool integer;
  v_bet          record;
  v_payout       integer;
  v_resolved     integer := 0;
BEGIN
  -- Lock all pending match/penalty bets on this match
  PERFORM 1 FROM public.bets
    WHERE match_id = p_match_id
      AND kind IN ('match', 'penalty')
      AND status = 'pending'
    FOR UPDATE;

  -- Total pool = sum of all pending match + penalty bets
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets
    WHERE match_id = p_match_id
      AND kind IN ('match', 'penalty')
      AND status = 'pending';

  IF v_total_pool = 0 THEN
    RAISE EXCEPTION 'No pending bets on this match (already resolved?)';
  END IF;

  -- Winning side pool
  SELECT COALESCE(SUM(amount), 0) INTO v_winning_pool
    FROM public.bets
    WHERE match_id = p_match_id
      AND kind IN ('match', 'penalty')
      AND status = 'pending'
      AND pick = p_winner;

  -- If no one picked the winner, refund all
  IF v_winning_pool = 0 THEN
    UPDATE public.bets
      SET status = 'cancelled'
      WHERE match_id = p_match_id
        AND kind IN ('match', 'penalty')
        AND status = 'pending';
    RETURN json_build_object('refunded', true, 'total_pool', v_total_pool);
  END IF;

  -- Distribute pool to winners, mark losers
  FOR v_bet IN
    SELECT id, user_id, pick, amount
      FROM public.bets
      WHERE match_id = p_match_id
        AND kind IN ('match', 'penalty')
        AND status = 'pending'
  LOOP
    IF v_bet.pick = p_winner THEN
      v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool);
      UPDATE public.bets
        SET status = 'won', payout = v_payout, resolved_at = now()
        WHERE id = v_bet.id;

      INSERT INTO public.activity (user_id, type, payload)
        VALUES (v_bet.user_id, 'bet_won', jsonb_build_object(
          'match_id', p_match_id, 'payout', v_payout
        ));
    ELSE
      UPDATE public.bets
        SET status = 'lost', resolved_at = now()
        WHERE id = v_bet.id;
    END IF;
    v_resolved := v_resolved + 1;
  END LOOP;

  RETURN json_build_object(
    'resolved', v_resolved,
    'total_pool', v_total_pool,
    'winning_pool', v_winning_pool,
    'winner', p_winner
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Add deadline check to place_special_bet ───────────────────────────────
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

-- ── 3. Revoke settlement RPCs from anon/authenticated roles ──────────────────
-- Only service_role (used by auto-resolve server-side) should settle matches.
REVOKE EXECUTE ON FUNCTION public.resolve_match(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_all_pending_penalties() FROM anon, authenticated;
