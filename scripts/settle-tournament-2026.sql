-- Final tournament settlement — FIFA World Cup 2026
-- Generated 2026-07-20. Run these against the PROD Supabase DB (e.g. via
-- `npx supabase db query --linked` from a machine that has network access to
-- Supabase, or the Supabase SQL editor). These call the existing settlement
-- RPCs — do NOT UPDATE the `bets` table directly (see CLAUDE.md invariant #2).
--
-- IMPORTANT: I (Claude) could not run these myself — this sandbox's network
-- allowlist blocks *.supabase.co, so I have no way to read the current bets
-- table or execute these RPCs. Everything below is prepared from public,
-- real-world World Cup results, but has NOT been checked against what's
-- actually pending in the `bets` table. Sanity-check pending rows before
-- running each statement (queries provided above each RPC call).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CUP WINNER — Spain won 1-0 (AET) over Argentina in the Final
--    (Ferran Torres, 106'). Source: FIFA match centre, match 400021543.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM bets WHERE match_id = 'CUP_WINNER' AND status = 'pending';
SELECT public.settle_cup_winner('ESP');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. WINNING CONTINENT — Spain = UEFA (Europe)
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM bets WHERE match_id = 'CONTINENT' AND status = 'pending';
SELECT public.settle_special('CONTINENT', 'continent', 'UEFA');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. MESSI v RONALDO GOALS — Messi scored 8 goals for Argentina (reached
--    the Final), Ronaldo scored 3 for Portugal (eliminated earlier).
--    Messi wins outright on goals — no tiebreaker rules needed.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM bets WHERE match_id = 'MESSI_V_RONALDO' AND status = 'pending';
SELECT public.settle_special('MESSI_V_RONALDO', 'h2h', 'messi');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. GOLDEN BOOT — Kylian Mbappé won with 10 goals (Messi 2nd w/ 8).
--    ⚠️ CAUTION: `lib/specials.js` has NO 'golden_boot' entry in SPECIALS[],
--    and GoldenBootBetModal.jsx is never imported/rendered anywhere in the
--    app (dead code, like AdeYaarApp.jsx — see CLAUDE.md #11). So there is
--    probably NO way anyone placed a golden_boot bet through the UI. But
--    check first — if rows exist, `pick` is very likely NOT the string
--    'mbappe' (no options[] ever defined it), so find out what value was
--    actually stored before calling settle_special, or you'll refund
--    everyone by accident (settle_special refunds all if nobody's `pick`
--    matches the winner).
-- ─────────────────────────────────────────────────────────────────────────
SELECT pick, count(*), sum(amount) FROM bets
  WHERE match_id = 'GOLDEN_BOOT' AND status = 'pending' GROUP BY pick;
-- Once you know the real `pick` value used for Mbappé, run:
-- SELECT public.settle_special('GOLDEN_BOOT', 'golden_boot', '<exact pick value>');

-- ─────────────────────────────────────────────────────────────────────────
-- 5. FINAL FOUR — Semifinalists were Spain, Argentina, France, England.
--    (Confirmed against migrations/032_props_duels_final_four.sql:
--    settle_final_four(p_semifinalists text[]) — highest correct-pick count
--    splits the pool.)
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM bets WHERE match_id = 'FINAL_FOUR' AND status = 'pending';
SELECT public.settle_final_four(ARRAY['ESP','ARG','FRA','ENG']);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. TOTAL GOALS O/U 299.5 — ⚠️ UNRESOLVED. Public sources gave inconsistent
--    running totals (one report: 294 goals through 101 matches; another
--    referenced 175/177 goals at an earlier point). I could not find a
--    single authoritative FINAL total-goals-across-all-104-matches figure.
--    DO NOT settle this from a guess — real money is on it. Get the exact
--    final count from https://www.fifa.com/.../statistics (or add up all
--    104 `match_schedule`/FIFA final scores from your own DB, which is the
--    same method `lib/props.js` total-goals settlement logic already uses)
--    before running:
-- SELECT public.settle_special('TOTAL_GOALS', 'total_goals', 'over');  -- or 'under'

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Match-level bets (group stage, R32, R16, QF, SF, 3rd place, Final) are
--    auto-settled by /api/auto-resolve via the FIFA API — these are very
--    likely already resolved if that route ran normally throughout the
--    tournament. Spot-check a few, e.g.:
-- SELECT match_id, status, count(*) FROM bets
--   WHERE kind IN ('match','penalty','scoreline','over_under','pens')
--   GROUP BY match_id, status ORDER BY match_id;
-- Anything still 'pending' on a finished match_id needs manual investigation
-- (auto-resolve may not have run — check Vercel logs / SUPABASE_SERVICE_ROLE_KEY,
-- see CLAUDE.md failure mode #10).

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Duels (challenges) — settle_challenges(match_id, winner) per finished
--    match. Only needed for any FIN-1/3RD-1/SF duels not already settled by
--    auto-resolve.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT * FROM challenges WHERE status = 'accepted';

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Real-money settlement (settlements table) — this is a human decision
--    (who actually pays whom, and confirming it happened), not something to
--    automate. Use GET /api/settlement (now also surfaced on the Home tab)
--    to see the final "who owes whom" plan once everything above is settled.
-- ─────────────────────────────────────────────────────────────────────────
