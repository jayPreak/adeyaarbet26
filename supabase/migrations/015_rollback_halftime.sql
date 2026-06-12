-- Rollback halftime show special bet data.
-- All halftime bets were already cancelled on prod; this cleans up the rows
-- and removes halftime-related activity entries.

-- Delete all halftime bets (all should already be status='cancelled')
DELETE FROM public.bets WHERE kind = 'halftime';

-- Remove halftime-related activity entries
DELETE FROM public.activity
  WHERE (payload->>'kind') = 'halftime'
     OR (payload->>'match_id') LIKE 'HT_%';

-- Note: we keep 'halftime' in the bets_kind_check constraint since the
-- constraint is being extended anyway in migration 014. No harm leaving it.
