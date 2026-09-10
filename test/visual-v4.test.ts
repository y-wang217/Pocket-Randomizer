/**
 * Stage V4's browser assertions, on the gallery build: the result screen's
 * two decision points above the fold in each of the shapes the app renders,
 * the summary with one accent, and the summary's route and slots present at
 * the phone width.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

async function openGallery(seed: string, screen: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await harness.browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=${seed}&screen=${screen}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready]', { timeout: 120_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return { page, close: () => context.close() };
}

const bottomOf = (page: Page, selector: string): Promise<number | null> =>
  page.evaluate((sel) => {
    const el = globalThis.document.querySelector(sel);
    return el ? el.getBoundingClientRect().bottom : null;
  }, selector);

describe('the result screen', () => {
  it('keeps a three-card offer above the fold at 390x844', async () => {
    const { page, close } = await openGallery('SMOKE24', 'result');
    const cards = await page.evaluate(() => [...globalThis.document.querySelectorAll('.reward')].map((c) => c.getBoundingClientRect().bottom));
    expect(cards).toHaveLength(3);
    for (const bottom of cards) expect(bottom).toBeLessThanOrEqual(844);
    expect(await page.locator('.result__party .slot').count()).toBeGreaterThan(0);
    await close();
  }, 180_000);

  it('keeps the capture offer, its decision buttons included, above the fold at 390x844', async () => {
    const { page, close } = await openGallery('SMOKE24', 'result-capture');
    expect(await page.locator('.reward').count()).toBe(0);
    const actions = await bottomOf(page, '.acquire__actions');
    expect(actions).not.toBeNull();
    expect(actions ?? Infinity).toBeLessThanOrEqual(844);
    await close();
  }, 180_000);
});

describe('the summary', () => {
  it('shows one accent, the rematch, on a defeat and on a victory', async () => {
    for (const seed of ['V4-42', 'V4-3']) {
      const { page, close } = await openGallery(seed, 'summary');
      const accents = await page.evaluate(() => {
        const accent = globalThis.getComputedStyle(globalThis.document.documentElement).getPropertyValue('--accent').trim();
        const probe = globalThis.document.createElement('span');
        probe.style.color = accent;
        globalThis.document.body.append(probe);
        const rgb = globalThis.getComputedStyle(probe).color;
        probe.remove();
        return [...globalThis.document.querySelectorAll('button')]
          .filter((b) => b.offsetParent !== null && globalThis.getComputedStyle(b).backgroundColor === rgb)
          .map((b) => b.textContent ?? '');
      });
      expect(accents, seed).toEqual(['Rematch this seed']);
      expect(await page.locator('.route__band').count()).toBe(8);
      expect(await page.locator('.tiers__row--here').count()).toBe(1);
      expect(await page.locator('.coverage__spoke').count()).toBe(18);
      expect(await page.evaluate(() => globalThis.document.documentElement.hasAttribute('data-locale'))).toBe(false);
      await close();
    }
  }, 300_000);
});
