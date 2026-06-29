-- Add lineup_status (1=starter, 2=sub) and captain flag to match_players.
-- lineup_status defaults to 1 so rows cached before this migration still appear as starters.
ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS lineup_status integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS captain       boolean DEFAULT false;
