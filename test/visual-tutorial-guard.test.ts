/**
 * No coach mark is ever silently dropped. **Density modes patch, Part 5,
 * ruling 6's assertion.**
 *
 * The failure the guard exists for leaves no trace: a mark whose anchor is
 * behind a fold in Pocket is not mis-placed, it is skipped, because the
 * layer keeps only painted anchors (`ui/tutorial.ts`, `anchorFor`). So the
 * assertion is counted, per surface, on the worst-case fixtures in Pocket
 * with a first-launch store: every mark whose anchor is on the page is
 * shown. "On the page" is the DOM's answer — an element matching the
 * anchor's selector that no `hidden` ancestor removes — and "shown" is the
 * layer's own count on its progress line. A screen where the two differ is
 * a screen where a mark went missing.
 *
 * And the guard's two edges, in the browser: Detailed on the root while the
 * marks are up, Pocket back once the last is tapped.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { TUTORIAL } from '../src/data/tutorial';
import type { GallerySurface } from '../src/ui/gallery-surfaces';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

/** The surfaces that carry marks, and which screen's marks they are. */
const SURFACES: readonly [GallerySurface, keyof typeof TUTORIAL][] = [
  ['starter', 'starter'],
  ['locale', 'locale'],
  ['map', 'map'],
  ['battle', 'battle'],
  ['result', 'result'],
  ['result-capture', 'result'],
  ['party', 'party'],
  ['pre-gym', 'pre-gym'],
  ['drawer', 'drawer'],
];

describe.each(SURFACES)('%s in Pocket on a first launch', (surface, screen) => {
  it('shows every mark whose anchor is on the page, in Detailed, and gives Pocket back after', async () => {
    const context = await harness.browser.newContext({ viewport: PHONE });
    await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(`${harness.url}/gallery.html#seed=SMOKE24&screen=${surface}&density=pocket&fixture=loaded&tutorial=fresh`, {
      waitUntil: 'load',
    });
    await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
    await page.waitForTimeout(300);

    const anchors = TUTORIAL[screen].map((mark) => mark.anchor);
    const reading = await page.evaluate((selectors) => {
      const onPage = selectors.filter((selector) =>
        [...globalThis.document.querySelectorAll(selector)].some((element) => element.closest('[hidden]') === null),
      ).length;
      const coach = globalThis.document.querySelector<HTMLElement>('.coach');
      const progress = coach?.querySelector('.coach__progress')?.textContent ?? '';
      const shown = coach && !coach.hidden ? Number(progress.match(/of (\d+)/)?.[1] ?? 0) : 0;
      return { onPage, shown, mode: globalThis.document.documentElement.getAttribute('data-density') };
    }, anchors);

    expect(reading.onPage, `${surface}: the fixture carries no anchor for ${screen}`).toBeGreaterThan(0);
    expect(reading.shown, `${surface}: marks on the page and marks shown differ — one was dropped without a trace`).toBe(reading.onPage);
    expect(reading.mode, 'Detailed while the marks are up').toBe('detailed');

    for (let i = 0; i < reading.shown; i++) {
      await page.locator('.coach .coach__next').click();
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate(() => globalThis.document.querySelector<HTMLElement>('.coach')?.hidden)).toBe(true);
    expect(await page.evaluate(() => globalThis.document.documentElement.getAttribute('data-density')), 'Pocket back once the marks are done').toBe('pocket');
    await context.close();
  }, 180_000);
});
