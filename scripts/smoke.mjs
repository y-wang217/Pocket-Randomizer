/**
 * Browser smoke test: play one battle end to end in a real Chromium.
 *
 * Step 0 of the build spec exists to retire one risk — whether @pkmn/sim
 * bundles and runs in a browser. A passing Node test suite does not answer
 * that; only loading the built bundle in a browser does. This script serves
 * dist/, clicks the first move until the battle ends, and fails on any console
 * error or page exception along the way.
 *
 * Usage: npm run build && node scripts/smoke.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

const DIST = join(process.cwd(), 'dist');
mkdirSync(join(process.cwd(), 'stats'), { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const url = `http://127.0.0.1:${server.address().port}/#seed=SMOKE001`;

// This container ships a pinned Chromium that may not match the Playwright
// build's expected revision, so point at it explicitly when it is present
// rather than trying to download one.
const PINNED = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'];
const executablePath = PINNED.find((candidate) => existsSync(candidate));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

const started = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('.move:not(:disabled)', { timeout: 20_000 });
const ready = Date.now() - started;

const check = async (label, selector) => {
  const count = await page.locator(selector).count();
  console.log(`  ${count > 0 ? 'ok  ' : 'FAIL'} ${label} (${selector} x${count})`);
  if (count === 0) problems.push(`missing: ${label}`);
};

console.log(`\nloaded and interactive in ${ready} ms\n`);
console.log('required UI:');
await check('four move buttons', '.move');
await check('move type chip', '.move .type');
await check('move category', '.move__category');
await check('move base power', '.move__power');
await check('move PP', '.move__pp');
await check('both HP bars', '.hp__fill');
await check('seed input', '.seedbar__input');
await check('battle log entries', '.log-entry');

const seed = await page.inputValue('.seedbar__input');
console.log(`\nseed shown: ${seed}`);

// Open with the boosting move so the stat-stage indicators get exercised,
// then attack. Always clicking slot 1 would never render a stat stage and the
// check below would pass vacuously.
let turns = 0;
const opener = page.locator('.move:not(:disabled)', { hasText: 'Curse' }).first();
if (await opener.count()) {
  await opener.click();
  turns++;
  await page.waitForTimeout(60);
}
const stagesAfterBoost = await page.locator('.badge--stage').count();
await page.waitForTimeout(500);
await page.screenshot({ path: 'stats/mid-battle.png', fullPage: true });

while (turns < 200) {
  if (await page.locator('.overlay:not([hidden])').count()) break;
  const move = page.locator('.move:not(:disabled)').first();
  if (!(await move.count())) break;
  await move.click();
  turns++;
  await page.waitForTimeout(30);
}

await page.waitForSelector('.overlay:not([hidden])', { timeout: 10_000 });
const outcome = await page.getAttribute('.overlay', 'data-outcome');
const title = await page.textContent('.overlay__title');
const detail = await page.textContent('.overlay__detail');
console.log(`\nbattle finished after ${turns} clicks: ${title} (${outcome})\n  ${detail}`);

// Curse moves three stats at once, so the indicator must show three chips.
console.log(`\nstat-stage chips after Curse: ${stagesAfterBoost}`);
if (stagesAfterBoost < 3) problems.push(`stat stages did not render (saw ${stagesAfterBoost}, expected 3)`);
console.log(`status badges seen:           ${await page.locator('.badge--status:not([hidden])').count()}`);
// Let the HP bar's 380 ms transition settle so the screenshot shows the
// final state rather than a frame of the animation.
await page.waitForTimeout(600);
await page.screenshot({ path: 'stats/battle.png', fullPage: true });

// The rematch button must re-run the same seed.
await page.click('.overlay__actions .button--primary');
await page.waitForSelector('.move:not(:disabled)', { timeout: 10_000 });
const rematchSeed = await page.inputValue('.seedbar__input');
console.log(`\nrematch seed: ${rematchSeed} ${rematchSeed === seed ? '(same, ok)' : '(CHANGED — FAIL)'}`);
if (rematchSeed !== seed) problems.push('rematch changed the seed');

const stored = await page.evaluate(() => globalThis.localStorage.getItem('gymrun.lastRun'));
const log = stored ? JSON.parse(stored) : null;
console.log(`run log stored: ${log ? `seed ${log.seed}, ${log.decisions.length} decisions` : 'NONE'}`);
if (!log || log.decisions.length === 0) problems.push('no run log written to localStorage');

await browser.close();
server.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\nsmoke test passed');
