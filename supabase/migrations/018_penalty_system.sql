-- 018: Match participation penalty system.
--
-- Rule: when 5+ of the 8 users bet on a match, every user who did NOT bet is
-- penalised ₹50. The penalty amount is added to the match pool as a pending bet,
-- so it inflates winner payouts. Penalty bets resolve to 'lost' automatically
-- when resolve_match() runs (pick='penalty' never matches the winner side).
--
-- Trigger: apply_all_pending_penalties() is called by auto-resolve on each load.
-- It is idempotent — safe to call many times.

-- ── 1. Extend bets_kind_check to include 'penalty' ──────────────────────────
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check CHECK (
  kind IN ('match', 'cup_winner', 'goalscorer', 'continent',
           'halftime', 'h2h', 'golden_boot', 'penalty')
);

-- ── 2. Extend activity type constraint to include 'penalty_applied' ──────────
ALTER TABLE public.activity DROP CONSTRAINT IF EXISTS activity_type_check;
ALTER TABLE public.activity ADD CONSTRAINT activity_type_check CHECK (
  type IN ('bet_placed', 'bet_won', 'bet_lost', 'bet_cancelled',
           'joined', 'penalty_applied')
);

-- ── 3. Per-match penalty application ─────────────────────────────────────────
-- Inserts a 'pending' penalty bet (pick='penalty', amount=50) for each user
-- who has not bet on the match. Idempotent: skips users who already have a
-- penalty or a real bet on this match.
CREATE OR REPLACE FUNCTION public.apply_match_penalties(p_match_id text)
RETURNS json AS $$
DECLARE
  v_bettor_count  integer;
  v_penalty_count integer := 0;
  v_user_id       uuid;
BEGIN
  -- Count distinct users with an active (non-cancelled) match bet
  SELECT COUNT(DISTINCT user_id) INTO v_bettor_count
    FROM public.bets
    WHERE match_id = p_match_id
      AND kind     = 'match'
      AND status  != 'cancelled';

  -- Only penalise if threshold met
  IF v_bettor_count < 5 THEN
    RETURN json_build_object('penalized', 0, 'reason', 'fewer_than_5_bettors');
  END IF;

  -- Penalise every profile user who has neither a real bet nor an existing
  -- penalty on this match (guards against double-application)
  FOR v_user_id IN
    SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.bets b
      WHERE b.user_id   = p.id
        AND b.match_id  = p_match_id
        AND b.kind     IN ('match', 'penalty')
        AND b.status   != 'cancelled'
    )
  LOOP
    -- Pending so resolve_match() naturally includes it in the pool and marks
    -- it 'lost' (pick='penalty' never equals the winning side)
    INSERT INTO public.bets (user_id, match_id, pick, amount, kind)
      VALUES (v_user_id, p_match_id, 'penalty', 50, 'penalty');

    INSERT INTO public.activity (user_id, type, payload)
      VALUES (v_user_id, 'penalty_applied', jsonb_build_object(
        'match_id', p_match_id,
        'amount',   50
      ));

    v_penalty_count := v_penalty_count + 1;
  END LOOP;

  RETURN json_build_object(
    'penalized',     v_penalty_count,
    'bettor_count',  v_bettor_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Bulk sweep — apply penalties for all newly-closed matches ──────────────
-- Finds matches where:
--   • betting window just closed (kickoff - 30s <= now)
--   • no penalty bets exist yet  (first run only, idempotent)
--   • 5+ users have bet
-- Calls apply_match_penalties for each qualifying match.
CREATE OR REPLACE FUNCTION public.apply_all_pending_penalties()
RETURNS json AS $$
DECLARE
  v_match_id          text;
  v_result            json;
  v_total_penalized   integer := 0;
  v_matches_processed integer := 0;
BEGIN
  FOR v_match_id IN
    SELECT ms.id
      FROM public.match_schedule ms
     WHERE ms.kickoff_ts IS NOT NULL
       -- betting window has closed
       AND ms.kickoff_ts - interval '30 seconds' <= now()
       -- no penalties applied yet for this match
       AND NOT EXISTS (
             SELECT 1 FROM public.bets b
              WHERE b.match_id = ms.id AND b.kind = 'penalty'
           )
       -- at least 5 users have bet
       AND (
             SELECT COUNT(DISTINCT user_id)
               FROM public.bets b2
              WHERE b2.match_id = ms.id
                AND b2.kind     = 'match'
                AND b2.status  != 'cancelled'
           ) >= 5
  LOOP
    SELECT public.apply_match_penalties(v_match_id) INTO v_result;
    v_total_penalized   := v_total_penalized   + COALESCE((v_result->>'penalized')::integer, 0);
    v_matches_processed := v_matches_processed + 1;
  END LOOP;

  RETURN json_build_object(
    'matches_processed', v_matches_processed,
    'total_penalized',   v_total_penalized
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
