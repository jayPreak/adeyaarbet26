-- 013: Migrate match_schedule PK from group labels (A1, B2…) to FIFA IdMatch
-- Rationale: enables knockout stage support — knockout matches have FIFA IDs
-- but no group-position label. After this migration, match_schedule.id IS
-- the FIFA IdMatch string (e.g. '400021443').
--
-- Impact:
--   • match_schedule.id:       A1 → 400021443 (etc.)
--   • bets.match_id:           same migration (no FK — plain text column)
--   • match_players.match_id:  same migration (no FK — part of composite PK)
--   • activity.payload.match_id: migrated in-place (JSONB update)
--   • group_label column added to match_schedule for display (A1, B2, …)
--   • fifa_id_match column dropped (id IS now the FIFA match id)
--   • fifa_id_stage kept (needed for live endpoint URL construction)

-- ── 1. Add group_label column; populate from current id values ──────────────
ALTER TABLE public.match_schedule
  ADD COLUMN IF NOT EXISTS group_label text;

UPDATE public.match_schedule
  SET group_label = id
  WHERE group_label IS NULL;

-- ── 2. Migrate bets.match_id ─────────────────────────────────────────────────
-- Only rows where match_id matches a match_schedule.id (group stage matches).
-- CUP_WINNER / _topup / halftime / continent bets are unaffected.
UPDATE public.bets b
  SET match_id = ms.fifa_id_match
  FROM public.match_schedule ms
  WHERE b.match_id = ms.id
    AND ms.fifa_id_match IS NOT NULL;

-- ── 3. Migrate match_players.match_id ────────────────────────────────────────
-- match_players has a composite PK (match_id, player_id) but no FK constraint,
-- so a direct UPDATE is safe; new values don't collide with existing ones.
UPDATE public.match_players mp
  SET match_id = ms.fifa_id_match
  FROM public.match_schedule ms
  WHERE mp.match_id = ms.id
    AND ms.fifa_id_match IS NOT NULL;

-- ── 4. Migrate activity.payload.match_id ─────────────────────────────────────
-- Activity payloads embed match_id as a JSONB string; update only those
-- entries whose match_id corresponds to a group-stage match.
UPDATE public.activity
  SET payload = jsonb_set(payload, '{match_id}', to_jsonb(ms.fifa_id_match))
  FROM public.match_schedule ms
  WHERE (payload->>'match_id') = ms.id
    AND ms.fifa_id_match IS NOT NULL
    AND payload ? 'match_id';

-- ── 5. Update match_schedule.id (PK) to FIFA IdMatch ─────────────────────────
-- Old IDs are letter+number (A1–L6); new IDs are 9-digit numeric strings —
-- no overlap, so the PK UPDATE is collision-free even without deferral.
UPDATE public.match_schedule
  SET id = fifa_id_match
  WHERE fifa_id_match IS NOT NULL;

-- ── 6. Drop the now-redundant fifa_id_match column ───────────────────────────
-- The id column IS the FIFA match id; keeping both would be redundant.
-- fifa_id_stage is retained — it is still needed for the live endpoint URL.
ALTER TABLE public.match_schedule
  DROP COLUMN IF EXISTS fifa_id_match;
