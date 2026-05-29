# AdeYaar 26

A FIFA World Cup 2026 social betting app — pick winners, place virtual bets on matches and the cup winner, and climb the leaderboard with friends.

Built with Next.js 15, React 18, and Supabase.

## Features

- **Match betting** — Bet on any of the 72 World Cup matches with a 30-second pre-kickoff cutoff.
- **Cup winner bet** — Long-running market for predicting the tournament champion.
- **Live leaderboard** — Track balances, P/L, and standings across friends.
- **Mobile + desktop layouts** — Native-feeling mobile UI with a parallel desktop experience.
- **Countdown splash** — Pre-launch gate that opens at kickoff.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 18
- **Database / Auth**: Supabase (Postgres + RLS + SSR auth)
- **Testing**: Jest (unit) + Playwright (E2E)
- **Styling**: CSS modules / globals

## Getting Started

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

### Environment

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Database

Migrations live in `supabase/migrations/`. Apply with:

```bash
SUPABASE_DB_PASSWORD='...' supabase db push
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright UI mode |

## Project Structure

```
app/                Next.js App Router (routes + API)
  api/              Server route handlers (bets, cup-winner-bet, settlements)
  auth/, login/     Auth flows
components/         React components
  desktop/          Desktop-specific layouts
  screens/          Mobile screen components
lib/                Domain logic (bet-store, ledger, settlement, supabase clients)
supabase/migrations Postgres schema + RLS policies
docs/               Feature specs
__tests__/, e2e/    Unit and E2E tests
```

## Documentation

- [`PLAN.md`](./PLAN.md) — Feature roadmap, engineering rules, and progress log.
- [`QA_TEST_PLAN.md`](./QA_TEST_PLAN.md) — QA test plan.
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — Feature design specs.

## License

Private project.
