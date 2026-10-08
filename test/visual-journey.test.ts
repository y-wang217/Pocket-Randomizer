/**
 * The calm map and the journey vignettes in the real app, in a browser at
 * 390x844. **The map calm-down and journey vignettes patch, bible Rev 31,
 * D113**: the pixel half of its test 2, and its test 5 against the built game
 * rather than jsdom.
 *
 * Test 2: every next-step node tappable at 44px or more, nothing else on the
 * graph tappable, no scroll to see the decision. Test 5: a beat plays on a map
 * commit, keyed to the kind entered; a tap ends it at once; and a tap during
 * the return beat, aimed at a map node drawn beneath it, chooses nothing.
 *
 * Driven browsers start with the vignettes off (`scripts/first-launch.mjs`),
 * so this turns them on for its own context.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

async function withVignettes(seed: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const { page, context } = await openApp(harness.browser, harness.url, seed);
  await page.evaluate(() => {
    const store = JSON.parse(globalThis.localStorage.getItem('gymrun.settings') ?? '{}') as Record<string, unknown>;
    globalThis.localStorage.setItem('gymrun.settings', JSON.stringify({ ...store, vignettes: 'on' }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
  return { page, close: () => context.close() };
}

const beatOn = (page: Page, moment?: string): Promise<boolean> =>
  page.evaluate((which) => Boolean(globalThis.document.querySelector(which ? `.vignette[data-moment="${which}"]` : '.vignette')), moment ?? null);

describe('the calm map at 390x844 (test 2)', () => {
  it('makes every next-step node a 44px target, nothing else on the graph a target, and needs no scroll', async () => {
    const { page, close } = await withVignettes('SMOKE24');
    await playUntil(page, (screen) => screen === 'map', 900);
    await page.waitForSelector('.vignette', { state: 'detached', timeout: 5_000 });
    const read = await page.evaluate(() => {
      const map = globalThis.document.querySelector('.screen[data-screen="map"]:not([hidden])')!;
      const graph = map.querySelector('.map-graph')!;
      const targets = [...graph.querySelectorAll('button, a, [tabindex]')];
      const scroller = globalThis.document.querySelector('.screens');
      return {
        targets: targets.map((target) => {
          const box = target.getBoundingClientRect();
          return { current: target.classList.contains('node--current'), width: box.width, height: box.height, bottom: box.bottom };
        }),
        scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
        innerHeight: globalThis.innerHeight,
      };
    });
    expect(read.targets.length).toBeGreaterThan(0);
    for (const target of read.targets) {
      expect(target.current).toBe(true);
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.bottom).toBeLessThanOrEqual(read.innerHeight);
    }
    expect(read.scrolls).toBe(false);
    await close();
  }, 240_000);
});

describe('the journey vignettes in the app (test 5)', () => {
  it('plays the kind entered on a commit, and a tap ends it at once', async () => {
    const { page, close } = await withVignettes('SMOKE24');
    await playUntil(page, (screen) => screen === 'map', 900);
    await page.waitForSelector('.vignette', { state: 'detached', timeout: 5_000 });
    const option = page.locator(`${visible('map')} .map-graph .node--current`).first();
    const kind = (await option.getAttribute('class'))!.match(/node--(wild|trainer|rest|shop|event)/)![1]!;
    await option.click();
    await page.waitForSelector(`.vignette[data-moment="${kind}"]`, { timeout: 2_000 });
    const caption = await page.textContent('.vignette__caption');
    expect(caption?.trim().length).toBeGreaterThan(0);
    const started = Date.now();
    await page.mouse.click(195, 422);
    await page.waitForSelector('.vignette', { state: 'detached', timeout: 2_000 });
    expect(Date.now() - started).toBeLessThan(600);
    await close();
  }, 240_000);

  it('lets no tap through: one aimed at a map node during the return beat chooses nothing', async () => {
    const { page, close } = await withVignettes('SMOKE24');
    // Walk until the return beat is up over a freshly drawn map.
    await playUntil(page, async (_screen, p) => beatOn(p as Page, 'return'), 900);
    const target = await page.evaluate(() => {
      const node = globalThis.document.querySelector('.screen[data-screen="map"]:not([hidden]) .map-graph .node--current');
      const box = node?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2, step: node!.closest('.step')?.getAttribute('data-step') } : null;
    });
    expect(target).not.toBeNull();
    await page.mouse.click(target!.x, target!.y);
    await page.waitForSelector('.vignette', { state: 'detached', timeout: 2_000 });
    await page.waitForTimeout(400);
    // Still on the map, still at the same step, and no commit beat began.
    const after = await page.evaluate(() => ({
      map: Boolean(globalThis.document.querySelector('.screen[data-screen="map"]:not([hidden])')),
      step: globalThis.document.querySelector('.screen[data-screen="map"]:not([hidden]) .step--current')?.getAttribute('data-step'),
      beat: Boolean(globalThis.document.querySelector('.vignette')),
    }));
    expect(after).toEqual({ map: true, step: target!.step, beat: false });
    await close();
  }, 300_000);
});
