-- Extend bets_kind_check to include h2h and golden_boot
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check
  CHECK (kind IN ('match', 'cup_winner', 'goalscorer', 'continent', 'halftime', 'h2h', 'golden_boot'));
