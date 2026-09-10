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
/*
 * A seed chosen to *exercise* the app, not a lucky one.
 *
 * It clears two gyms and passes through rests, shops and events on the way, so
 * a single smoke run touches every screen. It has to be rechosen whenever a
 * tuning pass moves the curve — SMOKE603 played a full segment before Stage 3
 * and died at node two after it — which is why the failures below are phrased
 * as "this seed no longer smokes the app" rather than as balance regressions.
 *
 * SMOKE11 was the Stage 4.5 pick and died at gym 1 after Stage 4.5.1 moved
 * `RANDOMIZER_VERSION` to `-5`: gender is rolled per Pokemon now, so every
 * seed's species, ability and moveset rolls shifted and SMOKE11's run is simply
 * a different run. SMOKE12 was the first re-scanned seed that reaches two gyms
 * and shows the move-target screen on the way.
 *
 * SMOKE12 died at node one after Stage 4.6a moved `RANDOMIZER_VERSION` to `-7`
 * — the keyed streams re-seeded every roll in the game — and the bot walks into
 * the first option of the first step, which on that seed became a `hard` wild
 * three levels above the starter. SMOKE23 replaced it, and in turn stopped
 * reaching a gym when Stage 4.6b's reward ramp widened the level offsets: the
 * banded starter is weaker than its predecessor for the first three segments,
 * so the seed's early fights resolve the other way now. SMOKE24 clears four
 * gyms, fills the party to three, and answers forced switches on the way, so
 * one pass covers the locale screen, the capture block, both acquisition paths
 * and the bench.
 */
