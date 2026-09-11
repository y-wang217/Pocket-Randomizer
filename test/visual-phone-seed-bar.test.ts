/**
 * The seed bar on a phone during a run: collapsed to a toggle on the header
 * row, one tap from its controls, and never hidden outright.
 *
 * 4.5.2's phone pass removed the bar for the whole running phase, and the
 * phase is `running` from page load. So on a phone Start run, Copy seed, New
 * seed and Resume saved run were unreachable from the starter screen until the
 * run ended. This is the check that they are reachable again, and that the
 * fix cost the phone no height: the toggle sits on a row that already exists.
 *
 * A browser rather than jsdom because every question is about computed style
 * at a viewport width.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, visible } from '../scripts/visual/browser.mjs';
import { formatSeedString } from '../src/core/seedString';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

describe('the seed bar on a phone', () => {
  it('is collapsed to a toggle on the header row from the starter screen, and expands on a tap', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24', PHONE);

    // Collapsed: the bar is gone, the toggle is on screen and a touch target.
    expect(await page.locator('.seedbar').isVisible()).toBe(false);
    const toggle = await page.locator('.seedbar__toggle').boundingBox();
    expect(toggle).not.toBeNull();
    expect((toggle?.x ?? 0) + (toggle?.width ?? 0)).toBeLessThanOrEqual(PHONE.width);
    expect(await page.locator('.seedbar__toggle').getAttribute('aria-expanded')).toBe('false');

    // On the same row as the tutorial replay, not a row of its own: the
    // header's height is the battle's and the map's vertical budget. (The
    // Detail toggle that shared this row moved to the drawer: density modes
    // patch, step 7.)
    const detail = await page.locator('.tutorial__replay').boundingBox();
    expect(Math.abs((toggle?.y ?? 0) - (detail?.y ?? 0))).toBeLessThan(1);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBe(PHONE.width);

    // One tap, and every control is back, inside the viewport.
    await page.locator('.seedbar__toggle').click();
    expect(await page.locator('.seedbar__toggle').getAttribute('aria-expanded')).toBe('true');
    expect(await page.locator('.seedbar').isVisible()).toBe(true);
    expect(await page.locator('.seedbar__input').inputValue()).toBe(formatSeedString('SMOKE24'));
    for (const label of ['Start run', 'Copy seed', 'New seed']) {
      const box = await page.locator('.seedbar .button', { hasText: label }).boundingBox();
      expect(box, label).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0), label).toBeLessThanOrEqual(PHONE.width);
    }
    // No save in a fresh context, so Resume stays hidden — as on a desktop.
    expect(await page.locator('.seedbar .button', { hasText: 'Resume saved run' }).isVisible()).toBe(false);

    // New seed starts a run, and the new run begins collapsed again.
    const before = await page.locator('.stamp--seed').textContent();
    await page.locator('.seedbar .button', { hasText: 'New seed' }).click();
    await page.waitForFunction((was) => globalThis.document.querySelector('.stamp--seed')?.textContent !== was, before);
    await page.waitForSelector(`${visible('starter')} .starter`);
    expect(await page.locator('.seedbar').isVisible()).toBe(false);
    expect(await page.locator('.seedbar__toggle').getAttribute('aria-expanded')).toBe('false');

    expect(problems).toEqual([]);
    await context.close();
  }, 120_000);

  it('is the whole bar, with no toggle, on a desktop', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24', DESKTOP);
    expect(await page.locator('.seedbar').isVisible()).toBe(true);
    expect(await page.locator('.seedbar__toggle').isVisible()).toBe(false);
    expect(await page.locator('.seedbar .button', { hasText: 'New seed' }).isVisible()).toBe(true);
    expect(problems).toEqual([]);
    await context.close();
  }, 120_000);
});
