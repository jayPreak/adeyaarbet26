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

## Live Match Stream + Chat (Home page, 2026-07-10)

**Overview.** For live World Cup matches, Home renders two collapsible panels near
the featured/hero card: `LiveStreamPanel` (video) and `LiveChatPanel` (public chat).
Both are **entirely client-side** — no server involvement, no DB rows, no money
touched. If either breaks, no financial impact.

### Data model
- `lib/streams.js` — static, hand-maintained map keyed by our internal match ids
  (`QF-1`, `QF-2`, …). Each entry has:
  - `sources[]` — array of `{label, url}` for stream mirrors (embed URLs).
  - `chatChannel` — the streamed.pk top-level match id used as the WebSocket
    channel name. This is a different id from any single `source.id`.
- `getStreams(matchId)` and `getChatChannel(matchId)` are the only public helpers.
- Refresh recipe is in the file header (curl streamed.pk API, paste URLs).

### 1. The video player (`components/LiveStreamPanel.jsx`)

Explaining this to a backend engineer who has never touched an iframe:

- We are **not** running the stream. streamed.pk (a third-party unofficial PPV
  aggregator) publishes free web pages at URLs like
  `https://embed.st/embed/admin/ppv-france-vs-morocco/1` that already contain
  their own video player, HLS logic, ads, DRM handling — the whole pipeline.
- An `<iframe src="...">` element is essentially the browser's `include()` for
  another origin: our page tells the browser "load that URL in a nested viewport
  and render it there". The nested document runs in its **own origin**
  (`embed.st`), gets its **own JS context**, and cannot read or write anything
  from our page — that isolation is enforced by the browser's Same-Origin Policy,
  not by us. We hand it a rectangle; it does the rest.