const SEED = process.env.GYMRUN_SMOKE_SEED ?? 'SMOKE24';
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
  let rewards = 0;
  let results = 0;
  let shops = 0;
  let events = 0;
  let targets = 0;
  let replacements = 0;
  let acquisitions = 0;
  let releases = 0;
  let locales = 0;
  let partyVisits = 0;
  let switches = 0;
  let sawSavedLog = false;
  let mapStructure = null;
  // The furthest the eight-gym rail got. Read while playing, because the map
  // screen is gone by the time the summary is up — and a rail that never
  // advanced would be a progression indicator that does not indicate progress.
  let railHigh = 0;

  for (let guard = 0; guard < 400; guard++) {
    if (await page.locator(visible('summary')).count()) break;

    if (await page.locator(visible('battle')).count()) {
      /*
       * A forced switch offers no moves at all, so it has to be answered from
       * the bench or the run stalls here forever. This is the branch that
       * proves the switch panel is wired to a policy and not just drawn.
       */
      const forced = page.locator(`${visible('battle')} .bench[data-forced="true"] .bench__member:not(:disabled)`);
      if (await forced.count()) {
        await forced.first().click();
        switches++;
        await page.waitForTimeout(25);
        continue;
      }

      const move = await hardestMove();
      if (move) {
        // One frame of a real fight, after the HP bar's 380ms transition has
        // settled so the shot shows the state rather than the animation.
        if (battles === 3) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: `stats/${label}-battle.png`, fullPage: true });
        }
        // A later shot too, so the log has a few turns in it: turn order and
        // priority markers are the point of Stage 4.5.2 and cannot be read off
        // a battle that is three lines old.
        if (battles === 24) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: `stats/${label}-battle-log.png`, fullPage: true });
        }
        await move.click();
        battles++;
        await page.waitForTimeout(25);
        continue;
      }
      await page.waitForTimeout(40);
      continue;
    }

    /*
     * The locale, which opens every segment from Stage 4.6a.
     *
     * First, because it interrupts the map loop before the map has anything to
     * show: a segment has no route at all until this is answered, so a run that
     * did not know about the screen would sit here until the summary timed out.
     *
     * The last card rather than the first, deliberately — the app answered this
     * question with index 0 for one checkpoint while the screen was being
     * built, and a smoke run that also took index 0 would agree with that
     * auto-answer by accident and stop proving a human choice was applied.
     */
    if (await page.locator(visible('locale')).count()) {
      const card = page.locator(`${visible('locale')} .locale`).last();
      if (await card.count()) {
        if (locales === 0) await page.screenshot({ path: `stats/${label}-locale.png`, fullPage: true });
        await card.click();
        locales++;
        await page.waitForTimeout(25);
        continue;
      }
    }

    /*
     * The three Stage 3 screens.
     *
     * Checked before the map, because all three interrupt the map loop and a
     * run that stalled on one would time out at the summary with no clue why.
     * Each takes the same deterministic-from-what-is-on-screen approach the
     * rest of this bot uses, so the second run can be compared to the first.
     */
    /*
     * The result screen, which every battle now ends on. Stage 4.5.2 item D.
     *
     * Two shapes, and the bot has to answer both: with cards it takes one (the
     * card *is* the continue, since there is no skip), and without cards — a
     * fight the player lost — it presses Carry on. A run that only knew the
     * first shape would hang on the first defeat.
     */
    if (await page.locator(visible('result')).count()) {
      const card = page.locator(`${visible('result')} .reward`).first();
      if (await card.count()) {
        if (rewards === 0) await page.screenshot({ path: `stats/${label}-reward.png`, fullPage: true });
        await card.click();
        rewards++;
        await page.waitForTimeout(25);
        continue;
      }
      /*
       * The capture block, which from Stage 4.6a lives inside this screen
       * rather than on one after it.
       *
       * Checked after the cards and before the carry-on button, which is the
       * order the screen itself renders in: with cards up the block is hidden,
       * and when the block is up there is no carry-on button at all — taking or
       * leaving the Pokemon *is* the continue.
       *
       * Take it while there is room; once full, release the last member. Both
       * paths have to be exercised, and "always decline" would exercise
       * neither.
       */
      const capture = page.locator(`${visible('result')} .result__capture`);
      if ((await capture.count()) && !(await capture.first().isHidden())) {
        if (acquisitions === 0) await page.screenshot({ path: `stats/${label}-capture.png`, fullPage: true });
        const take = capture.locator('.acquire__actions .primary-action');
        if (await take.count()) {
          await take.click();
          acquisitions++;
        } else {
          // Full: the only way to accept is to name who leaves, and the button
          // confirms before it commits, so it takes two clicks.
          const release = capture.locator('.button--danger').last();
          if (await release.count()) {
            await release.click();
            await release.click();
            releases++;
            acquisitions++;
          } else {
            await capture.locator('.acquire__actions .button').last().click();
          }
        }
        await page.waitForTimeout(25);
        continue;
      }

      const carry = page.locator(`${visible('result')} .result__actions .button`).first();
      if (await carry.count()) {
        if (results === 0) await page.screenshot({ path: `stats/${label}-result.png`, fullPage: true });
        await carry.click();
        results++;
        await page.waitForTimeout(25);
        continue;
      }
    }

    if (await page.locator(visible('shop')).count()) {
      // Add whatever is still affordable, cheapest-enabled first, then leave.
      // Buying *something* is the point: a shop the bot walks out of empty
      // handed exercises the screen but not the purchase.
      for (let pick = 0; pick < 6; pick++) {
        const add = page.locator(`${visible('shop')} .shop__item button:not([disabled])`).first();
        if (!(await add.count())) break;
        if ((await add.textContent()) !== 'Add') break;
        await add.click();
        await page.waitForTimeout(15);
      }
      if (shops === 0) await page.screenshot({ path: `stats/${label}-shop.png`, fullPage: true });
      await page.locator(`${visible('shop')} .shop__footer .button`).click();
      shops++;
      await page.waitForTimeout(25);
      continue;
    }

    if (await page.locator(visible('event')).count()) {
      const choice = page.locator(`${visible('event')} .event__choice:not([disabled])`).first();
      if (await choice.count()) {
        await choice.click();
        await page.waitForTimeout(25);
      }
      // The second click is the reveal being dismissed. It has to exist, or the
      // outcome is never shown and the run is stuck.
      const carry = page.locator(`${visible('event')} .event__result .button`);
      await carry.waitFor({ timeout: 5_000 });
      if (events === 0) await page.screenshot({ path: `stats/${label}-event.png`, fullPage: true });
      await carry.click();
      events++;
      await page.waitForTimeout(25);
      continue;
    }

    /*
     * The three Stage 4 screens.
     *
     * Also before the map, for the same reason the Stage 3 ones are: each
     * interrupts the map loop, and a run stalled on one would time out at the
     * summary with no clue why.
     */
    if (await page.locator(visible('target')).count()) {
      // Take the first member. Which one is a real decision, but a smoke test
      // is proving the screen routes and a click reaches the policy — the
      // *quality* of the target is the simulator's question, not this one.
      const card = page.locator(`${visible('target')} .party__member--target`).first();
      if (await card.count()) {
        if (targets === 0) await page.screenshot({ path: `stats/${label}-target.png`, fullPage: true });
        await card.click();
        targets++;
        await page.waitForTimeout(25);
        continue;
      }
    }

    /*
     * Which move it costs, and the reason this branch is not optional.
     *
     * The replacement screen is modal by design — there is no decline, so
     * `playRun` parks here until a slot comes back. A smoke run that did not
     * know about it would not fail loudly; it would sit on this screen until
     * the summary timed out, which is exactly how the screen came to be
     * missing in the first place.
     *
     * The last slot rather than the first, deliberately. `defaultMoveReplacement`
     * drops the weakest attack, which is usually an early slot, so always
     * taking slot 0 would make the smoke run agree with the old auto-answer by
     * accident and stop proving that a human choice is what got applied.
     */
    if (await page.locator(visible('replace')).count()) {
      const victim = page.locator(`${visible('replace')} .move--victim`).last();
      if (await victim.count()) {
        if (replacements === 0) await page.screenshot({ path: `stats/${label}-replace.png`, fullPage: true });
        await victim.click();
        replacements++;
        await page.waitForTimeout(25);
        continue;
      }
    }

    if (await page.locator(visible('party')).count()) {
      if (partyVisits === 0) await page.screenshot({ path: `stats/${label}-party.png`, fullPage: true });
      partyVisits++;
      await page.locator(`${visible('party')} .primary-action`).click();
      await page.waitForTimeout(25);
      continue;
    }

    if (await page.locator(visible('map')).count()) {
      /*
       * Open the party screen once, mid-run, and reorder.
       *
       * Not decoration: reordering sets the battle lead, so this is the one
       * click that proves the party screen reaches run state rather than just
       * rendering it. Done once so the second run makes the same clicks.
       */
      if (nodes === 2 && partyVisits === 0) {
        const manage = page.locator(`${visible('map')} .party__header .button`);
        if (await manage.count()) {
          await manage.click();
          await page.waitForTimeout(25);
          const lead = page.locator(`${visible('party')} .button--small:not(:disabled)`).first();
          if ((await lead.count()) && (await lead.textContent()) === 'Lead') await lead.click();
          continue;
        }
      }

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

  /*
   * Say *where* a stalled run stopped.
   *
   * The loop is bounded, so a bot that meets a screen it does not know about
   * falls out of it and then times out waiting for the summary — with a stack
   * trace pointing at the wait rather than at the screen. That has now cost two
   * debugging sessions across two stages, so the run reports which screen it
   * was looking at and what was clickable on it before it gives up.
   */
  if (!(await page.locator(visible('summary')).count())) {
    const stuck = await page.evaluate(() => {
      const screens = [...globalThis.document.querySelectorAll('.screen')].filter((screen) => !screen.hidden);
      const open = screens[0];
      return {
        screens: screens.map((screen) => screen.dataset['screen']),
        buttons: open ? [...open.querySelectorAll('button:not([disabled])')].map((b) => b.textContent?.trim()) : [],
      };
    });
    const line =
      `the run stalled on the ${stuck.screens.join('+') || '(none)'} screen ` +
      `with ${stuck.buttons.length} things to click: ${stuck.buttons.slice(0, 8).join(' | ')}`;
    // Printed as well as collected, because the wait below throws before the
    // problem list is ever rendered — which is exactly how the stall stayed
    // undiagnosed the first time.
    console.log(`  FAIL ${line}`);
    problems.push(line);
  }

  await page.waitForSelector(visible('summary'), { timeout: 20_000 });
  return {
    battles,
    nodes,
    rests,
    rewards,
    results,
    shops,
    events,
    targets,
    replacements,
    acquisitions,
    releases,
    locales,
    partyVisits,
    switches,
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
console.log(
  `  ${first.rewards} reward picks, ${first.results} cardless results, ` +
    `${first.shops} shop visits, ${first.events} events`,
);
console.log(`  ${first.locales} locales picked`);
console.log(
  `  ${first.acquisitions} acquisitions (${first.releases} releases), ${first.targets} move targets, ` +
    `${first.replacements} move replacements, ` +
    `${first.switches} forced switches, ${first.partyVisits} party screens`,
);
console.log(`  map partway through: ${JSON.stringify(first.mapStructure)}`);

console.log('\nrequired UI:');
await check('summary node list', '.summary__node');
await check('summary actions', '.summary__actions .button');
if (!first.seedLine?.includes(SEED)) problems.push('summary did not show the seed');
if (first.nodes < 3) problems.push(`only ${first.nodes} node choices — the map is not being played`);
if (first.battles < 3) problems.push(`only ${first.battles} move clicks — battles are not being played`);
// A run that won a fight and was never offered a card means the reward screen
// is not reachable, which is most of Stage 3 not being played.
if (first.rewards < 1) problems.push('no reward screen was ever shown — Stage 3 is not reachable');

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

/*
 * Stage 4's screens, and the party that makes them reachable.
 *
 * The summary's final team is the honest test of the whole stage in one number:
 * a run that ends holding more than one Pokemon has acquired at least one,
 * which means the acquisition screen routed, a decision reached `playRun`, and
 * `applyAcquisition` folded it into run state. All of that from a click.
 */
console.log('\nStage 4 UI:');
if (first.acquisitions < 1) {
  problems.push('no acquisition screen was ever shown — the party can never grow');
}
if (first.targets < 1) {
  /*
   * Renamed in Stage 4.5.1, because what this screen is for changed.
   *
   * It used to appear for items, TMs and tutors alike. Items no longer reach it
   * — they go to the backpack, and who holds one is settled on the party screen
   * — so the only thing left that asks "which member" is a taught move. A seed
   * that never offers one now legitimately never shows this screen, which is
   * why the seed above was re-scanned for one that does.
   */
  problems.push('no move-recipient screen was ever shown — taught moves are unreachable');
}
if (first.partyVisits < 1) {
  problems.push('the party screen was never opened — reorder and release are unsmoked');
}
/*
 * Stage 4.6a: every segment opens on a locale pick, so a run that reached the
 * gym must have made at least one. Zero means the screen never rendered and
 * something answered for the player — the failure `test/boundaries.test.ts`
 * guards in `core/`, checked here where a real click has to reach it.
 */
if (first.locales < 1) {
  problems.push('no locale select screen was ever shown — the region pick is unreachable');
}
if (first.teamCards < 2) {
  problems.push(`the run ended with ${first.teamCards} Pokemon — acquisition never reached run state`);
}
console.log(`  ok   party grew to ${first.teamCards}, from a starter of 1`);
console.log(
  `  ${first.switches >= 1 ? 'ok  ' : 'note'} ${first.switches} forced switch(es) answered from the bench`,
);
await check('switch panel', '.bench__member');

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
await page.click('.summary__actions .primary-action');
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
// The Stage 3 decisions have to replay identically too. A reward screen whose
// cards moved between two plays of one seed would break the seed's promise more
// visibly than anything else on screen.
same(
  'reward, cardless-result, shop and event decisions',
  [first.rewards, first.results, first.shops, first.events],
  [second.rewards, second.results, second.shops, second.events],
);
/*
 * And Stage 4's, which are the ones most likely to drift.
 *
 * An acquisition decision is the one entry in the run log stored as a *value*
 * rather than an index (see `RunDecision` in core/types.ts), so if anything
 * about replay were going to reconstruct a different party from the same
 * clicks, it would show up here first.
 */
same(
  'acquisition, release, move-target and replacement decisions',
  [first.acquisitions, first.releases, first.targets, first.replacements],
  [second.acquisitions, second.releases, second.targets, second.replacements],
);
same('switches and final party size', [first.switches, first.teamCards], [second.switches, second.teamCards]);
same('map shape partway through', first.mapStructure, second.mapStructure);
same('gyms cleared', first.count, second.count);
same('cause of death', first.cause, second.cause);

const rematchSeed = await page.inputValue('.seedbar__input');
console.log(`\nrematch seed: ${rematchSeed} ${rematchSeed === seed ? '(same, ok)' : '(CHANGED — FAIL)'}`);
if (rematchSeed !== seed) problems.push('rematch changed the seed');

/*
 * ---------------------------------------------------------------------------
 * The phone pass. Item F of Stage 4.5.2.
 * ---------------------------------------------------------------------------
 *
 * **Measured, not assumed.** The brief expected a step chain wider than the
 * viewport with no scroll affordance. There is none — `scrollWidth` equals the
 * viewport width and the chain has laid out vertically since Stage 3. What the
 * measurement actually found is that the header and the seed box occupied
 * ~350px above every screen, 40% of a 390x844 phone, so the move buttons
 * started at y=777 and the map's decision point at y=688. Nothing was mislaid
 * out; there was no room left by the time the screen got its turn.
 *
 * These assertions are here rather than in vitest because every one of them is
 * about *layout at a viewport size*, which jsdom cannot answer — it has no
 * layout engine, so `getBoundingClientRect` returns zeros and a passing test
 * would mean nothing.
 */
console.log('\nphone (390x844):');
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await phone.goto(url, { waitUntil: 'load' });
await phone.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });

