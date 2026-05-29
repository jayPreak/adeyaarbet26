-- Settlements: real-money payments between friends.
-- Settlements are independent of the betting ledger — they record
-- "I paid X to Y" without changing betting balance or leaderboard.

CREATE TABLE IF NOT EXISTS public.settlements (
  id bigserial PRIMARY KEY,
  from_user uuid NOT NULL REFERENCES public.profiles(id),
  to_user uuid NOT NULL REFERENCES public.profiles(id),
  amount integer NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_settle CHECK (from_user != to_user)
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settlements visible to participants" ON public.settlements;
CREATE POLICY "Settlements visible to participants"
  ON public.settlements FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can record settlements they're part of" ON public.settlements;
CREATE POLICY "Users can record settlements they're part of"
  ON public.settlements FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- Anon policies for local dev
DROP POLICY IF EXISTS "anon_settlements_select" ON public.settlements;
CREATE POLICY "anon_settlements_select" ON public.settlements FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_settlements_insert" ON public.settlements;
CREATE POLICY "anon_settlements_insert" ON public.settlements FOR INSERT TO anon WITH CHECK (true);
