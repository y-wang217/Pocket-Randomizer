/**
 * Browser smoke test: play a whole run end to end in a real Chromium.
 *
 * A passing Node suite says the run logic is right. It does not say the built
 * bundle loads, that the screens route, or that a click reaches a policy. Only
 * loading dist/ in a browser answers that, so this script serves it, plays a
 * full segment by clicking, and fails on any console error or page exception.
 *
 * It also checks the property the whole project rests on, in the place a player
 * would meet it: the same seed played with the same clicks twice produces the
 * same summary, in a browser, across a full restart of the run.
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
/*
 * Fixed by default so the run is the same on every machine; overridable when
 * hunting for a seed that exercises a particular path.
 *
 * SMOKE603 was chosen because the player below clears all eight gyms on it, so
 * one pass covers every screen and the winning ending: starter select, the gym
 * rail filling in, a map with completed, current and upcoming steps, forty-odd
 * nodes of battles and rests, multi-Pokemon gyms, and the victory summary.
 *
 * Finding it took a scan of 1500 seeds, because the shipped completion rate is
 * around 5% and this bot is weaker than the balance sim's `greedy` policy. If a
 * balance change turns it into a defeat the run still smokes fine — the log
 * says which ending it got — but re-scan for a seed that wins, or the victory
 * branch stops being exercised.
 */
const SEED = process.env.GYMRUN_SMOKE_SEED ?? 'SMOKE603';
const url = `http://127.0.0.1:${server.address().port}/#seed=${SEED}`;

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

const visible = (name) => `.screen[data-screen="${name}"]:not([hidden])`;

const check = async (label, selector) => {
  const count = await page.locator(selector).count();
  console.log(`  ${count > 0 ? 'ok  ' : 'FAIL'} ${label} (${selector} x${count})`);
  if (count === 0) problems.push(`missing: ${label}`);
};

const started = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
console.log(`\nloaded and interactive in ${Date.now() - started} ms\n`);

console.log('starter select:');
const starterCount = await page.locator('.starter').count();
console.log(`  ${starterCount === 3 ? 'ok  ' : 'FAIL'} three starters offered (x${starterCount})`);
if (starterCount !== 3) problems.push(`expected 3 starters, saw ${starterCount}`);
await check('starter types', '.starter .type');
await check('starter movesets', '.starter__move');
await check('starter move power', '.starter .move__power');

const seed = await page.inputValue('.seedbar__input');
console.log(`\nseed shown: ${seed}`);
if (seed !== SEED) problems.push(`seed from the URL was not used (saw ${seed})`);

/**
 * Play a run competently, reading the screen the way a player would.
 *
 * Competence matters here, and it matters more at eight segments than it did at
 * one. A bot that always clicks the first move and the first node dies two nodes
 * in, and a smoke test that never reaches a rest node or a gym is not smoking
 * most of the app. So: take the bulkiest starter, hit the hardest move
 * available, and take the rest when hurt.
 *
 * All three decisions are pure functions of what is on screen — including the
 * starter's max HP, which the card prints — which is what lets the second run be
 * compared to the first.
 */
