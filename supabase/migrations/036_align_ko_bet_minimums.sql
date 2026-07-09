-- 036: Align knockout stage minimum bets with the client (lib/currency.js).
-- The server bet_min() had drifted from the UI's getMinBet(): QF/SF were lower on
-- the server, and 3RD was higher (500) than the UI allowed — so a 3rd-place bet the
-- UI permitted got rejected server-side with "Bet below minimum".
-- Final stage minimums (server == client): R32 50, R16 100, QF 250, SF 350, FIN 500, 3RD 400.

CREATE OR REPLACE FUNCTION public.bet_min(p_match_id text) RETURNS integer AS $$
  SELECT CASE
    WHEN p_match_id LIKE 'R32-%' THEN 50
    WHEN p_match_id LIKE 'R16-%' THEN 100
    WHEN p_match_id LIKE 'QF-%'  THEN 250
    WHEN p_match_id LIKE 'SF-%'  THEN 350
    WHEN p_match_id LIKE 'FIN-%' THEN 500
    WHEN p_match_id LIKE '3RD-%' THEN 400
    ELSE 50
  END
$$ LANGUAGE sql IMMUTABLE;
