-- 039: Make settle_challenges fail loud on bet-vs-challenge inconsistency.
--
-- Before: if a challenger/opponent bet was cancelled while the challenge was still
-- 'accepted' (e.g. via the cancel_bets bug fixed in 037, or any future path that
-- forgets to guard by kind), settle_challenges would silently no-op on the bet
-- UPDATE and still flip the challenge to 'settled'. Result: bets/challenges disagree.
--
-- After: settle_challenges verifies bet updates matched the expected row count. If a
-- winner or loser bet isn't 'pending' when settlement fires, the whole batch aborts.
-- This is safer than silent corruption — auto-resolve will surface the error and
-- we'll manually reconcile.

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
  v_rowcount    integer;
BEGIN
  FOR v_ch IN
    SELECT * FROM public.challenges
      WHERE match_id = p_match_id AND status IN ('open', 'accepted')
      FOR UPDATE
  LOOP
    IF v_ch.status = 'open' THEN
      -- Never accepted: refund the challenger (challenger_bet must still be pending)
      UPDATE public.bets SET status = 'cancelled'
        WHERE id = v_ch.challenger_bet_id AND status = 'pending';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount <> 1 THEN
        RAISE EXCEPTION 'settle_challenges: expected 1 pending challenger bet (%) for open duel %, got %',
          v_ch.challenger_bet_id, v_ch.id, v_rowcount;
      END IF;
      UPDATE public.challenges SET status = 'expired', resolved_at = now() WHERE id = v_ch.id;
      v_expired := v_expired + 1;

    ELSIF p_winner NOT IN ('home', 'away') THEN
      -- Draw: void the duel, refund both sides
      UPDATE public.bets SET status = 'cancelled'
        WHERE id = v_ch.challenger_bet_id AND status = 'pending';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount <> 1 THEN
        RAISE EXCEPTION 'settle_challenges: expected 1 pending challenger bet (%) for void duel %, got %',
          v_ch.challenger_bet_id, v_ch.id, v_rowcount;
      END IF;
      UPDATE public.bets SET status = 'cancelled'
        WHERE id = v_ch.opponent_bet_id AND status = 'pending';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount <> 1 THEN
        RAISE EXCEPTION 'settle_challenges: expected 1 pending opponent bet (%) for void duel %, got %',
          v_ch.opponent_bet_id, v_ch.id, v_rowcount;
      END IF;
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
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount <> 1 THEN
        RAISE EXCEPTION 'settle_challenges: winner bet (%) for duel % is not pending (%) — inconsistency, aborting',
          v_winner_bet, v_ch.id, v_rowcount;
      END IF;

      UPDATE public.bets SET status = 'lost', resolved_at = now()
        WHERE id = v_loser_bet AND status = 'pending';
      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      IF v_rowcount <> 1 THEN
        RAISE EXCEPTION 'settle_challenges: loser bet (%) for duel % is not pending (%) — inconsistency, aborting',
          v_loser_bet, v_ch.id, v_rowcount;
      END IF;

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
