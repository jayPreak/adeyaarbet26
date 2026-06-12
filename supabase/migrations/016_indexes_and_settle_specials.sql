-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_bets_match_id_status ON public.bets(match_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_user_id_kind_status ON public.bets(user_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_activity_user_created ON public.activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity(created_at DESC);

-- Settlement RPCs for manual specials (continent, h2h, golden_boot)
-- Called via API route or direct query at tournament end.

-- Settle a single-pool special bet (continent, h2h).
-- All pending bets on the winning pick get proportional payout.
-- All others lose. If no winner provided, all bets refunded (cancelled).
CREATE OR REPLACE FUNCTION public.settle_special(
  p_match_id text,     -- 'CONTINENT', 'MESSI_V_RONALDO', 'GOLDEN_BOOT'
  p_kind     text,     -- 'continent', 'h2h', 'golden_boot'
  p_winner   text      -- winning pick value, or NULL to refund all
) RETURNS json AS $$
DECLARE
  v_total_pool  integer;
  v_winner_pool integer;
  v_bet         record;
  v_payout      integer;
  v_settled     integer := 0;
BEGIN
  -- Lock all pending bets in this pool
  PERFORM 1 FROM public.bets
    WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending'
    FOR UPDATE;

  -- If no winner, refund all
  IF p_winner IS NULL THEN
    UPDATE public.bets
      SET status = 'cancelled'
      WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending';
    GET DIAGNOSTICS v_settled = ROW_COUNT;
    RETURN json_build_object('refunded', v_settled);
  END IF;

  -- Calculate pools
  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets
    WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_winner_pool
    FROM public.bets
    WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending' AND pick = p_winner;

  IF v_total_pool = 0 THEN
    RETURN json_build_object('settled', 0, 'message', 'no pending bets');
  END IF;

  -- If nobody picked the winner, refund all
  IF v_winner_pool = 0 THEN
    UPDATE public.bets
      SET status = 'cancelled'
      WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending';
    GET DIAGNOSTICS v_settled = ROW_COUNT;
    RETURN json_build_object('refunded', v_settled, 'reason', 'no bets on winner');
  END IF;

  -- Settle winners
  FOR v_bet IN
    SELECT id, user_id, amount FROM public.bets
      WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending' AND pick = p_winner
  LOOP
    v_payout := FLOOR((v_bet.amount::numeric / v_winner_pool) * v_total_pool);
    UPDATE public.bets SET status = 'won', payout = v_payout, resolved_at = now() WHERE id = v_bet.id;
    INSERT INTO public.activity (user_id, type, payload) VALUES (
      v_bet.user_id, 'bet_won', jsonb_build_object('match_id', p_match_id, 'kind', p_kind, 'payout', v_payout)
    );
    v_settled := v_settled + 1;
  END LOOP;

  -- Settle losers
  UPDATE public.bets
    SET status = 'lost', resolved_at = now()
    WHERE match_id = p_match_id AND kind = p_kind AND status = 'pending' AND pick != p_winner;

  RETURN json_build_object('settled', v_settled, 'total_pool', v_total_pool, 'winner_pool', v_winner_pool);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
