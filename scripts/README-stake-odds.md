# Stake odds scraper

Pulls real-world FIFA World Cup match odds from `stake-ind.com` and feeds them to
the bet sheet's "🌍 market odds" line. Replaces the dead The Odds API integration
(its key never issued).

## How it fits together

```
scripts/scrape-stake-odds.mjs   →  public/market-odds.json  →  /api/market-odds  →  bet sheet
   (run on a machine that         (commit + push to deploy)    (maps team names to
    can reach stake-ind.com)                                    our A1..L6 fixture IDs)
```

The scraper outputs events in **The-Odds-API shape**, so the route reuses the
existing `lib/market-odds.js:buildMarketOddsMap()` — full team names → static
fixture IDs, with bookmaker vig stripped. Non-World-Cup fixtures don't map and are
dropped, so you can scrape the general soccer page; you don't need the exact WC URL.

## Requirements

- A network/region that can actually reach `stake-ind.com` (some ISPs block it).
- Chrome installed (the scraper drives it via `channel: 'chrome'`).
- `npx playwright install chromium` once, if Playwright complains about browsers.

## Run it

```bash
node scripts/scrape-stake-odds.mjs          # opens Chrome, captures 60s
# options:
STAKE_URL='https://stake-ind.com/sports/soccer/world-cup'  node scripts/scrape-stake-odds.mjs
WAIT_S=90    node scripts/scrape-stake-odds.mjs   # longer browse window
HEADLESS=1   node scripts/scrape-stake-odds.mjs   # once it reliably works
```

When the Chrome window opens: clear any Cloudflare check, then browse the World Cup
odds page so fixtures load. The scraper captures the JSON in the background. It uses
a **persistent profile** (`scripts/.stake-profile/`), so a clearance cookie you
solve once is reused on later runs.

## Deploy fresh odds

```bash
git add public/market-odds.json
git commit -m "chore: refresh market odds"
git push            # Vercel redeploys with the new odds
```

(You can automate the run later with Claude `/schedule` or a local cron — out of
scope for the repo.)

## If it parses 0 fixtures

The parser in `scrape-stake-odds.mjs` is best-effort and may not match Stake's
exact payload yet. Every JSON response is dumped to `scripts/.stake-debug/` — send
those `resp-*.json` files back and the parser can be finalized to the real shape.
The `scripts/stake-probe.mjs` helper does pure capture (no parsing) if you just
want to inspect what the site returns.

## Not committed

`scripts/.stake-debug/` (raw dumps, screenshots) and `scripts/.stake-profile/`
(browser profile + cookies) are git-ignored.
