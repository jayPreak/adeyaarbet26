-- 019: Guard apply_all_pending_penalties to only affect unsettled matches.
--
-- Without this, the sweep would retroactively penalise users on all past matches
-- that had 5+ bettors. The fix: only process matches that still have pending
-- match bets (i.e. the match has not yet been resolved by resolve_match).
-- Already-settled matches have status='won'/'lost' on all bets, so no pending
-- match bets exist and the sweep skips them entirely.

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
       -- match is not yet resolved — pending match bets still exist
       -- (resolved matches have won/lost bets, not pending ones)
       AND EXISTS (
             SELECT 1 FROM public.bets b
              WHERE b.match_id = ms.id
                AND b.kind     = 'match'
                AND b.status   = 'pending'
           )
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
