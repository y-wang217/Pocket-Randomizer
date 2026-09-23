/**
 * Shared browser driving for the visual identity stages.
 *
 * Serves `dist/`, launches the pinned Chromium at a phone viewport, and plays
 * the app with the same reading-the-screen bot `scripts/smoke.mjs` uses, so a
 * measurement taken on `main` and one taken on a stage branch are of the same
 * run, reached by the same clicks. Nothing here asserts; the scripts that
 * import it do.
 */
import { chromium, devices, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { notFirstLaunch } from '../first-launch.mjs';

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

/**
 * The two engines the browser suite runs against. **The iOS animations patch.**
 *
 * Until this patch every browser assertion in the repo was made in desktop
 * Chromium at a 390px window, and the phrase "the phone viewport" meant a
 * window that size and nothing else — no touch, no Safari user agent, no pixel
 * density. Two defects lived inside exactly that blind spot, one of them since
 * V5.5: the battle motion system has never run on iOS, and the end-of-fight
 * hold read its duration back out of a stylesheet in a form only Blink
 * produces. A suite that verifies an animation is wired in the one engine
 * where it already works is not verifying the animation.
 *
 * So the engine is an axis rather than a constant. `GYMRUN_ENGINE` selects it,
 * `npm run test:webkit` is the second CI leg, and every test body is written
 * once: a test reads `ENGINE` when it has to say something engine-specific and
 * otherwise does not know which one it is running in.
 */
export const ENGINES = ['chromium', 'webkit'];

/** Which engine this process is driving. `chromium` unless asked otherwise. */
export const ENGINE = ENGINES.includes(process.env.GYMRUN_ENGINE) ? process.env.GYMRUN_ENGINE : 'chromium';

/**
 * The device the bug was reported on, minus its width. **The iOS patch.**
 *
 * Playwright's own `iPhone 14 Pro Max` descriptor, which carries the three
 * properties that are part of the reproduction — `hasTouch`, the Mobile Safari
 * user agent, and `deviceScaleFactor: 3` — and one that is not: a 430x932
 * viewport.
 *
 * **The width is overridden back to `PHONE` deliberately, and this is the one
 * place to argue with it.** Every measurement in `docs/visual/baseline/`,
 * every height in `heights.json`, `scripts/smoke.mjs`'s overflow assertion and
 * all 22 browser test files are pinned at 390x844. 390 is the *narrower* of
 * the two, so a layout that fits it fits a Pro Max, and re-pinning the corpus
 * to 430 would move every recorded number for a reason that has nothing to do
 * with either defect — neither of which is width-dependent. What the
 * descriptor is here for is the other three properties, and it brings all of
 * them.
 */
export const IPHONE = { ...devices['iPhone 14 Pro Max'], viewport: PHONE };

/**
 * The context options one engine wants for a given viewport.
 *
 * Chromium keeps exactly what it always had — a bare viewport — so every
 * number this repo has ever recorded still means what it meant. WebKit adds
 * the descriptor on top, at whatever size the caller asked for.
 */
export function contextFor(viewport = PHONE, engine = ENGINE) {
  return engine === 'webkit' ? { ...IPHONE, viewport } : { viewport };
}

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

const PINNED = {
  chromium: ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'],
  // WebKit ships as a launcher plus a bundle and cannot be pointed at a bare
  // binary the way Chromium can, so it resolves through Playwright's own
  // registry. Nothing is pinned here; `npx playwright install webkit` is what
  // puts it on the box.
  webkit: [],
};

const ENGINE_API = { chromium, webkit };

export async function launch(options = {}, engine = ENGINE) {
  const executablePath = (PINNED[engine] ?? []).find((candidate) => existsSync(candidate));
  /*
   * `GYMRUN_PROXY` routes the browser through an egress proxy, with the local
   * harness bypassed. **The browser suite CI patch.** A sandboxed box has no
   * direct route to Showdown's sprite CDN, so every sprite on it is
   * `data-missing` and a panel that has a sprite behind a chip on Actions has
   * none here; `visual-chips` samples exactly that. With the box's proxy named
   * the sprites load and the two environments measure the same pixels.
   * Certificate errors are ignored only under this flag, because a proxy that
   * re-signs TLS is the whole point of it.
   */
  const proxy = process.env.GYMRUN_PROXY
    ? { proxy: { server: process.env.GYMRUN_PROXY, bypass: '127.0.0.1,localhost' }, args: ['--ignore-certificate-errors'] }
    : {};
  return ENGINE_API[engine].launch({ ...(executablePath ? { executablePath } : {}), ...proxy, ...options });
}

export const visible = (name) => `.screen[data-screen="${name}"]:not([hidden])`;

/** Which screen is open, or null. */
export async function openScreen(page) {
  return page.evaluate(() => {
    const screen = [...globalThis.document.querySelectorAll('.screen')].find((el) => !el.hidden);
    return screen ? screen.dataset.screen : null;
  });
}

/*
 * **The walk waits on state, not on the clock.** The browser suite CI patch,
 * `docs/spec/gymrun-patch-browser-suite-ci.md`, on top of M2.0.
 *
 * M2.0 (`docs/generation.md` section 53) fixed the two defects that made the
 * budget count laps as decisions: `stepOnce` now acts only on the screen its
 * caller decided about and returns null when it clicked nothing, and
 * `playUntil` counts only laps that acted, under a wall-clock deadline. What
 * it left in place was the sleeps: `waitForTimeout(40)` in the branches that
 * found nothing to click, 16ms between laps, 15ms and 25ms inside the shop and
 * event branches. Each is a guess at how long the app takes, and on a
 * saturated runner the guess is wrong in the one direction that costs time.
 *
 * The app exposes no busy flag, so "finished reacting" is read off the DOM
 * itself: a `MutationObserver` on the document stamps the time of the last
 * mutation, and `settle` resolves once a screen is visible and nothing has
 * mutated for `quietMs`. Beats and transitions in this UI are CSS; what the
 * observer sees is the app writing attributes and text at their boundaries,
 * which is exactly the moment a player could act again. `waitForMutation` is
 * the other half, for a step that found nothing to click: wait for the app to
 * do *anything*, rather than for 40ms to pass.
 *
 * Both are bounded, and a bound expiring is not an error here: the walk goes
 * on and `playUntil`'s deadline or the test's timeout is the stall guard,
 * exactly as before. A driver with no `waitForFunction` is not a browser
 * (`test/visual-walk.test.ts` drives these with a fake page) and has nothing
 * to settle, so both return at once there.
 */
const QUIET_MS = 60;
const SETTLE_TIMEOUT_MS = 8_000;
const MUTATION_TIMEOUT_MS = 5_000;

/** Install the observer once per page; Playwright serialises this to run there. */
function observe() {
  const w = globalThis;
  if (!w.__gymrunWalk) {
    const state = { last: globalThis.performance.now() };
    new globalThis.MutationObserver(() => {
      state.last = globalThis.performance.now();
    }).observe(globalThis.document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    w.__gymrunWalk = state;
  }
  return w.__gymrunWalk.last;
}

const isBrowser = (page) => typeof page.waitForFunction === 'function';

async function boundedWait(page, fn, arg, timeout) {
  if (!isBrowser(page)) return false;
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 16 });
    return true;
  } catch (error) {
    if (!/timeout/i.test(String(error?.message))) throw error;
    return false;
  }
}

