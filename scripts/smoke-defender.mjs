/**
 * Browser smoke for Defender Mode v0: one defender run, end to end, by clicking.
 *
 * `scripts/smoke.mjs` proves the attacker's screens route in the built bundle.
 * This proves the defender's do, on the same harness: the mode choice in the
 * seed bar reaches `playRun`, the gym type screen answers `chooseGymType`, the
 * starter screen answers the draft and the recruit, the map answers a door,
 * the intermission plays without a question, and the pre-gym screen draws the
 * boss variant. It fails on any console error or page exception, on a stall,
 * and on a surface the mode draws not being drawn.
 *
 * Usage: npm run build && node scripts/smoke-defender.mjs
 *   GYMRUN_SMOKE_SEED   the seed (default DEF-SMOKE-1)
 *   GYMRUN_SMOKE_GYM    the gym type card to take, by index (default 0, Fire)
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { notFirstLaunch } from './first-launch.mjs';

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

const SEED = process.env.GYMRUN_SMOKE_SEED ?? 'DEF-SMOKE-1';
const GYM = Number(process.env.GYMRUN_SMOKE_GYM ?? 0);
const url = `http://127.0.0.1:${server.address().port}/#seed=${SEED}`;

const PINNED = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'];
const executablePath = PINNED.find((candidate) => existsSync(candidate));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
// A returning player's settings, so neither first-run surface covers a click.
await page.addInitScript((settings) => {
  try {
    if (!globalThis.localStorage.getItem('gymrun.settings')) globalThis.localStorage.setItem('gymrun.settings', settings);
  } catch {
    // Storage unavailable: defaults apply.
  }
}, notFirstLaunch());

const problems = [];
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  // Sprite and icon CDN loads a sandbox cannot reach are the network, not the app.
  if (/Failed to load resource/.test(msg.text()) && /pokemonshowdown\.com/.test(msg.location()?.url ?? '')) return;
  problems.push(`console: ${msg.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

const visible = (name) => `.screen[data-screen="${name}"]:not([hidden])`;
const seen = new Map();
const note = (key) => seen.set(key, (seen.get(key) ?? 0) + 1);
const count = async (selector) => page.locator(selector).count();

await page.goto(url, { waitUntil: 'load' });
// The page starts an attacker run; the bar's mode choice and Start replace it.
await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
await page.locator('.seedbar__toggle').click();
await page.locator('.seedbar__mode[data-mode="defender"]').click();
await page.locator('.seedbar button', { hasText: 'Start run' }).click();
await page.waitForSelector(`${visible('gym-select')} .gym-type`, { timeout: 20_000 });
await page.screenshot({ path: 'stats/defender-gym-select.png', fullPage: true });

/** The usable battle button with the highest base power, ties to the lowest slot. */
async function hardestMove() {
  const buttons = page.locator(`${visible('battle')} .move:not(:disabled)`);
  const total = await buttons.count();
  if (total === 0) return null;
  let best = 0;
  let bestPower = -1;
  for (let i = 0; i < total; i++) {
    const power$ = buttons.nth(i).locator('.move__power');
    const text = (await power$.count()) > 0 ? ((await power$.textContent()) ?? '') : '';
    const power = Number(/^(\d+)/.exec(text.trim())?.[1] ?? 0);
    if (power > bestPower) {
      bestPower = power;
      best = i;
    }
  }
  return buttons.nth(best);
}