- We control almost nothing about the playback:
  - `allow="encrypted-media; picture-in-picture"` — Feature-Policy directives
    that grant the child frame permission to use EME (for DRM'd streams) and
    request PiP. Without them the player would silently fail on some feeds.
  - `allowfullscreen` — grants Fullscreen API access to the child frame.
  - We do NOT set `sandbox` — most PPV players do popups and same-origin
    tricks that break under a strict sandbox. Tradeoff: they can attempt
    popups from within the iframe. Acceptable for our friend group.
- **Only mount the iframe when the panel is open.** A mounted iframe autoplays
  and consumes data even if it's offscreen. `LiveStreamPanel` short-circuits
  the JSX (`{open && <iframe .../>}`) so collapsing actually stops the stream.
- **Switching sources** is just `setSourceIdx(i)` → the `<iframe src>` changes →
  browser tears down the old document and loads the new one. The `key={active.url}`
  prop makes React rebuild the node instead of trying to reuse it (some
  players don't handle in-place `src` swaps gracefully).
- **What we can never do from the iframe:**
  - Read the video buffer / detect play state / know if it's actually playing.
  - Send commands to the player (no `postMessage` API is documented for these).
  - Intercept or block ads.
  - Detect that the stream died. Best signal we have is user feedback ("try
    another source"), which is why the source-switcher is prominent.
- **What could break at runtime:**
  - streamed.pk / embed.st ToS change → they add a `frame-ancestors` CSP header
    → our iframe silently renders "refused to connect". The stream just doesn't
    play; nothing else on the page is affected.
  - URL slugs rotate (they occasionally do). Fix = refresh `lib/streams.js`.
  - Their DNS changes / provider goes down. Same: iframe blank, page fine.

### 2. The chat (`components/LiveChatPanel.jsx`)

Explaining the WebSocket to a backend engineer:

- streamed.pk's own web page opens a WebSocket to
  `wss://chat.cdn-lab.shop/chat?channel=<streamedpk-match-id>` from within its
  page. We reverse-engineered the wire protocol from a HAR capture (see
  session log 2026-07-10) and open the **exact same** WebSocket **from our
  browser** — no proxying, no server component.
- Because it's browser→WSS directly, the request carries `Origin: <our-site>`.
  Cloudflare (which fronts `chat.cdn-lab.shop`) currently does **not** enforce
  an Origin allowlist, so it accepts the handshake. If they ever start
  enforcing it, we'll see WS close with a 1008/4403 code and the panel will
  show "Offline · Retry". That's the whole failure mode.
- **Protocol (all JSON text frames, both directions):**
  - Client → server:
    - `{event:"ping", client:"<64-hex>"}` — heartbeat. We send once on open.
      `client` is a random per-session token; the server doesn't seem to
      validate it, but we send one to match what streamed.pk itself sends.
    - `{event:"username", username:"foo"}` — claim a display name. Server
      replies `{event:"username", username, taken:true|false}`.
    - `{event:"message", message:"..."}` — post a message. Server broadcasts
      to all subscribers on the channel with a random `id` and assigned `color`.
  - Server → client:
    - `{event:"burst", messages:[…]}` — initial recent-history dump on join.
    - `{event:"message", id, username, message, color, sticky?}` — new message.
    - `{event:"delete", id}` — moderator deleted a message (remove from UI).
    - `{event:"count", count}` — live viewer count (periodic).
    - `{event:"ratelimit", ends: <epoch-ms>}` — "slow mode" hit. Client must
      wait until `ends` before the next send is accepted.
- **Turnstile (Cloudflare anti-bot).** streamed.pk's own page sends a
  `{event:"turnstile", token:"..."}` frame during send. We do NOT send one
  and sending currently works anyway — either the token is optional, or the
  server only checks it under abuse conditions. If they start enforcing it,
  we'll fail to send with no client-visible error (the server just drops the
  frame). Detection: user says "my messages don't appear". Fix would be
  embedding their Turnstile widget under their site key — which won't
  validate from our origin — so realistic fallback is read-only.
- **State machine in the component:**
  ```
  idle ──open panel──► connecting ──ws.onopen──► open
                            │                      │
                            │                      ├── ws.onclose (open ref true)
                            │                      │       └─► reconnecting (backoff)
                            │                      │
                            │                      └── panel closed → teardown → idle
                            │
                            └── panel closed / error 1008/4403 → gaveup
  reconnecting ──timer fires──► connecting (attempt++)
  reconnecting ──6 attempts fail──► gaveup (user Retry required)
  ```
- **Reconnect policy.** Exponential backoff `1s, 2s, 4s, 8s, 15s, 15s`. Also
  triggered on `visibilitychange` when the tab returns to foreground with a
  dead socket (mobile Safari kills backgrounded WS aggressively). After 6
  failed attempts we go to `gaveup` and show a manual **Retry** button.
- **Username claim on reconnect.** After the socket is proved dead, we've
  lost server-side session state. On reconnect we re-send the previously
  accepted `{event:"username", username}` from `usernameToClaimRef`. If the
  reconnect is fast enough, streamed.pk considers the old session still
  attached and returns `taken:true` — the user will see an error. This is a
  known race; realistic workaround is to append a numeric suffix and retry.
  Not implemented; hasn't been an issue for our friend group.
- **Auto-scroll behavior.** Sticky-bottom: if user is within 40px of the
  bottom, new messages scroll into view; if they've scrolled up to read
  history, we leave them alone. Tracked via `stickyBottomRef` updated in
  the container's `onScroll`.
- **Memory cap.** `MAX_RENDERED = 200`. Old messages are dropped from state
  when new ones come in. Prevents DOM growth over long matches.
- **Local error boundary.** `LiveChatPanel` wraps its own renderer in a
  React ErrorBoundary that **fails closed** (renders nothing). A crash in
  chat can NEVER break the Home page.
- **What we can never do:**
  - Guarantee delivery of a send. WSS `.send()` doesn't return a receipt.
    We assume success if we don't see an error and don't see our message
    echoed back with our username within a few seconds. UI just optimistically
    clears the input.
  - Enforce moderation. Server-side moderators may delete our messages via
    `{event:"delete", id}` and we honor it. We have no way to appeal.

### Files touched
- `lib/streams.js` — data map + accessors.
- `components/LiveStreamPanel.jsx` — video iframe + source switcher.
- `components/LiveChatPanel.jsx` — WebSocket + reconnect + UI.
- `components/screens/HomeScreen.jsx` — renders both above `<HeroMatch>`
  when the featured match is `status === 'live'`.
- `app/chat-probe/page.js` — dev-only diagnostic page for testing the WS
  from arbitrary origins. Safe to leave in prod (no side effects, unlinked).

### Known / anticipated failure modes for future debuggers
- **Video iframe renders blank.** Either the `MATCH_STREAMS` URL 404'd or
  embed.st added `frame-ancestors` CSP. Refresh URLs; if all embed.st URLs
  now refuse, we're stuck with iframe-only providers that opt out of this.
- **Chat panel stuck on "Connecting…".** WS handshake hanging. Check devtools
  Network → WS tab. Most likely Cloudflare started rejecting our Origin.
  Panel will eventually give up and show Retry.
- **Chat panel says "Offline · code 1008".** Origin blocked. Would need a
  server-side WS proxy (Vercel Edge Function) to spoof Origin.
- **Sends silently do nothing.** Turnstile enforcement turned on. See above.
- **Ratelimit permanent-seeming.** Cloudflare per-IP rate limits on that
  channel. Wait it out; not a bug.
- **Chat renders 30 minutes of history on join.** `burst` is streamed.pk-controlled;
  we cap the DOM at 200 messages, so it's cosmetic only.
- **Home crashes with a chat error.** Shouldn't happen — `ChatErrorBoundary`
  catches it. If it does, that boundary itself is broken; check its class.

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