const phoneCheck = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(`phone: ${label} — ${detail}`);
};

// Starter cards carry base stats, so a pick is not a coin flip.
const starterStats = await phone.locator('.starter .statline__stat').count();
phoneCheck('starter cards show base stats', starterStats >= 18, `${starterStats} cells across 3 cards`);

await phone.locator('.starter').first().click();

/*
 * The locale pick, which from Stage 4.6a sits between the starter and the map.
 *
 * Measured as well as clicked: it is a full screen on the one viewport the
 * phone pass exists for, and a card the thumb cannot reach is the same failure
 * the pass was written to catch on the map. 44px is the floor every other
 * primary control on this screen holds to.
 */
await phone.waitForSelector(`${visible('locale')} .locale`, { timeout: 20_000 });
const localeMetrics = await phone.evaluate(() => {
  const cards = [...globalThis.document.querySelectorAll('.locale')];
  const last = cards.at(-1)?.getBoundingClientRect();
  return {
    cards: cards.length,
    shortest: Math.min(...cards.map((card) => Math.round(card.getBoundingClientRect().height))),
    lastBottom: last ? Math.round(last.bottom) : 0,
    innerHeight: globalThis.window.innerHeight,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    innerWidth: globalThis.window.innerWidth,
  };
});
phoneCheck(
  'locale cards are thumb-sized',
  localeMetrics.shortest >= 44,
  `shortest ${localeMetrics.shortest}px across ${localeMetrics.cards} cards`,
);
phoneCheck(
  'every locale is on screen without scrolling',
  localeMetrics.lastBottom <= localeMetrics.innerHeight,
  `last card ends at y=${localeMetrics.lastBottom} of ${localeMetrics.innerHeight}`,
);
phoneCheck(
  'locale select does not scroll sideways',
  localeMetrics.scrollWidth <= localeMetrics.innerWidth,
  `${localeMetrics.scrollWidth}px into ${localeMetrics.innerWidth}px`,
);