async function playRun(label) {
  await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
  await (await bulkiestStarter()).click();

  let battles = 0;
  let nodes = 0;
  let rests = 0;
  let sawSavedLog = false;
  let mapStructure = null;
  // The furthest the eight-gym rail got. Read while playing, because the map
  // screen is gone by the time the summary is up — and a rail that never
  // advanced would be a progression indicator that does not indicate progress.
  let railHigh = 0;

  for (let guard = 0; guard < 400; guard++) {
    if (await page.locator(visible('summary')).count()) break;

    if (await page.locator(visible('battle')).count()) {
      const move = await hardestMove();
      if (move) {
        // One frame of a real fight, after the HP bar's 380ms transition has
        // settled so the shot shows the state rather than the animation.
        if (battles === 3) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: `stats/${label}-battle.png`, fullPage: true });
        }
        await move.click();
        battles++;
        await page.waitForTimeout(25);
        continue;
      }
      await page.waitForTimeout(40);
      continue;
    }

    if (await page.locator(visible('map')).count()) {
      // Mid-run the log must be on disk, or an interrupted run is lost. It is
      // cleared when the run ends, so it has to be checked while playing.
      if (!sawSavedLog) {
        const stored = await page.evaluate(() => globalThis.localStorage.getItem('gymrun.lastRun'));
        const log = stored ? JSON.parse(stored) : null;
        if (log?.decisions?.length > 0) sawSavedLog = true;
      }

      railHigh = Math.max(railHigh, await page.locator('.rail__gym--done').count());

      const node = await chooseNode();
      if (node) {
        if (nodes === 1) {
          mapStructure = await readMapStructure();
          await page.screenshot({ path: `stats/${label}-map.png`, fullPage: true });
        }
        if (await node.evaluate((el) => el.classList.contains('node--rest'))) rests++;
        await node.click();
        nodes++;
        await page.waitForTimeout(25);
        continue;
      }
    }
    await page.waitForTimeout(40);
  }

  await page.waitForSelector(visible('summary'), { timeout: 20_000 });
  return {
    battles,
    nodes,
    rests,
    sawSavedLog,
    mapStructure,
    outcome: await page.getAttribute(visible('summary'), 'data-outcome'),
    title: await page.textContent('.summary__title'),
    detail: await page.textContent('.summary__detail'),
    seedLine: await page.textContent('.summary__seed'),
    visits: await page.locator('.summary__node').allTextContents(),
    railHigh,
    count: await page.textContent('.summary__count'),
    cause: await page.textContent('.summary__cause'),
    badgesWon: await page.locator('.summary__badge--won').count(),
    teamCards: await page.locator('.summary__member').count(),
    teamMoves: await page.locator('.summary__member .starter__move').count(),
  };
}

/**
 * The starter with the most HP, ties to the leftmost card.
 *
 * At PARTY_SIZE 1 this one click is the largest decision in the run — it is the
 * only Pokemon the player will ever have — so a bot that takes whichever card is
 * first is not playing the game, it is sampling it.
 */
async function bulkiestStarter() {
  const cards = page.locator('.starter');
  const count = await cards.count();
  let best = 0;
  let bestHp = -1;
  for (let i = 0; i < count; i++) {
    // The card prints "<Ability> · <N> HP"; N is the number the choice turns on.
    const meta = (await cards.nth(i).locator('.starter__meta').textContent()) ?? '';
    const hp = Number(/(\d+)\s*HP/.exec(meta)?.[1] ?? 0);
    if (hp > bestHp) {
      bestHp = hp;
      best = i;
    }
  }
  return cards.nth(best);
}

/** The usable move with the highest base power, ties to the lowest slot. */
async function hardestMove() {
  const buttons = page.locator(`${visible('battle')} .move:not(:disabled)`);
  const count = await buttons.count();
  if (count === 0) return null;

  let best = 0;
  let bestPower = -1;
  for (let i = 0; i < count; i++) {
    const text = (await buttons.nth(i).locator('.move__power').textContent()) ?? '';
    const power = Number(/^(\d+)/.exec(text.trim())?.[1] ?? 0);
    if (power > bestPower) {
      bestPower = power;
      best = i;
    }
  }
  return buttons.nth(best);
}

/** Rest whenever hurt and a rest is offered; otherwise take the first node. */
async function chooseNode() {
  const options = page.locator(`${visible('map')} .node--current`);
  if ((await options.count()) === 0) return null;

  const hpText = (await page.locator(`${visible('map')} .panel__hp-text`).first().textContent()) ?? '';
  const [, current, max] = /(\d+)\s*\/\s*(\d+)/.exec(hpText) ?? [];
  const fraction = current && max ? Number(current) / Number(max) : 1;

  if (fraction < 0.95) {
    const rest = page.locator(`${visible('map')} .node--current.node--rest`).first();
    if (await rest.count()) return rest;
  }
  return options.first();
}

/** What the chain looked like partway through: done behind, current, upcoming ahead. */
async function readMapStructure() {
  return {
    done: await page.locator(`${visible('map')} .step--done`).count(),
    current: await page.locator(`${visible('map')} .step--current`).count(),
    upcoming: await page.locator(`${visible('map')} .step--upcoming`).count(),
    gym: await page.locator(`${visible('map')} .node--gym`).count(),
  };
}

const first = await playRun('run1');
console.log(`\nrun finished: ${first.title} (${first.outcome})`);
console.log(`  ${first.detail}`);
console.log(`  ${first.nodes} node choices (${first.rests} rests), ${first.battles} move clicks`);
console.log(`  map partway through: ${JSON.stringify(first.mapStructure)}`);

