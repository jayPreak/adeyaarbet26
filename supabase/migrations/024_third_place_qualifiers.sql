-- 024: Third-place qualifier prediction bet.
--
-- Players pick exactly 8 of the 12 third-place teams they believe will
-- advance to the Round of 32. All 8 must be correct to win. If nobody
-- gets all 8 right everyone loses (no refund).
-- Deadline: 2026-06-26T18:59:00Z (12:29 AM IST June 27).
-- Settles: when Jordan vs Argentina (J6, last group game) resolves.

-- ── 1. Extend bets_kind_check ─────────────────────────────────────────────────
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check CHECK (
  kind IN (
    'match', 'cup_winner', 'goalscorer', 'continent',
    'halftime', 'h2h', 'golden_boot', 'penalty',
    'third_place_qualifiers'
  )
);

-- ── 2. settle_third_place_qualifiers ─────────────────────────────────────────
-- p_winning_teams: the 8 team codes that actually qualified (order doesn't matter).
-- Each bet's pick is a comma-joined sorted string of 8 team codes.
-- Winners split the total pool proportionally; losers get status='lost'.
-- If nobody wins everyone gets status='lost' — pool is gone.
CREATE OR REPLACE FUNCTION public.settle_third_place_qualifiers(
  p_winning_teams text[]
)
RETURNS json AS $$
DECLARE
  v_total_pool   integer;
  v_winning_pool integer;
  v_sorted_answer text[];
  v_bet          record;
  v_sorted_pick  text[];
  v_payout       integer;
  v_payouts_made integer := 0;
BEGIN
  PERFORM 1 FROM public.bets
    WHERE match_id = 'THIRD_QUALIFIERS'
      AND kind = 'third_place_qualifiers'
      AND status = 'pending'
    FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_pool
    FROM public.bets
    WHERE match_id = 'THIRD_QUALIFIERS'
      AND kind = 'third_place_qualifiers'
      AND status = 'pending';

  IF v_total_pool = 0 THEN
    RETURN json_build_object('skipped', true, 'reason', 'no_bets');
  END IF;

  -- Pre-sort the answer array once
  SELECT ARRAY(SELECT unnest(p_winning_teams) ORDER BY 1) INTO v_sorted_answer;

  -- Compute the winning pool (bets whose sorted pick equals the sorted answer)
  SELECT COALESCE(SUM(b.amount), 0) INTO v_winning_pool
    FROM public.bets b
    WHERE b.match_id = 'THIRD_QUALIFIERS'
      AND b.kind = 'third_place_qualifiers'
      AND b.status = 'pending'
      AND (SELECT ARRAY(SELECT unnest(string_to_array(b.pick, ',')) ORDER BY 1)) = v_sorted_answer;

  -- Nobody got all 8 right — everyone loses
  IF v_winning_pool = 0 THEN
    UPDATE public.bets SET status = 'lost', resolved_at = now()
      WHERE match_id = 'THIRD_QUALIFIERS'
        AND kind = 'third_place_qualifiers'
        AND status = 'pending';
    RETURN json_build_object(
      'no_winners', true,
      'pool', v_total_pool,
      'winning_teams', p_winning_teams
    );
  END IF;

  -- Mark losers first
  FOR v_bet IN
    SELECT id, pick FROM public.bets
      WHERE match_id = 'THIRD_QUALIFIERS'
        AND kind = 'third_place_qualifiers'
        AND status = 'pending'
  LOOP
    v_sorted_pick := (SELECT ARRAY(SELECT unnest(string_to_array(v_bet.pick, ',')) ORDER BY 1));
    IF v_sorted_pick != v_sorted_answer THEN
      UPDATE public.bets SET status = 'lost', resolved_at = now() WHERE id = v_bet.id;
    END IF;
  END LOOP;

  -- Pay winners proportionally
  FOR v_bet IN
    SELECT id, user_id, amount, pick FROM public.bets
      WHERE match_id = 'THIRD_QUALIFIERS'
        AND kind = 'third_place_qualifiers'
        AND status = 'pending'
  LOOP
    v_payout := FLOOR(v_bet.amount::numeric / v_winning_pool * v_total_pool)::integer;
    UPDATE public.bets
      SET status = 'won', payout = v_payout, resolved_at = now()
      WHERE id = v_bet.id;
    v_payouts_made := v_payouts_made + 1;
    INSERT INTO public.activity (user_id, type, payload) VALUES (
      v_bet.user_id, 'bet_won', jsonb_build_object(
        'match_id', 'THIRD_QUALIFIERS',
        'kind', 'third_place_qualifiers',
        'pick', v_bet.pick,
        'payout', v_payout,
        'bet_id', v_bet.id
      )
    );
  END LOOP;

  RETURN json_build_object(
    'pool', v_total_pool,
    'winning_pool', v_winning_pool,
    'payouts_made', v_payouts_made,
    'winning_teams', p_winning_teams
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role (used by auto-resolve) may call this
REVOKE ALL ON FUNCTION public.settle_third_place_qualifiers(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.settle_third_place_qualifiers(text[]) TO service_role;
