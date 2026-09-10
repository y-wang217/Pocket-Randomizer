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
    const text = (await buttons.nth(i).locator('.move__power').textContent()) ?? '';
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
export async function stepOnce(page) {
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
        await card.click();
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
            await release.click();
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
    case 'target': {
      const card = page.locator(`${visible('target')} .party__member--target`).first();
      if (await card.count()) await card.click();
      return screen;
    }
    case 'replace': {
      const victim = page.locator(`${visible('replace')} .move--victim`).last();
      if (await victim.count()) await victim.click();
      return screen;
    }
    case 'party':
      await page.locator(`${visible('party')} .primary-action, ${visible('party')} .button--primary`).first().click();
      return screen;
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
export async function openApp(browser, url, seed, viewport = PHONE, contextOptions = {}) {
  const context = await browser.newContext({ viewport, ...contextOptions });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
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