console.log('\nrequired UI:');
await check('summary node list', '.summary__node');
await check('summary actions', '.summary__actions .button');
if (!first.seedLine?.includes(SEED)) problems.push('summary did not show the seed');
if (first.nodes < 3) problems.push(`only ${first.nodes} node choices — the map is not being played`);
if (first.battles < 3) problems.push(`only ${first.battles} move clicks — battles are not being played`);

// The map has to show the whole chain, not just the step in front of you.
const shape = first.mapStructure ?? {};
if (!(shape.done >= 1)) problems.push('map showed no completed step');
if (shape.current !== 1) problems.push(`map showed ${shape.current} current steps, expected exactly 1`);
if (!(shape.upcoming >= 1)) problems.push('map showed no upcoming steps');
if (!(shape.gym >= 1)) problems.push('map did not show the gym at the end of the chain');

// Stage 2's screens: the eight-gym rail, and a summary that answers "how far
// did I get", "what was I" and "what killed me" rather than just "you lost".
console.log('\nStage 2 UI:');
await check('gym rail', '.rail__gym');
console.log(`  ${first.railHigh >= 1 ? 'ok  ' : 'FAIL'} rail marked ${first.railHigh} gym(s) cleared during the run`);
if (first.railHigh < 1) problems.push('the gym rail never marked a gym cleared');
await check('summary progress badges', '.summary__badge');
await check('summary final team', '.summary__member');
if (!/\d+ \/ 8 gyms/.test(first.count ?? '')) {
  problems.push(`summary did not report gyms cleared out of eight (saw "${first.count}")`);
}
if (first.teamCards < 1) problems.push('summary showed no final team');
if (first.teamMoves < 4) problems.push(`summary team showed ${first.teamMoves} moves, expected at least 4`);
if (!first.cause || first.cause.trim().length === 0) {
  problems.push('summary showed no cause-of-death line');
}
if (first.outcome === 'defeat' && !/fainted/.test(first.cause ?? '')) {
  problems.push(`a defeat did not name what killed the run (saw "${first.cause}")`);
}
if (first.outcome === 'victory' && first.badgesWon !== 8) {
  problems.push(`a victory marked ${first.badgesWon} gym badges, expected 8`);
}
console.log(`  ok   cause of death: ${first.cause?.trim()}`);

// The rest and gym paths are the two Stage 1 adds, so one pass must hit both.
if (first.rests < 1) problems.push('no rest node was taken — the rest path is unsmoked');
const reachedGym = first.visits.some((line) => /Gym|\(Rock\)|Garnet/.test(line));
console.log(`  ${reachedGym ? 'ok  ' : 'FAIL'} run reached the gym`);
if (!reachedGym) problems.push('the run never reached the gym');
if (!['victory', 'defeat'].includes(first.outcome ?? '')) {
  problems.push(`summary showed no outcome (saw ${first.outcome})`);
}
console.log(`  ${first.sawSavedLog ? 'ok  ' : 'FAIL'} run log saved mid-run`);
if (!first.sawSavedLog) problems.push('no run log written to localStorage during the run');

await page.waitForTimeout(400);
await page.screenshot({ path: 'stats/summary.png', fullPage: true });

// The property everything rests on, checked where a player would meet it.
console.log('\nsame seed, same clicks, again:');
await page.click('.summary__actions .button--primary');
const second = await playRun('run2');

const same = (label, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) problems.push(`replay differed: ${label}\n      first:  ${JSON.stringify(a)}\n      second: ${JSON.stringify(b)}`);
};

same('outcome', first.outcome, second.outcome);
same('summary line', first.detail, second.detail);
same('node-by-node history', first.visits, second.visits);
same('node choices and move clicks', [first.nodes, first.battles], [second.nodes, second.battles]);
same('map shape partway through', first.mapStructure, second.mapStructure);
same('gyms cleared', first.count, second.count);
same('cause of death', first.cause, second.cause);

const rematchSeed = await page.inputValue('.seedbar__input');
console.log(`\nrematch seed: ${rematchSeed} ${rematchSeed === seed ? '(same, ok)' : '(CHANGED — FAIL)'}`);
if (rematchSeed !== seed) problems.push('rematch changed the seed');

await browser.close();
server.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\nsmoke test passed');