await phone.locator('.locale').first().click();
await phone.waitForSelector(`${visible('map')}`);

const mapMetrics = await phone.evaluate(() => {
  const nodes = globalThis.document.querySelector('.step--current .step__nodes');
  const rect = nodes?.getBoundingClientRect();
  return {
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    innerWidth: globalThis.window.innerWidth,
    innerHeight: globalThis.window.innerHeight,
    offered: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom) } : null,
  };
});

phoneCheck(
  'no horizontal overflow on the map',
  mapMetrics.scrollWidth <= mapMetrics.innerWidth,
  `${mapMetrics.scrollWidth}px in ${mapMetrics.innerWidth}px`,
);
phoneCheck(
  'the offered nodes are fully visible without scrolling',
  Boolean(mapMetrics.offered) && mapMetrics.offered.bottom <= mapMetrics.innerHeight,
  mapMetrics.offered ? `cards end at y=${mapMetrics.offered.bottom} of ${mapMetrics.innerHeight}` : 'no current step',
);

/*
 * The party threat readout on the map, measured rather than assumed.
 *
 * The requirement is that it must not crowd the offered node cards, which Item
 * F fought to get above the fold on a 390x844 phone. Two things make that
 * true and both are checked here rather than reasoned about: it is rendered
 * *below* the step chain, so it is not in the cards' way at any open state,
 * and it ships collapsed, so the closed height is a summary line.
 *
 * The interesting number is the pair before and after opening it. If the cards
 * move at all when the disclosure expands, the readout is in the wrong place
 * in the document and no default open state would save it.
 */
