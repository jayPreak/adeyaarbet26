-- 026: Update stage-based minimum bets.
-- R32: 50, R16: 100, QF: 200, SF: 300, FIN/3RD: 500

CREATE OR REPLACE FUNCTION public.bet_min(p_match_id text) RETURNS integer AS $$
  SELECT CASE
    WHEN p_match_id LIKE 'R32-%' THEN 50
    WHEN p_match_id LIKE 'R16-%' THEN 100
    WHEN p_match_id LIKE 'QF-%'  THEN 200
    WHEN p_match_id LIKE 'SF-%'  THEN 300
    WHEN p_match_id LIKE 'FIN-%' THEN 500
    WHEN p_match_id LIKE '3RD-%' THEN 500
    ELSE 50
  END
$$ LANGUAGE sql IMMUTABLE;
