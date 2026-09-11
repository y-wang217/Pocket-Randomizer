/**
 * Shared browser driving for the visual identity stages.
 *
 * Serves `dist/`, launches the pinned Chromium at a phone viewport, and plays
 * the app with the same reading-the-screen bot `scripts/smoke.mjs` uses, so a
 * measurement taken on `main` and one taken on a stage branch are of the same
 * run, reached by the same clicks. Nothing here asserts; the scripts that
 * import it do.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

export const PHONE = { width: 390, height: 844 };

/** Serve a built directory on a free port. Returns the base URL and a closer. */
export async function serve(dir = join(process.cwd(), 'dist')) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
    const file = join(dir, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const PINNED = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'];

export async function launch(options = {}) {
  const executablePath = PINNED.find((candidate) => existsSync(candidate));
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), ...options });
}

export const visible = (name) => `.screen[data-screen="${name}"]:not([hidden])`;

/** Which screen is open, or null. */
export async function openScreen(page) {
  return page.evaluate(() => {
    const screen = [...globalThis.document.querySelectorAll('.screen')].find((el) => !el.hidden);
    return screen ? screen.dataset.screen : null;
  });
}

/** The starter with the most HP, ties to the leftmost card. Same as smoke. */
async function bulkiestStarter(page) {
  const cards = page.locator('.starter');
  const count = await cards.count();
  let best = 0;
  let bestHp = -1;
  for (let i = 0; i < count; i++) {
    const meta = (await cards.nth(i).locator('.starter__meta').textContent()) ?? '';
    const hp = Number(/(\d+)\s*HP/.exec(meta)?.[1] ?? 0);
    if (hp > bestHp) {
      bestHp = hp;
      best = i;
    }
  }
  return cards.nth(best);
}

async function hardestMove(page) {
  const buttons = page.locator(`${visible('battle')} .move:not(:disabled)`);
  const count = await buttons.count();
  if (count === 0) return null;
  let best = 0;
  let bestPower = -1;
  for (let i = 0; i < count; i++) {
    // 4.7 puts a status move's effect line where its base power would be, so
    // a button with no `.move__power` is a status move: power 0, never chosen
    // over a damaging move.
    const powerNode = buttons.nth(i).locator('.move__power');
    const text = (await powerNode.count()) ? ((await powerNode.textContent()) ?? '') : '';
    const power = Number(/^(\d+)/.exec(text.trim())?.[1] ?? 0);
    if (power > bestPower) {
      bestPower = power;
      best = i;
    }
  }
  return buttons.nth(best);
}