const threatMetrics = await phone.evaluate(() => {
  const details = globalThis.document.querySelector('.screen--map .threats');
  if (!details) return null;

  const cards = () => globalThis.document.querySelector('.step--current .step__nodes')?.getBoundingClientRect();
  const before = cards();
  const openByDefault = details.open;

  details.open = true;
  const after = cards();
  const readout = details.getBoundingClientRect();
  const chips = details.querySelectorAll('.threats__item .type').length;
  const hasNone = Boolean(details.querySelector('.threats__none'));
  details.open = false;
  const closed = details.getBoundingClientRect();

  return {
    openByDefault,
    chips,
    hasNone,
    cardsBefore: before ? Math.round(before.bottom) : null,
    cardsAfter: after ? Math.round(after.bottom) : null,
    openTop: Math.round(readout.top),
    openHeight: Math.round(readout.height),
    closedHeight: Math.round(closed.height),
  };
});

if (!threatMetrics) {
  problems.push('phone: the map has no threat readout');
} else {
  phoneCheck(
    'the map carries the threat readout, collapsed',
    threatMetrics.openByDefault === false,
    `closed height ${threatMetrics.closedHeight}px, open ${threatMetrics.openHeight}px at y=${threatMetrics.openTop}`,
  );
  phoneCheck(
    'expanding the readout does not move the offered node cards',
    threatMetrics.cardsBefore !== null && threatMetrics.cardsBefore === threatMetrics.cardsAfter,
    `cards end at y=${threatMetrics.cardsBefore} closed, y=${threatMetrics.cardsAfter} open`,
  );
  phoneCheck(
    'the readout says something rather than drawing an empty box',
    threatMetrics.chips > 0 || threatMetrics.hasNone,
    `${threatMetrics.chips} type badges`,
  );
}

