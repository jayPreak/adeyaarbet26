# AdeYaar 26 — Architecture & Current State

## Overview
Friend-group parimutuel betting app for FIFA World Cup 2026.
Stack: Next.js 15 (Vercel) + Supabase (Postgres + Storage). No standalone backend.

## Financial Model (UPDATED 2026-06-11)

### No Wallet / No Balance Check
- **STARTING_BALANCE removed** — users can bet any amount up to MAX_BET (₹10,000)
- No balance check in PG `place_bet` function (intentionally removed)
- No "Add Funds" / topup UI
- `computeBalance(bets)` = net P&L = -SUM(amount WHERE !cancelled) + SUM(payout WHERE won)
- Header shows net P&L via `fmtNet()` (shows +₹X or -₹X)
- Settlement at tournament end uses the same ledger

### Bet Lifecycle
```
pending → won (with payout)
pending → lost (payout = null)
pending → cancelled (refunded)
```

### Payout Formula (Parimutuel)
```
payout = FLOOR(stake / winning_pool * total_pool)
```

## DB Schema (prod)

### Tables
- `bets` — id, user_id, match_id, pick, amount, status, created_at, payout, **kind** (default 'match')
- `profiles` — id, username, display_name, avatar_url
- `match_schedule` — id, kickoff_ts
- `activity` — id, user_id, type, payload (jsonb), created_at, profiles(fk)
- `settlements` — settlement records

### Key PG Functions
- `place_bet(p_user_id, p_match_id, p_pick, p_amount)` — no balance check, has MAX_BET cap + kickoff cutoff
- `cancel_bets(p_user_id, p_match_id)` — cancels pending bets
- `place_cup_winner_bet(p_user_id, p_team_code, p_amount)` — auto-cancels previous pick
- `cancel_cup_winner_bet(p_user_id)` — cancels cup winner bet
- `settle_cup_winner(winning_team)` — resolves cup winner pool
- `bet_max()` — returns 10000
- `cup_winner_deadline()` — MIN(kickoff_ts) - 30s

### Junk Tables (ignore)
- `toilets`, `toilet_amenities`, `reviews`, `spatial_ref_sys` — from another project, harmless

## Features

### Match Betting (5 tabs: Home, Match Bets, Special Bets, Leaders, Account)
- Pick home/away/draw per match
- Parimutuel pool per match
- Cancel/switch sides
- Pool visualization with all bettors shown on HeroMatch

### Special Bets (new system)
- Registry-driven: `lib/specials.js` defines each special bet
- Currently: **Cup Winner** (pick team to win WC)
- DB: `kind='cup_winner'`, `match_id='CUP_WINNER'`
- Specials tab shows pool cards with accordion per team showing bettors + potential payouts
- Extensible: add new entry to SPECIALS array + PG settlement function
- CupWinnerBetModal opens from Specials tab

### Activity Feed
- `activity` table stores bet_placed, bet_cancelled, bet_won events
- Payload for cup winner uses `team` field (not `pick`) for team code
- `match_id='CUP_WINNER'` → formatted as "Cup Winner" label

### Leaderboard
- Shows P&L ranking (net = payouts - stakes for resolved bets)
- Podium for top 3
- Settlement plan below (who pays whom)
- Currently everyone negative since no matches resolved yet

### Schedule Integration
- `/api/schedule` returns `{schedule: {matchId: kickoffTs}, cupWinnerDeadlineTs}`
- Used for countdown on HeroMatch and betting cutoffs
- `match.kickoffTs` stamped onto matches in AdeYaarApp

## File Layout (key files)

### Lib
- `lib/ledger.js` — `computeBalance()` only (no wallet/starting balance)
- `lib/currency.js` — CURRENCY_SYMBOL, MAX_BET, fmtMoney, fmtNet
- `lib/specials.js` — SPECIALS registry, getSpecial(), isSpecialBet()
- `lib/cup-winner.js` — CUP_WINNER_DEADLINE_TS, cupWinnerDeadlineFromKickoffs()
- `lib/countdown.js` — KICKOFF_TS, pad(), computeTimeLeft()
- `lib/data.js` — MATCHES, TEAM, getMatch(), getTeam()

### Components
- `components/AdeYaarApp.jsx` — main app shell, all state, tab routing
- `components/index.jsx` — shared: AppHeader, TabBar, PlaceBetSheet, BetCard, HeroMatch, etc.
- `components/screens/HomeScreen.jsx` — hero + activity
- `components/screens/FixturesScreen.jsx` — all matches list
- `components/screens/SpecialsScreen.jsx` — specials tab with accordion pool view
- `components/screens/LeaderboardScreen.jsx` — rankings + settlement
- `components/screens/BetsScreen.jsx` — account + my bets
- `components/CupWinnerBetModal.jsx` — modal to place/change cup winner bet

### API Routes
- `/api/bets` — GET (list) + POST (place via RPC)
- `/api/bets/cancel` — POST cancel
- `/api/cup-winner-bet` — GET (pool+picks) + POST (place) + DELETE (cancel)
- `/api/schedule` — GET schedule + deadline
- `/api/pool` — GET all pools
- `/api/leaderboard` — GET rankings
- `/api/settlement` — GET dual views (resolved + withPending)
- `/api/activity` — GET activity feed
- `/api/topup` — DEPRECATED (exists but UI removed)

## Deploy
- Push to the deploy remote (`jayPreak/adeyaarbet26`) for Vercel auto-deploy
- DB access: `SUPABASE_DB_PASSWORD='<from-1password>' npx supabase db query --linked "SQL"` (from supabase/ dir)
- Project ref / anon key / DB password: pull from Vercel env vars or your local `.env.local`.
  Never commit real credentials to this file — see `.env.example` for the shape.

## .env.local (for local dev pointing at prod)
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Pending Work / Known Issues
1. **Leaderboard boring** — everyone shows negative since no matches resolved. Need to make it engaging (total staked, biggest bettor, etc.)
2. **Pick buttons in PlaceBetSheet** — text color may appear dark on some devices (CSS fix added for `.sheet .odds-btn__label`)
3. **HeroMatch countdown** — added but needs `kickoffTs` from schedule (wired via AdeYaarApp)
4. **Middleware timeout** — added 3s timeout on `getUser()` to prevent dev server hanging
5. **CupWinnerBetModal dark mode** — wrapped in `data-theme` div + explicit `color: #F2F3F5`
6. **Activity "undefined"** — fixed: cup winner activity uses `payload.team` not `payload.pick`

## Critical Notes for Future Sessions
- `.env.local` currently points at PROD — don't commit it, it's in .gitignore
- Topup API route still exists but UI is removed — harmless dead code
- `BetCard` component handles both match bets and special bets (checks `bet.kind`)
- The `match_schedule` table on prod has all group stage kickoff times populated
- Friends' migrations 009-011 are on prod and CORRECT (removed balance check = what we want)
