// SUPERSEDED — this script is blocked by Cloudflare and is no longer used.
//
// Odds are now fetched automatically via GitHub Actions:
//   .github/workflows/sync-odds.yml  (runs every 6h, commits public/market-odds.json)
//
// The workflow calls The-Odds-API directly (no browser required). Set the repo secret
// ODDS_API_KEY and the workflow handles everything. See the workflow file for details.
//
// ---- original notes (kept for reference) ------------------------------------
//
// Scrape FIFA World Cup match odds from stake-ind.com and write them where the
// app's /api/market-odds route can read them (public/market-odds.json).
//
// WHY a browser: Stake serves odds via JSON/GraphQL behind Cloudflare. We drive a
// real persistent Chrome profile (residential IP + retained clearance cookie) so
// the requests look human. Run this on a machine/network that can actually reach
// stake-ind.com (some ISPs/regions block it outright).
//
// WHAT it outputs: events in The-Odds-API shape, so the route reuses the existing
// lib/market-odds.js:buildMarketOddsMap() — which maps full team names to our
// static fixture IDs (A1..L6) and strips bookmaker vig.

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(StealthPlugin());
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.STAKE_URL || 'https://stake-ind.com/sports/soccer';
const WAIT_S = Number(process.env.WAIT_S || 60);
const HEADLESS = process.env.HEADLESS === '1';
const OUT_PATH = 'public/market-odds.json';
const DEBUG_DIR = 'scripts/.stake-debug';
const PROFILE_DIR = 'scripts/.stake-profile';
mkdirSync(DEBUG_DIR, { recursive: true });
mkdirSync(PROFILE_DIR, { recursive: true });

// ---- network capture -------------------------------------------------------
const ODDS_HINT = /odds|fixture|event|market|outcome|soccer|football|world.?cup|sport/i;
const rawPayloads = [];
let dumped = 0;

function safeParse(t) { try { return JSON.parse(t); } catch { return null; } }

// ---- odds extraction (best-effort, verify against real payloads) -----------
// Decimal odds live roughly in (1.01, 1000). Anything else isn't a price.
function asDecimalOdds(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) && n > 1.01 && n < 1000 ? n : null;
}

function teamName(x) {
  if (!x) return null;
  if (typeof x === 'string') return x.trim();
  return (x.name || x.shortName || x.title || x.competitorName || '').trim() || null;
}

// Pull a {home, away, draw} decimal triple out of a fixture-like node's markets.
function oddsFromMarkets(node, home, away) {
  const markets = node.markets || node.marketGroups || node.betOffers || [];
  const list = Array.isArray(markets) ? markets : Object.values(markets);
  for (const mk of list) {
    const outcomes = mk?.outcomes || mk?.selections || mk?.results || [];
    if (!Array.isArray(outcomes) || outcomes.length !== 3) continue;
    const triple = { home: null, away: null, draw: null };
    for (const oc of outcomes) {
      const price = asDecimalOdds(oc.odds ?? oc.price ?? oc.decimal ?? oc.oddsDecimal ?? oc.value);
      if (price == null) continue;
      const label = String(oc.name ?? oc.type ?? oc.outcomeType ?? oc.shortName ?? '').toLowerCase();
      if (['1', 'home', 'h'].includes(label) || (home && label === home.toLowerCase())) triple.home = price;
      else if (['2', 'away', 'a'].includes(label) || (away && label === away.toLowerCase())) triple.away = price;
      else if (['x', 'draw', 'tie', 'd'].includes(label)) triple.draw = price;
    }
    if (triple.home && triple.away && triple.draw) return triple;
  }
  return null;
}