/*
 * And the same readout on the party screen, where it is open by default and is
 * the first thing under the heading.
 */
await phone.locator(`${visible('map')} .party__header .button`).first().click().catch(() => undefined);
await phone.waitForTimeout(50);
if (await phone.locator(visible('party')).count()) {
  const partyMetrics = await phone.evaluate(() => {
    const readout = globalThis.document.querySelector('.screen--party .threats');
    if (!readout) return null;
    const rect = readout.getBoundingClientRect();
    return {
      tag: readout.tagName,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      innerHeight: globalThis.window.innerHeight,
      chips: readout.querySelectorAll('.threats__item .type').length,
      hasNone: Boolean(readout.querySelector('.threats__none')),
    };
  });

  if (!partyMetrics) {
    problems.push('phone: the party screen has no threat readout');
  } else {
    phoneCheck(
      'the party screen shows the readout open, above the fold',
      partyMetrics.tag === 'SECTION' && partyMetrics.bottom <= partyMetrics.innerHeight,
      `y=${partyMetrics.top}..${partyMetrics.bottom} of ${partyMetrics.innerHeight}`,
    );
    phoneCheck(
      'and it lists the party\'s unanswered types',
      partyMetrics.chips > 0 || partyMetrics.hasNone,
      `${partyMetrics.chips} type badges`,
    );
  }
  await phone.locator(`${visible('party')} .primary-action`).first().click();
  await phone.waitForSelector(visible('map'));
}

