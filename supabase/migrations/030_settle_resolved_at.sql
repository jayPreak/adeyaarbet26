-- 030: Set resolved_at when settling goalscorer and cup-winner bets.
--
-- resolve_match (021), settle_special (016) and settle_third_place_qualifiers
-- (024) already stamp resolved_at, but settle_goalscorer (012) and
-- settle_cup_winner (009) did not. The net-worth graph orders chronological
-- P&L by resolved_at (falling back to created_at), so payouts from these two
-- markets plotted at bet-placement time instead of settlement time. Bodies are
-- otherwise identical to their previous versions.

-- ── settle_goalscorer (was 012) ──────────────────────────────────────────────
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

  UPDATE public.bets SET status = 'lost', resolved_at = now()
    WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
      AND NOT (pick = ANY(p_scoring_player_ids));

  FOR v_bet IN
    SELECT id, user_id, amount FROM public.bets
      WHERE match_id = p_match_id AND kind = 'goalscorer' AND status = 'pending'
        AND pick = ANY(p_scoring_player_ids)
  LOOP
    v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool)::integer;
    UPDATE public.bets SET status = 'won', payout = v_payout, resolved_at = now() WHERE id = v_bet.id;
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

-- ── settle_cup_winner (was 009) ──────────────────────────────────────────────
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

  UPDATE public.bets SET status = 'lost', resolved_at = now()
    WHERE kind = 'cup_winner' AND status = 'pending' AND pick != p_winning_team_code;

  FOR v_bet IN
    SELECT id, user_id, amount FROM public.bets
      WHERE kind = 'cup_winner' AND status = 'pending' AND pick = p_winning_team_code
  LOOP
    v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool)::integer;
    UPDATE public.bets SET status = 'won', payout = v_payout, resolved_at = now() WHERE id = v_bet.id;
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

-- Preserve the settle-RPC lockdown from migration 022 (CREATE OR REPLACE keeps
-- existing grants, but re-assert to be safe).
REVOKE ALL ON FUNCTION public.settle_goalscorer(text, text[]) FROM public;
REVOKE ALL ON FUNCTION public.settle_cup_winner(text) FROM public;
GRANT EXECUTE ON FUNCTION public.settle_goalscorer(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_cup_winner(text) TO service_role;