/** Resolve once a screen is visible and the DOM has been quiet for `quietMs`. */
export async function settle(page, { quietMs = QUIET_MS, timeout = SETTLE_TIMEOUT_MS } = {}) {
  if (!isBrowser(page)) return false;
  await page.evaluate(observe);
  return boundedWait(
    page,
    (quiet) => {
      const screen = [...globalThis.document.querySelectorAll('.screen')].find((el) => !el.hidden);
      if (!screen) return false;
      return globalThis.performance.now() - globalThis.__gymrunWalk.last >= quiet;
    },
    quietMs,
    timeout,
  );
}

/** Resolve once anything in the document mutates, or `timeout` passes. */
async function waitForMutation(page, timeout = MUTATION_TIMEOUT_MS) {
  if (!isBrowser(page)) return false;
  const mark = await page.evaluate(observe);
  return boundedWait(page, (since) => globalThis.__gymrunWalk.last > since, mark, timeout);
}

/** The starter with the most HP, ties to the leftmost card. Same as smoke. */
async function bulkiestStarter(page) {
  const cards = page.locator('.starter');
  const count = await cards.count();
  let best = 0;
  let bestHp = -1;
  for (let i = 0; i < count; i++) {
    const meta = (await cards.nth(i).locator('.starter__hp-value').textContent()) ?? '';
    const hp = Number(/(\d+)/.exec(meta)?.[1] ?? 0);
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
 *
 * **That null is the contract, and until M2.0 the code did not keep it.**
 * Every branch returned the screen whether or not it had clicked anything, so
 * a caller counting steps counted the waiting as progress and a walk could
 * exhaust its budget without having made a single decision. The branches that
 * wait now return null, as this comment always said they did.
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
  await boundedWait(
    page,
    () => {
      const tip = globalThis.document.querySelector('.tip');
      return !tip || tip.hidden;
    },
    undefined,
    2_000,
  );
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
export async function stepOnce(page, expected) {
  const screen = await stepOnceUnparked(page, expected);
  // Nothing clickable: wait for the app to do something. Then, either way,
  // wait for it to finish doing it before anyone reads the screen.
  if (screen === null) await waitForMutation(page);
  await settle(page);
  await page.mouse.move(0, 0);
  return screen;
}

async function stepOnceUnparked(page, expected) {
  await dismissTooltip(page);
  const screen = await openScreen(page);
  /*
   * **Act on the screen the caller decided about, never on whatever replaced
   * it.** M2.0.
   *
   * A caller reads the screen, decides whether it is the one it wanted, and
   * then calls this — which reads the screen *again*. Between those two reads
   * the app can move on its own: the battle outro resolves on a `setTimeout`,
   * and `router.show` is synchronous, so the switch lands whole inside the
   * gap. The caller then decides about one screen and this steps off another,
   * and the screen it was waiting for is consumed without its predicate ever
   * having been asked about it.
   *
   * That is the walk's one real race, and it is load-sensitive for a reason
   * that is not the app's fault: the gap is two CDP round trips wide, the
   * timer fires on wall-clock, and a saturated box stretches the former while
   * leaving the latter alone. It is also why throttling the *page* does not
   * reproduce it — that slows the app and narrows the gap.
   *
   * `expected` closes it. A caller that has already decided passes what it
   * decided about; if the app has moved since, this acts on nothing and says
   * so, and the caller re-reads and decides again. A caller with no opinion
   * omits it and gets the old behaviour exactly.
   */
  if (expected !== undefined && screen !== expected) return null;
  switch (screen) {
    case 'starter':
      await (await bulkiestStarter(page)).click();
      return screen;
    case 'locale': {
      const card = page.locator(`${visible('locale')} .locale`).last();
      if (!(await card.count())) return null;
      await card.click();
      return screen;
    }
    case 'battle': {
      const forced = page.locator(`${visible('battle')} .bench[data-forced="true"] .bench__member:not(:disabled)`);
      if (await forced.count()) {
        await forced.first().click();
        return screen;
      }
      const move = await hardestMove(page);
      /*
       * The name line, not the button's centre. **Same rule as `target`,
       * `replace` and `result`, extended here at 4.8.0.2 for the same
       * reason.** A move button's centre falls in `.move__meta`, and which
       * chip sits there depends on the face: the monospace stack's wider
       * chips put the band chip under Electroweb's centre on SEED-B's first
       * battle, a chip is a tooltip trigger that stops the event by design,
       * and the walk opened the same tooltip for 900 steps. The name is
       * always present and never a trigger, and the click bubbles to the
       * button exactly as a tap on it would.
       */
      // Mid-turn: the buttons are disabled while the beats run. Nothing was
      // spent, so this is not a step; `stepOnce` waits for the beat to move.
      if (!move) return null;
      await move.locator('.move__name').first().click();
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
      if (!(await carry.count())) return null;
      await carry.click();
      return screen;
    }
    case 'shop': {
      for (let pick = 0; pick < 6; pick++) {
        const add = page.locator(`${visible('shop')} .shop__item button:not([disabled])`).first();
        if (!(await add.count())) break;
        if ((await add.textContent()) !== 'Add') break;
        await add.click();
        await settle(page);
      }
      await page.locator(`${visible('shop')} .shop__footer .button`).click();
      return screen;
    }
    case 'event': {
      const choice = page.locator(`${visible('event')} .event__choice:not([disabled])`).first();
      if (await choice.count()) {
        await choice.click();
        await settle(page);
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
     *
     * **The teach target is the exception since M3.3.** Its card is the party
     * row now and is not a control at all: the row carries a fold toggle, six
     * stat labels and four inspect triggers, and nesting those in a `<button>`
     * would be invalid, so the control is a sibling. A click on the card lands
     * on a card and the walk stalls — which is exactly what it did, for 900
     * steps, until this was changed to press what a player presses.
     */
    case 'target': {
      const choose = page.locator(`${visible('target')} .target__choose`).first();
      if (!(await choose.count())) return null;
      await choose.click();
      return screen;
    }
    case 'replace': {
      const victim = page.locator(`${visible('replace')} .move--victim`).last();
      if (!(await victim.count())) return null;
      const name = victim.locator('.move__name').first();
      await ((await name.count()) ? name : victim).click();
      /*
       * **And then answer the confirm, because M2.3 put one here.**
       *
       * Tapping a victim used to commit the replacement. It opens the shared
       * band now — two full cards, the question, and a primary that commits —
       * which is the item's whole point: the chip gave up PP and the band, and
       * the confirm is where they come back.
       *
       * A walker that clicked the chip and moved on would leave a modal up,
       * and the band is `aria-modal` with a scrim, so *every* later click is
       * intercepted by it. That is not a slow walk, it is a stuck one: the
       * smoke run spent its timeout retrying a click the dialog was eating.
       *
       * The same shape the `result` branch already handles for a full-party
       * release, and the selector is the same one.
       */
      const commit = page.locator('.confirm-band .primary-action');
      if (await commit.count()) await commit.first().click();
      return screen;
    }
    case 'party': {
      /*
       * Spend a TM when one is offered here, and leave otherwise.
       *
       * The party screen is the only route to the `target` and `replace`
       * screens now — a move is stowed as a TM and taught out of an item plan
       * at a rest or a shop — so a walk that always pressed the way out would
       * never reach either, and every case that measures them would pass by
       * never arriving. Same rule as the smoke run's branch.
       */
      const teach = page.locator(`${visible('party')} .tms__item .button--small`).first();
      if ((await teach.count()) && (await teach.textContent()) === 'Teach') {
        await teach.click();
        return screen;
      }
      await page.locator(`${visible('party')} .primary-action, ${visible('party')} .button--primary`).first().click();
      return screen;
    }
    case 'pre-gym': {
      // 4.7's lead pick, answered the way the headless runs answer `chooseLead`:
      // confirm the current lead. The confirm submits the lowest living slot, so
      // the bot's run and a headless run walk the same party order. Before the
      // confirm existed the bot had to hand the lead to the lowest *enabled*
      // slot, because slot 0's own button is disabled ("Leading") — which on a
      // party of one left no enabled control at all.
      const confirm = page.locator(`${visible('pre-gym')} .pre-gym__confirm:not(:disabled)`);
      if (!(await confirm.count())) return null;
      await confirm.first().click();
      return screen;
    }
    case 'map': {
      const node = await chooseNode(page);
      if (!node) return null;
      await node.click();
      return screen;
    }
    default:
      return null;
  }
}

/**
 * Play until `predicate(screen, page)` is true, or `maxSteps` decisions pass.
 * Checked *before* each step, so the run stops on the screen asked for.
 *
 * **`maxSteps` counts decisions, not laps. M2.0.** It always said decisions;
 * the loop counted laps, and the two differ exactly when the app is busy —
 * which is when the budget matters. A lap that found nothing to click spent
 * nothing, so it is not a step, and a walk no longer gives up because the
 * machine was slow enough that waiting looked like progress.
 *
 * The wall-clock cap is what stops a genuinely stuck run now. It is a
 * *deadline*, not a per-step sleep: a fast machine never touches it, and a slow
 * one gets as many frames as it needs rather than a fixed 25ms that was only
 * ever a guess at how long a render takes.
 *
 * It scales with the budget rather than being flat, because a caller that asks
 * for five steps is asking a short question and should get a short answer when
 * the walk is stuck — `scripts/visual/stamps.mjs` asks exactly that and
 * swallows the rejection. 300ms a decision, floored at 30s, which lands the
 * default 600 on the three minutes a full walk to the summary can take under
 * load.
 */
export async function playUntil(page, predicate, maxSteps = 600, { timeoutMs = Math.max(30_000, maxSteps * 300) } = {}) {
  const deadline = Date.now() + timeoutMs;
  let steps = 0;
  while (steps < maxSteps) {
    const screen = await openScreen(page);
    if (screen && (await predicate(screen, page))) return screen;
    if (Date.now() > deadline) {
      throw new Error(`playUntil: ${timeoutMs}ms elapsed after ${steps} steps, on ${screen}`);
    }
    // `screen` and not a fresh read: this is the half of the race that lives
    // here. See `stepOnceUnparked`.
    // A lap that acted counts. One that did not has already waited, inside
    // `stepOnce`, for the app to move.
    if (await stepOnce(page, screen)) steps += 1;
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
export const TUTORIAL_SKIPPED_SETTINGS = JSON.stringify({ density: 'detailed', tutorial: { skipped: true, seen: [] } });

/** The three density modes, in the order the settings store lists them. Density modes patch. */
export const DENSITIES = ['detailed', 'simple', 'pocket'];

/**
 * Both move bar layouts. `grid` is the stored default, so it is what every
 * entry recorded before the four-column patch describes.
 */
export const MOVE_BARS = ['grid', 'columns'];

/**
 * Seed a context's storage so the app's first launch is a returning one,
 * tutorial-wise, in the density mode asked for.
 *
 * The mode goes in through the store rather than through a hook on the page,
 * so the bot measures exactly what a stored preference renders: the app reads
 * it at startup and writes the root attribute itself.
 */
export async function skipTutorialIn(context, density = 'detailed') {
  await context.addInitScript(
    (settings) => {
      try {
        if (!globalThis.localStorage.getItem('gymrun.settings')) globalThis.localStorage.setItem('gymrun.settings', settings);
      } catch {
        // Storage unavailable: the app falls back to defaults and both
        // first-run surfaces show.
      }
    },
    /*
     * The store comes from `scripts/first-launch.mjs`, which `scripts/smoke.mjs`
     * seeds from too. It covers the coach marks **and** the intro panel — the
     * name here is older than the panel and is kept because every caller in the
     * suite uses it.
     */
    notFirstLaunch({ density }),
  );
}

export async function openApp(browser, url, seed, viewport = PHONE, contextOptions = {}) {
  const { tutorial = false, density = 'detailed', ...rest } = contextOptions;
  /*
   * The engine's own context shape, then the caller's overrides. **The iOS
   * patch.** On Chromium this is the bare viewport it always was; on WebKit it
   * is the iPhone descriptor at the same size, so touch, the Safari user agent
   * and 3x density come along without any test asking for them.
   */
  const context = await browser.newContext({ ...contextFor(viewport, browser.browserType().name()), ...rest });
  if (!tutorial) await skipTutorialIn(context, density);
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
 *
 * **In all three density modes since the density patch.** The top-level `map`
 * and `battle` are Detailed, unchanged in shape so every reader of
 * `heights.json` before the patch reads the same numbers; `modes.simple` and
 * `modes.pocket` are the same two screens under the other two stored
 * preferences, each on a fresh context.
 */
export async function measureGuardedScreens(url, browser, seed = 'SMOKE24') {
  const result = { seed, viewport: { ...PHONE }, modes: {}, layouts: {} };
  const problems = [];
  for (const density of DENSITIES) {
    const measured = await measureGuardedScreensIn(url, browser, seed, density, 'grid');
    problems.push(...measured.problems);
    if (density === 'detailed') {
      result.map = measured.map;
      result.battle = measured.battle;
    } else {
      result.modes[density] = { map: measured.map, battle: measured.battle };
    }
  }
  /*
   * The second move bar layout, in all three densities. **The four-column
   * patch.**
   *
   * A sibling axis rather than a replacement, and the shape is deliberate: the
   * `map`/`battle`/`modes` entries above are the stored default, so every
   * number recorded before this patch keeps its meaning and its history. A
   * layout that is one tap away in the drawer is a layout a player will be
   * looking at, and an instrument that could not see it would gate half the
   * game.
   */
  for (const layout of MOVE_BARS.filter((name) => name !== 'grid')) {
    result.layouts[layout] = {};
    for (const density of DENSITIES) {
      const measured = await measureGuardedScreensIn(url, browser, seed, density, layout);
      problems.push(...measured.problems);
      result.layouts[layout][density] = { map: measured.map, battle: measured.battle };
    }
  }
  if (problems.length) result.problems = problems;
  return result;
}

async function measureGuardedScreensIn(url, browser, seed, density) {
  const { page, context, problems } = await openApp(browser, url, seed, PHONE, { density });
  const result = { problems };

  await playUntil(page, (screen) => screen === 'map');
  await page.waitForTimeout(100);
  result.map = await measureScreen(page, 'map', `${visible('map')} .step--current .node`);

  await playUntil(page, (screen) => screen === 'battle');
  // The HP bar transition and the swap beat settle well inside this.
  await page.waitForTimeout(600);
  result.battle = await measureScreen(page, 'battle', `${visible('battle')} .moves .move`);

  await context.close();
  return result;
}