// Into a fight, for the move grid and the stat panels.
const phoneNode = phone.locator(`${visible('map')} .step--current .node`).first();
if (await phoneNode.count()) {
  await phoneNode.click();
  await phone.waitForTimeout(600);
}

if (await phone.locator(visible('battle')).count()) {
  const battle = await phone.evaluate(() => {
    const buttons = [...globalThis.document.querySelectorAll('.moves .move')];
    const rects = buttons.map((b) => b.getBoundingClientRect());
    const grid = globalThis.document.querySelector('.moves');
    const columns = grid ? globalThis.getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    const panels = [...globalThis.document.querySelectorAll('.panel')].map((p) => p.getBoundingClientRect());
    return {
      innerHeight: globalThis.window.innerHeight,
      count: buttons.length,
      columns,
      minHeight: rects.length ? Math.round(Math.min(...rects.map((r) => r.height))) : 0,
      movesBottom: rects.length ? Math.round(Math.max(...rects.map((r) => r.bottom))) : 0,
      panelsBottom: panels.length ? Math.round(Math.max(...panels.map((r) => r.bottom))) : 0,
      // PP and effectiveness live on the button face, not behind a hover.
      withPp: globalThis.document.querySelectorAll('.moves .move__pp').length,
      scrollWidth: globalThis.document.documentElement.scrollWidth,
      innerWidth: globalThis.window.innerWidth,
    };
  });

  phoneCheck('four move buttons in a 2x2 grid', battle.count === 4 && battle.columns === 2,
    `${battle.count} buttons, ${battle.columns} columns`);
  phoneCheck('move buttons meet the 44px touch target', battle.minHeight >= 44, `${battle.minHeight}px`);
  phoneCheck('every move button shows PP', battle.withPp === battle.count, `${battle.withPp}/${battle.count}`);
  phoneCheck('both stat panels are above the fold', battle.panelsBottom <= battle.innerHeight,
    `panels end at y=${battle.panelsBottom} of ${battle.innerHeight}`);
  phoneCheck('the move grid is above the fold', battle.movesBottom <= battle.innerHeight,
    `moves end at y=${battle.movesBottom} of ${battle.innerHeight}`);
  phoneCheck('no horizontal overflow in a battle', battle.scrollWidth <= battle.innerWidth,
    `${battle.scrollWidth}px in ${battle.innerWidth}px`);
  await phone.screenshot({ path: 'stats/phone-battle.png' });
} else {
  problems.push('phone: never reached a battle');
}

await browser.close();
server.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\nsmoke test passed');
