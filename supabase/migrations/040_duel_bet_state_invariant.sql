-- 040: Enforce challenge ↔ bet state invariant at the DB level via trigger.
--
-- Invariant: when a challenge row transitions to a terminal state, the linked bets
-- must be in the matching state:
--   settled  → challenger and opponent bets are {won, lost} in some order
--   void     → both bets are cancelled
--   expired  → challenger bet is cancelled, opponent_bet_id is null
--
-- This is defense-in-depth on top of migration 039's strict guards in
-- settle_challenges. If any future RPC OR direct SQL flips a challenge to a
-- terminal state while the bets say otherwise, this trigger RAISEs and rolls
-- back the transaction — preserving cross-table consistency at commit time.
--
-- Note: we do NOT add a mirror trigger on bets (blocking cancellation of a
-- challenge bet while the challenge is still active) because that would conflict
-- with the natural ordering of cancel_challenge / decline_challenge /
-- accept_challenge / settle_challenges, all of which cancel the bet BEFORE
-- flipping the challenge status. This trigger alone is sufficient: it catches
-- any bet-vs-challenge divergence at the moment the challenge is finalized.

CREATE OR REPLACE FUNCTION public.enforce_challenge_state_matches_bets()
RETURNS trigger AS $$
DECLARE
  v_cb_status text;
  v_ob_status text;
BEGIN
  -- Only care about status transitions
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_cb_status FROM public.bets WHERE id = NEW.challenger_bet_id;
  SELECT status INTO v_ob_status FROM public.bets WHERE id = NEW.opponent_bet_id;

  IF NEW.status = 'settled' THEN
    IF (v_cb_status = 'won' AND v_ob_status = 'lost')
       OR (v_cb_status = 'lost' AND v_ob_status = 'won') THEN
      NULL; -- OK
    ELSE
      RAISE EXCEPTION
        'Cannot mark challenge % as settled: bet states are challenger=%, opponent=% (expected won/lost pair)',
        NEW.id, v_cb_status, v_ob_status;
    END IF;
  ELSIF NEW.status = 'void' THEN
    IF v_cb_status = 'cancelled' AND v_ob_status = 'cancelled' THEN
      NULL;
    ELSE
      RAISE EXCEPTION
        'Cannot mark challenge % as void: bet states are challenger=%, opponent=% (expected both cancelled)',
        NEW.id, v_cb_status, v_ob_status;
    END IF;
  ELSIF NEW.status = 'expired' THEN
    IF v_cb_status = 'cancelled' AND NEW.opponent_bet_id IS NULL THEN
      NULL;
    ELSE
      RAISE EXCEPTION
        'Cannot mark challenge % as expired: challenger_bet=%, opponent_bet_id=% (expected challenger cancelled, no opponent)',
        NEW.id, v_cb_status, NEW.opponent_bet_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_challenge_state_matches_bets ON public.challenges;
CREATE TRIGGER trg_enforce_challenge_state_matches_bets
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_challenge_state_matches_bets();
