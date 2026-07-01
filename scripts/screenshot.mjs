#!/usr/bin/env node
/**
 * Usage: node scripts/screenshot.mjs [path] [--mobile] [--full]
 *
 * Takes a screenshot of localhost:3000 (or specified path) and saves to /tmp/ss.png
 *
 * Examples:
 *   node scripts/screenshot.mjs                     # homepage, mobile viewport
 *   node scripts/screenshot.mjs /specials/r32-flop  # specific page
 *   node scripts/screenshot.mjs /fixtures --full    # full-page scroll capture
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const path = args.find(a => a.startsWith('/')) || '/';
const fullPage = args.includes('--full');
const mobile = !args.includes('--desktop');

const OUTPUT = '/tmp/ss.png';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    deviceScaleFactor: mobile ? 3 : 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  const url = `http://localhost:3000${path}`;
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  // Extra wait for client-side renders
  await page.waitForTimeout(1500);

  await page.screenshot({ path: OUTPUT, fullPage });
  console.log(`Screenshot saved to ${OUTPUT}`);

  await browser.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