async function chooseNode(page) {
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

/**
 * Advance the run by one decision, the way the smoke bot would.
 *
 * Returns the name of the screen it acted on, or null when nothing was
 * clickable (a transition in flight). The caller decides when to stop; this
 * only knows how to answer whichever screen is up.
 */
/**
 * Close an open tooltip before acting. **Added at patch 4.7.2.**
 *
 * The tooltip layer is tap-to-open, tap-outside-or-Escape-to-dismiss, and a
 * real player's next tap dismisses it whether or not it lands on anything.
 * Playwright's actionability check does not work that way: it hit-tests the
 * point first and *refuses to dispatch* when the panel covers it, so the tap
 * that would have dismissed the panel never happens and every retry sees the
 * same panel. The bot then spends its timeout on a screen a player would have
 * walked straight through.
 *
 * This is reached rather than theoretical. `stepOnce` clicks a card's centre,
 * and on the result screen that centre is a member card's archetype chip — so
 * the run opens `Stat shapes` on its way past, carries it to the item-target
 * screen, and stalls there against its own tooltip. It cost a `visual-v0`
 * failure that read as a flake before it was traced.
 *
 * Escape rather than a click on the backdrop: it is the dismissal the layer
 * documents, it cannot land on a trigger and re-open something else, and it
 * leaves the pointer where it was so no hover state changes under a
 * measurement.
 */
async function dismissTooltip(page) {
  const open = await page.evaluate(() => {
    const tip = globalThis.document.querySelector('.tip');
    return Boolean(tip && !tip.hidden);
  });
  if (!open) return;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(30);
}

/**
 * Act, then **park the pointer**. Patch 4.7.2.
 *
 * `dismissTooltip` above closes a panel a *click* opened. This closes the other
 * half, which is subtler: the tooltip layer offers hover as a desktop
 * enhancement over its tap interaction, Playwright drives a desktop Chromium
 * with a real mouse, and the pointer stays wherever the last click left it. So
 * the bot sits hovering whatever is under that point and a panel opens with
 * nobody having asked — a state no phone can reach, which is the device every
 * one of these measurements is taken at.
 *
 * Reached rather than theoretical, and it is why this wraps the switch instead
 * of living in one branch: after 4.7.2 shortened the map, the pointer's resting
 * place after a node click landed on a party panel's ability chip, and
 * `visual-v3`'s "every visible control is what a tap at its centre lands on"
 * failed on the *battle* screen two steps later, against a panel opened on the
 * map. The parking is what stops the hover, and `mouse.move(0, 0)` is the move
 * `visual-v0`, `visual-v2` and `contrast.mjs` already make before they measure,
 * each with a comment saying why.
 */
export async function stepOnce(page) {
  const screen = await stepOnceUnparked(page);
  await page.mouse.move(0, 0);
  return screen;
}

async function stepOnceUnparked(page) {
  await dismissTooltip(page);
  const screen = await openScreen(page);
  switch (screen) {
    case 'starter':
      await (await bulkiestStarter(page)).click();
      return screen;
    case 'locale': {
      const card = page.locator(`${visible('locale')} .locale`).last();
      if (await card.count()) await card.click();
      return screen;
    }
    case 'battle': {
      const forced = page.locator(`${visible('battle')} .bench[data-forced="true"] .bench__member:not(:disabled)`);
      if (await forced.count()) {
        await forced.first().click();
        return screen;
      }
      const move = await hardestMove(page);
      if (move) await move.click();
      else await page.waitForTimeout(40);
      return screen;
    }
    case 'result': {
      const card = page.locator(`${visible('result')} .reward`).first();
      if (await card.count()) {
        /*
         * The name, not the card. **Same rule as `target` and `replace` below,
         * extended here at 4.7.2 step 5 for the same reason.**
         *
         * A reward card's centre is inside the move card it carries, and from
         * step 5 that region holds the "what does this do?" expander — which
         * stops the event by design, so a click on the geometric centre
         * explains a move and picks nothing. The run stalled on `result` for
         * 900 steps before this line named a target that is always the card
         * and never a control inside it.
         */
        // Near the top-left corner rather than at the centre: every reward
        // kind has its own chrome there, and `.reward__name` is empty on some
        // of them — an empty span is not clickable, which is a second way to
        // stall on the same screen.
        await card.click({ position: { x: 8, y: 8 } });
        return screen;
      }
      const capture = page.locator(`${visible('result')} .result__capture`);
      if ((await capture.count()) && !(await capture.first().isHidden())) {
        const take = capture.locator('.acquire__actions .primary-action, .acquire__actions .button--primary');
        if (await take.count()) await take.first().click();
        else {
          const release = capture.locator('.button--danger').last();
          if (await release.count()) {
            await release.click();
            // The confirm is the shared band since V2: its primary commits.
            await page.locator('.confirm-band .primary-action').click();
          } else await capture.locator('.acquire__actions .button').last().click();
        }
        return screen;
      }
      const carry = page.locator(`${visible('result')} .result__actions .button`).first();
      if (await carry.count()) await carry.click();
      return screen;
    }
    case 'shop': {
      for (let pick = 0; pick < 6; pick++) {
        const add = page.locator(`${visible('shop')} .shop__item button:not([disabled])`).first();
        if (!(await add.count())) break;
        if ((await add.textContent()) !== 'Add') break;
        await add.click();
        await page.waitForTimeout(15);
      }
      await page.locator(`${visible('shop')} .shop__footer .button`).click();
      return screen;
    }
    case 'event': {
      const choice = page.locator(`${visible('event')} .event__choice:not([disabled])`).first();
      if (await choice.count()) {
        await choice.click();
        await page.waitForTimeout(25);
      }
      const carry = page.locator(`${visible('event')} .event__result .button`);
      await carry.waitFor({ timeout: 5_000 });
      await carry.click();
      return screen;
    }
    /*
     * **Both of these click the card's *name*, not the card. Patch 4.7.2.**
     *
     * `card.click()` targets the element's centre, and on both of these screens
     * the centre of the card is a chip — the archetype label on a member card,
     * a type or category badge on a move card. A chip is a tooltip trigger, and
     * `ui/tooltips.ts` calls `stopPropagation` on a trigger click precisely so
     * that tapping a chip explains the chip instead of choosing the option it
     * sits on. That is the interaction working; what it means for a bot aiming
     * at geometric centres is that the click opens a panel and selects nothing,
     * forever.
     *
     * Measured rather than guessed: a run stalled on `replace` from step 20 to
     * step 600, opening and closing the same tooltip, and it reproduces against
     * `main`'s stylesheet as well as this patch's.
     *
     * The name line is the right target because it is the one part of either
     * card guaranteed to be present, non-empty and never a trigger. The click
     * bubbles to the button exactly as a tap on it would.
     */
    case 'target': {
      const card = page.locator(`${visible('target')} .party__member--target`).first();
      if (!(await card.count())) return screen;
      const name = card.locator('.panel__name').first();
      await ((await name.count()) ? name : card).click();
      return screen;
    }
    case 'replace': {
      const victim = page.locator(`${visible('replace')} .move--victim`).last();
      if (!(await victim.count())) return screen;
      const name = victim.locator('.move__name').first();
      await ((await name.count()) ? name : victim).click();
      return screen;
    }
    case 'party':
      await page.locator(`${visible('party')} .primary-action, ${visible('party')} .button--primary`).first().click();
      return screen;
    case 'pre-gym': {
      // 4.7's lead pick, answered the way the headless runs answer `chooseLead`:
      // confirm the current lead. The confirm submits the lowest living slot, so
      // the bot's run and a headless run walk the same party order. Before the
      // confirm existed the bot had to hand the lead to the lowest *enabled*
      // slot, because slot 0's own button is disabled ("Leading") — which on a
      // party of one left no enabled control at all.
      const confirm = page.locator(`${visible('pre-gym')} .pre-gym__confirm:not(:disabled)`);
      if (await confirm.count()) await confirm.first().click();
      else await page.waitForTimeout(40);
      return screen;
    }
    case 'map': {
      const node = await chooseNode(page);
      if (node) await node.click();
      else await page.waitForTimeout(40);
      return screen;
    }
    default:
      await page.waitForTimeout(40);
      return screen;
  }
}

/**
 * Play until `predicate(screen, page)` is true, or `maxSteps` decisions pass.
 * Checked *before* each step, so the run stops on the screen asked for.
 */
export async function playUntil(page, predicate, maxSteps = 600) {
  for (let step = 0; step < maxSteps; step++) {
    const screen = await openScreen(page);
    if (screen && (await predicate(screen, page))) return screen;
    await stepOnce(page);
    await page.waitForTimeout(25);
  }
  throw new Error(`playUntil: gave up after ${maxSteps} steps on ${await openScreen(page)}`);
}

/** Open the app on a seed, at the phone viewport, and wait for the starters. */
/**
 * The settings a fresh store would hold with the tutorial already skipped.
 *
 * The coach marks (overnight Branch 3) show on a first launch, which is what
 * every fresh browser context is. A mark is a tappable panel over the screen,
 * and a scripted click that lands on it advances the tutorial instead of the
 * thing it meant to tap — so every harness context starts with the tutorial
 * skipped unless a test asks for it (`openApp(..., { tutorial: true })`), and
 * the tutorial's own browser test is the one that asks.
 */
export const TUTORIAL_SKIPPED_SETTINGS = JSON.stringify({ verbosity: 'detailed', tutorial: { skipped: true, seen: [] } });

/** Seed a context's storage so the app's first launch is a returning one, tutorial-wise. */
export async function skipTutorialIn(context) {
  await context.addInitScript((settings) => {
    try {
      if (!globalThis.localStorage.getItem('gymrun.settings')) globalThis.localStorage.setItem('gymrun.settings', settings);
    } catch {
      // Storage unavailable: the app falls back to defaults and the marks show.
    }
  }, TUTORIAL_SKIPPED_SETTINGS);
}

export async function openApp(browser, url, seed, viewport = PHONE, contextOptions = {}) {
  const { tutorial = false, ...rest } = contextOptions;
  const context = await browser.newContext({ viewport, ...rest });
  if (!tutorial) await skipTutorialIn(context);
  const page = await context.newPage();
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // The item icon sheet lives on Showdown's CDN; a sandbox without a route
    // to it logs a failed load. Not the app's problem.
    if (/Failed to load resource/.test(msg.text()) && /play\.pokemonshowdown\.com/.test(msg.location()?.url ?? '')) return;
    problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(`${url}/#seed=${seed}`, { waitUntil: 'load' });
  await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
  // Fonts, if any are declared, must be in before anything is measured.
  await page.evaluate(() => globalThis.document.fonts.ready);
  return { page, context, problems };
}

async function measureScreen(page, name, decisionSelector) {
  // The pointer rests where the last click landed. A card under it wears its
  // hover lift, which is 1px of translate, so park it and let the 120ms
  // transition settle before reading a single box.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  return page.evaluate(
    ([screenSelector, decision]) => {
      const screen = globalThis.document.querySelector(screenSelector);
      const nodes = [...globalThis.document.querySelectorAll(decision)];
      const rects = nodes.map((node) => node.getBoundingClientRect());
      const r = (n) => Math.round(n * 100) / 100;
      const scrollY = globalThis.window.scrollY;
      return {
        screenHeight: r(screen.getBoundingClientRect().height),
        scrollHeight: globalThis.document.documentElement.scrollHeight,
        decisionCount: nodes.length,
        decisionTop: rects.length ? r(Math.min(...rects.map((x) => x.top + scrollY))) : null,
        decisionBottom: rects.length ? r(Math.max(...rects.map((x) => x.bottom + scrollY))) : null,
      };
    },
    [visible(name), decisionSelector],
  );
}

/**
 * The two guarded screens at 390x844: the map with the current step's offered
 * nodes, and a battle with four move buttons. Same seed, same clicks, so the
 * only variable between two builds is the stylesheet.
 */
export async function measureGuardedScreens(url, browser, seed = 'SMOKE24') {
  const { page, context, problems } = await openApp(browser, url, seed);
  const result = { seed, viewport: { ...PHONE } };

  await playUntil(page, (screen) => screen === 'map');
  await page.waitForTimeout(100);
  result.map = await measureScreen(page, 'map', `${visible('map')} .step--current .node`);

  await playUntil(page, (screen) => screen === 'battle');
  // The HP bar transition and the swap beat settle well inside this.
  await page.waitForTimeout(600);
  result.battle = await measureScreen(page, 'battle', `${visible('battle')} .moves .move`);

  await context.close();
  if (problems.length) result.problems = problems;
  return result;
}
