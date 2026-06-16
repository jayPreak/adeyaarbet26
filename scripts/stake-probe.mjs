// Exploratory probe for stake-ind.com using a PERSISTENT real-Chrome profile.
// Cloudflare hard-blocks throwaway automation profiles, but a persistent profile
// (real fingerprint + retained clearance cookie) usually passes — and once YOU
// clear any check by hand, the cookie sticks in scripts/.stake-profile/ so future
// runs sail through. Captures JSON/GraphQL fixtures+odds into scripts/.stake-debug/.
//
// Run: node scripts/stake-probe.mjs
//  - A Chrome window opens. If you see a block/challenge, solve it / browse to the
//    World Cup soccer page manually. The script watches the network the whole time.
//  - Optional: STAKE_URL=... to start on a specific page. WAIT_S=90 to wait longer.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.STAKE_URL || 'https://stake-ind.com/sports/soccer';
const WAIT_S = Number(process.env.WAIT_S || 90);
const DEBUG_DIR = 'scripts/.stake-debug';
const PROFILE_DIR = 'scripts/.stake-profile';
mkdirSync(DEBUG_DIR, { recursive: true });
mkdirSync(PROFILE_DIR, { recursive: true });

const ODDS_HINT = /odds|fixture|event|market|outcome|soccer|world.?cup|sport/i;
let captured = 0;

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
  args: ['--disable-blink-features=AutomationControlled'],
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
const page = ctx.pages()[0] || (await ctx.newPage());

ctx.on('response', async (res) => {
  try {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    const text = await res.text();
    if (!ODDS_HINT.test(url) && !ODDS_HINT.test(text)) return;
    captured += 1;
    writeFileSync(`${DEBUG_DIR}/resp-${String(captured).padStart(3, '0')}.json`,
      JSON.stringify({ url, body: safeParse(text) }, null, 2));
    console.log(`captured #${captured}: ${url.slice(0, 90)}`);
  } catch { /* ignore single-response failures */ }
});

function safeParse(t) { try { return JSON.parse(t); } catch { return t.slice(0, 5000); } }

console.log(`Navigating to ${BASE} ...`);
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.log('goto warning:', e.message);
}

console.log(`>> If blocked/challenged, solve it & browse to the World Cup odds page.`);
console.log(`>> Watching network for ${WAIT_S}s ...`);
await page.waitForTimeout(WAIT_S * 1000);

const title = await page.title();
const finalUrl = page.url();
await page.screenshot({ path: `${DEBUG_DIR}/screenshot.png`, fullPage: true }).catch(() => {});
writeFileSync(`${DEBUG_DIR}/page.html`, await page.content().catch(() => ''));
writeFileSync(`${DEBUG_DIR}/summary.json`, JSON.stringify({ title, finalUrl, captured }, null, 2));

console.log('---');
console.log('title:', title);
console.log('finalUrl:', finalUrl);
console.log('json responses captured:', captured);
await ctx.close();
