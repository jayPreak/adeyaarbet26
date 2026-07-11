# app/api — API Routes Reference (AI)

Read root `CLAUDE.md` first. Before committing changes here, follow its
Documentation Protocol (CHANGELOG.md + docs/ai/SESSION_LOG.md + this file if stale).

## Rules for this directory
- **Money moves ONLY via Supabase RPCs** (`place_bet`, `place_special_bet`,
  `create_challenge`, `settle_*`, …). Never `insert/update` the `bets` table directly.
- **Any RPC that changes `bets` rows in bulk MUST filter by `kind`.** A
  `WHERE user_id=X AND match_id=Y AND status='pending'` predicate matches every
  kind (match/penalty/challenge/goalscorer/scoreline/…). Duels especially are
  contract bets with a locked opponent and no user-cancel path; sweeping them
  breaks the `challenges` ↔ `bets` invariant. See root CLAUDE.md #6, #20, #21.
  Migration 040 trigger on `challenges` UPDATE catches divergence at commit
  time, but the `kind` filter in the RPC is the first line of defense.
- **No server-side auth** — routes trust `user_id` from params/body (accepted risk).
- Use `supabaseAdmin || supabase` for DB ops; `settle_*` and challenge-settlement RPCs
  are service_role-only and FAIL silently in prod if `SUPABASE_SERVICE_ROLE_KEY` is
  unset on Vercel.
- **Never await the FIFA API on a hot path** — it hangs. Fire-and-forget or
  AbortController timeout only.
- Match IDs in requests/responses are ALWAYS static strings (`A1`…`L6`, `R32_*`,
  knockout IDs) — never FIFA numeric IDs.
- Return `NextResponse.json(data)` or `NextResponse.json({error}, {status})`.

## Route map
| Route | Methods | Purpose |
|-------|---------|---------|
| `bets` | GET/POST | User's bets; place match bet (`place_bet` RPC) |
| `bets/cancel` | POST | Cancel via `cancel_bets` RPC |
| `schedule` | GET | Plain DB read of `match_schedule` (kickoffs, deadlines) |
| `auto-resolve` | GET | Settles finished matches, goalscorer, props, duels via FIFA data |
| `pool` | GET | Pool sizes per match |
| `leaderboard` | GET | Rankings, biggest wins/losses/bettor |
| `cup-winner-bet` | GET/POST/DELETE | Cup winner special |
| `special-bet` | GET/POST/DELETE | Generic specials (continent, h2h, golden_boot, props, final_four, total_goals) |
| `goalscorer-bet` | GET/POST/DELETE | Per-match goalscorer |
| `fifa/matches` | GET | Proxies FIFA live scores |
| `settlement` | GET | Real-money settlement positions |
| `activity` | GET | Friend activity feed |
| `sync-schedule` | POST | Manual FIFA→DB schedule sync (rare) |

(If you add/change a route, update this table.)
