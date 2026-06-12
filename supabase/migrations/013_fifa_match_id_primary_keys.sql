-- 013: Use FIFA IdMatch as the primary key for match_schedule
-- Replaces group-position labels (A1, B2, …) with FIFA's stable numeric match IDs.
-- This lets the app handle knockout matches without any manual ID mapping.
--
-- Because bets.match_id and match_players.match_id are plain text columns with
-- no FK constraints, we can update them with a simple mapping table — no FK
-- drop/recreate needed.
--
-- After this migration:
--   match_schedule.id  = FIFA IdMatch string, e.g. '400021443'
--   match_schedule.group_label = old display label, e.g. 'A1'  (kept for UI)
--   bets.match_id      = updated to FIFA IdMatch for all group-stage match bets
--   match_players.match_id = updated to FIFA IdMatch

-- ──────────────────────────────────────────────────────────────────
-- 1. Add group_label column to preserve the old A1/B2 display values
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.match_schedule
  ADD COLUMN IF NOT EXISTS group_label text;

-- Populate from current id before we change it
UPDATE public.match_schedule
SET group_label = id
WHERE group_label IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. Build a temporary mapping table (old_id → new_id)
-- ──────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _id_map (old_id text PRIMARY KEY, new_id text NOT NULL);

INSERT INTO _id_map (old_id, new_id) VALUES
  ('A1','400021443'),('A2','400021441'),('A3','400021440'),
  ('A4','400021442'),('A5','400021444'),('A6','400021445'),
  ('B1','400021449'),('B2','400021447'),('B3','400021446'),
  ('B4','400021450'),('B5','400021451'),('B6','400021448'),
  ('C1','400021453'),('C2','400021456'),('C3','400021457'),
  ('C4','400021454'),('C5','400021455'),('C6','400021452'),
  ('D1','400021458'),('D2','400021463'),('D3','400021462'),
  ('D4','400021460'),('D5','400021459'),('D6','400021461'),
  ('E1','400021464'),('E2','400021467'),('E3','400021469'),
  ('E4','400021465'),('E5','400021468'),('E6','400021466'),
  ('F1','400021474'),('F2','400021470'),('F3','400021472'),
  ('F4','400021475'),('F5','400021471'),('F6','400021473'),
  ('G1','400021478'),('G2','400021476'),('G3','400021477'),
  ('G4','400021480'),('G5','400021479'),('G6','400021481'),
  ('H1','400021482'),('H2','400021486'),('H3','400021483'),
  ('H4','400021487'),('H5','400021485'),('H6','400021484'),
  ('I1','400021490'),('I2','400021488'),('I3','400021492'),
  ('I4','400021491'),('I5','400021489'),('I6','400021493'),
  ('J1','400021496'),('J2','400021498'),('J3','400021494'),
  ('J4','400021499'),('J5','400021497'),('J6','400021495'),
  ('K1','400021504'),('K2','400021502'),('K3','400021501'),
  ('K4','400021503'),('K5','400021505'),('K6','400021500'),
  ('L1','400021507'),('L2','400021510'),('L3','400021506'),
  ('L4','400021511'),('L5','400021508'),('L6','400021509');

-- ──────────────────────────────────────────────────────────────────
-- 3. Update bets.match_id for all group-stage match bets
--    (special bets like CUP_WINNER, HT_SHAKIRA etc. are untouched)
-- ──────────────────────────────────────────────────────────────────
UPDATE public.bets b
SET match_id = m.new_id
FROM _id_map m
WHERE b.match_id = m.old_id;

-- ──────────────────────────────────────────────────────────────────
-- 4. Update match_players.match_id
-- ──────────────────────────────────────────────────────────────────
UPDATE public.match_players p
SET match_id = m.new_id
FROM _id_map m
WHERE p.match_id = m.old_id;

-- ──────────────────────────────────────────────────────────────────
-- 5. Update match_schedule.id (PK) — must go last since bets/players
--    have no FK constraints so order doesn't technically matter,
--    but it's cleaner to do data rows before the PK change.
-- ──────────────────────────────────────────────────────────────────
UPDATE public.match_schedule ms
SET id = m.new_id
FROM _id_map m
WHERE ms.id = m.old_id;

-- ──────────────────────────────────────────────────────────────────
-- 6. Also update fifa_id_match to match the new id (now redundant,
--    but keep in sync so old code that reads it still works during rollout)
-- ──────────────────────────────────────────────────────────────────
UPDATE public.match_schedule
SET fifa_id_match = id
WHERE fifa_id_match IS DISTINCT FROM id;

DROP TABLE _id_map;
