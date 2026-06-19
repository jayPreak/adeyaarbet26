-- 023: Add resolved_at column to bets table.
--
-- The resolve_match RPC (introduced in 016, updated in 021) sets
-- resolved_at = now() when marking bets won/lost. The column was
-- referenced in RPC code but never added to the table, causing
-- every resolve_match call to error and roll back — matches never
-- settling even when FIFA correctly reports them as finished.

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
