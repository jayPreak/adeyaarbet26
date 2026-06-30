-- Add r32_loser and r32_winner to bets_kind_check
ALTER TABLE public.bets DROP CONSTRAINT IF EXISTS bets_kind_check;
ALTER TABLE public.bets ADD CONSTRAINT bets_kind_check CHECK (
  kind IN (
    'match', 'cup_winner', 'goalscorer', 'continent',
    'halftime', 'h2h', 'golden_boot', 'penalty',
    'third_place_qualifiers', 'r32_loser', 'r32_winner'
  )
);
