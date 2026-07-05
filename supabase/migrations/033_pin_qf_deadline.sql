-- 033: Pin Final Four / Total Goals deadline to a fixed date instead of
-- deriving it from the first QF kickoff (schedule wasn't finalized yet).
-- Ends Fri 10 Jul 2026, 1:00 AM IST = 2026-07-09T19:30:00Z.

CREATE OR REPLACE FUNCTION public.qf_deadline()
RETURNS timestamptz AS $$
  SELECT '2026-07-09T19:30:00Z'::timestamptz;
$$ LANGUAGE sql STABLE;
