-- 036: Un-pin qf_deadline(). Migration 033 hardcoded it to
-- 2026-07-09T19:30:00Z back when the knockout schedule wasn't final. The
-- real first QF (QF-1) kicks off 2026-07-09 20:00:00Z, so the pin closed
-- Final Four / Total Goals / KO Cup Winner betting 30 minutes early.
--
-- Revert to deriving the deadline from the live schedule so it always equals
-- the actual first quarterfinal kickoff (betting closes at match start).
CREATE OR REPLACE FUNCTION public.qf_deadline()
RETURNS timestamptz AS $$
  SELECT MIN(kickoff_ts) FROM public.match_schedule WHERE id LIKE 'QF-%';
$$ LANGUAGE sql STABLE;