for (let guard = 0; guard < 2500; guard++) {
  if (await count(visible('summary'))) break;

  if (await count(visible('gym-select'))) {
    note('gym-select');
    await page.locator(`${visible('gym-select')} .gym-type`).nth(GYM).click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('starter'))) {
    const title = (await page.textContent(`${visible('starter')} .screen__title`)) ?? '';
    note(title);
    if (await count(`${visible('starter')} [data-tip^="badge:"]`)) note('flame on a card');
    await page.locator(`${visible('starter')} .starter`).first().click();
    await page.locator('.starter-select__choose').click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('battle'))) {
    note('battle frame');
    if (await count(`${visible('battle')} .move__badge--flame .move__crit`)) note('flame with crit chance');
    if (await count(`${visible('battle')} .move[data-badge-move="true"]`)) note('fifth button');
    if (await count(`${visible('battle')} .panel__intent [data-tip="badge:Psychic"]`)) note('eye with intent');
    const forced = page.locator(`${visible('battle')} .bench[data-forced="true"] .bench__member:not(:disabled)`);
    if (await forced.count()) {
      await forced.first().click();
      await page.waitForTimeout(25);
      continue;
    }
    const move = await hardestMove();
    if (move) await move.click();
    await page.waitForTimeout(move ? 25 : 40);
    continue;
  }

  if (await count(visible('result'))) {
    const card = page.locator(`${visible('result')} .reward`).first();
    if (await card.count()) {
      for (const kind of ['consumable', 'trade']) {
        if (await count(`${visible('result')} .reward--${kind}`)) note(`${kind} card`);
      }
      await card.click();
      await page.locator('.confirm-band .primary-action').click();
      note('reward');
      await page.waitForTimeout(25);
      continue;
    }
    const carry = page.locator(`${visible('result')} .result__actions .button`).first();
    if (await carry.count()) {
      await carry.click();
      await page.waitForTimeout(25);
      continue;
    }
  }

  if (await count(visible('shop'))) {
    note('intermission');
    await page.locator(`${visible('shop')} .shop__footer .button`).click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('target'))) {
    await page.locator(`${visible('target')} .target__choose`).first().click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('replace'))) {
    await page.locator(`${visible('replace')} .move--victim`).last().click();
    const commit = page.locator('.confirm-band .primary-action');
    if (await commit.count()) await commit.first().click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('party'))) {
    await page.locator(`${visible('party')} .primary-action`).click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('pre-gym'))) {
    note('pre-gym');
    if (await count(`${visible('pre-gym')} .pre-gym__size`)) note('boss size');
    if ((seen.get('pre-gym') ?? 0) === 1) await page.screenshot({ path: 'stats/defender-pre-gym.png', fullPage: true });
    await page.locator(`${visible('pre-gym')} .pre-gym__confirm`).click();
    await page.waitForTimeout(25);
    continue;
  }

  if (await count(visible('map'))) {
    const doors = page.locator(`${visible('map')} .step--current button.node`);
    if (await doors.count()) {
      note('door');
      if (await count(`${visible('map')} .step--current .node__name--class`)) note('class name at the door');
      if ((seen.get('door') ?? 0) === 1) await page.screenshot({ path: 'stats/defender-map.png', fullPage: true });
      await doors.first().click();
      await page.waitForTimeout(25);
      continue;
    }
  }
  await page.waitForTimeout(40);
}

if (!(await count(visible('summary')))) {
  const stuck = await page.evaluate(() => {
    const screens = [...globalThis.document.querySelectorAll('.screen')].filter((screen) => !screen.hidden);
    const open = screens[0];
    return {
      screens: screens.map((screen) => screen.dataset['screen']),
      buttons: open ? [...open.querySelectorAll('button:not([disabled])')].map((b) => b.textContent?.trim()) : [],
    };
  });
  problems.push(`the run stalled on ${stuck.screens.join('+') || '(none)'}: ${stuck.buttons.slice(0, 8).join(' | ')}`);
} else {
  await page.screenshot({ path: 'stats/defender-summary.png', fullPage: true });
}

const saved = await page.evaluate(() => globalThis.localStorage.getItem('gymrun.lastRun'));
const expect = (label, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) problems.push(`missing: ${label}`);
};
console.log(`\ndefender smoke, seed ${SEED}, gym card ${GYM}`);
for (const [key, value] of seen) console.log(`  ${String(value).padStart(5)}  ${key}`);
expect('the gym type screen was answered', seen.get('gym-select') === 1);
expect('three draft picks were answered', seen.get('Draft one') === 3);
expect('a door was chosen', (seen.get('door') ?? 0) > 0);
expect('every door named its challengers', seen.get('class name at the door') === seen.get('door'));
expect('a battle was played', (seen.get('battle frame') ?? 0) > 0);
if ((seen.get('pre-gym') ?? 0) > 0) expect('the boss showed its team size', seen.get('boss size') === seen.get('pre-gym'));
if (GYM === 0) expect('the Fire flame showed on a draft card', (seen.get('flame on a card') ?? 0) > 0);
if (saved === null) console.log('  (the save was cleared at the end of the run)');

await browser.close();
server.close();
if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log('\ndefender smoke passed');