// Interpret a single object as a fixture; null if it isn't one.
function fixtureFrom(node) {
  let home = null, away = null;
  if (Array.isArray(node.competitors) && node.competitors.length === 2) {
    home = teamName(node.competitors[0]);
    away = teamName(node.competitors[1]);
  } else if (node.homeTeam || node.awayTeam) {
    home = teamName(node.homeTeam); away = teamName(node.awayTeam);
  } else if (typeof node.name === 'string') {
    const parts = node.name.split(/\s+(?:v|vs|-|@|–)\s+/i);
    if (parts.length === 2) { home = parts[0].trim(); away = parts[1].trim(); }
  }
  if (!home || !away) return null;
  const odds = oddsFromMarkets(node, home, away);
  if (!odds) return null;
  const commence = node.startTime || node.startsAt || node.cutoffTime || node.commenceTime || node.kickoff || null;
  return { home, away, odds, commence: commence ? String(commence) : null };
}

function* walk(node, depth = 0) {
  if (depth > 12 || !node || typeof node !== 'object') return;
  yield node;
  for (const k of Object.keys(node)) yield* walk(node[k], depth + 1);
}

function extractFixtures(payloads) {
  const seen = new Map(); // "home|away" -> fixture (dedupe)
  for (const p of payloads) {
    for (const node of walk(p)) {
      const fx = fixtureFrom(node);
      if (fx) seen.set(`${fx.home}|${fx.away}`, fx);
    }
  }
  return [...seen.values()];
}

// Convert to The-Odds-API event shape so buildMarketOddsMap() can consume it.
function toEvents(fixtures) {
  return fixtures.map(fx => ({
    home_team: fx.home,
    away_team: fx.away,
    commence_time: fx.commence,
    bookmakers: [{
      key: 'stake',
      markets: [{
        key: 'h2h',
        outcomes: [
          { name: fx.home, price: fx.odds.home },
          { name: fx.away, price: fx.odds.away },
          { name: 'Draw', price: fx.odds.draw },
        ],
      }],
    }],
  }));
}

// ---- run -------------------------------------------------------------------
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: HEADLESS,
  channel: 'chrome',
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
  args: ['--disable-blink-features=AutomationControlled'],
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

ctx.on('response', async (res) => {
  try {
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    const url = res.url();
    const text = await res.text();
    if (!ODDS_HINT.test(url) && !ODDS_HINT.test(text)) return;
    const body = safeParse(text);
    if (!body) return;
    rawPayloads.push(body);
    dumped += 1;
    writeFileSync(`${DEBUG_DIR}/resp-${String(dumped).padStart(3, '0')}.json`,
      JSON.stringify({ url, body }, null, 2));
  } catch { /* ignore single-response failures */ }
});

const page = ctx.pages()[0] || (await ctx.newPage());
console.log(`Navigating to ${BASE} ...`);
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.log('goto warning:', e.message);
}
console.log(`>> If blocked/challenged, solve it. Browse the World Cup odds page so fixtures load.`);
console.log(`>> Capturing network for ${WAIT_S}s ...`);
await page.waitForTimeout(WAIT_S * 1000);

await page.screenshot({ path: `${DEBUG_DIR}/screenshot.png`, fullPage: true }).catch(() => {});
await ctx.close();

// ---- parse + write ---------------------------------------------------------
const fixtures = extractFixtures(rawPayloads);
const events = toEvents(fixtures);
const updatedAt = new Date().toISOString();
writeFileSync(OUT_PATH, JSON.stringify({ events, updatedAt, source: 'stake-ind.com' }, null, 2));

console.log('---');
console.log(`json payloads captured: ${rawPayloads.length}  (dumps in ${DEBUG_DIR}/)`);
console.log(`fixtures parsed:        ${fixtures.length}`);
console.log(`wrote ${events.length} events -> ${OUT_PATH}`);
if (events.length === 0) {
  console.log('\nNo fixtures parsed. The page may have been blocked, or Stake uses a');
  console.log(`payload shape the parser does not recognise yet. Send ${DEBUG_DIR}/resp-*.json`);
  console.log('back so the parser can be matched to the real structure.');
} else {
  console.log('\nNext: commit public/market-odds.json and push to deploy.');
  console.log('(Only fixtures that map to our A1..L6 World Cup IDs will show in the app.)');
}
