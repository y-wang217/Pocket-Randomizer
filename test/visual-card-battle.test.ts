/**
 * The card battle sandbox in a real browser. **Card battle engine,
 * checkpoint 5.** Both hidden entries against the built app, the phone fit
 * at 390x844, and the 44px touch floor.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

const SEED = 'GYMRUN-715122-DNCFGVFU';
const PHONE = { width: 390, height: 844 };
const SEQUENCE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

async function measure(page: Page) {
  return page.evaluate(() => {
    const d = globalThis.document.documentElement;
    const targets = [...globalThis.document.querySelectorAll<HTMLElement>('.cb button, .cb .cb-panel, .cb .cb-tile, .cb .cb-card')]
      .filter((node) => node.offsetParent !== null && !(node as HTMLButtonElement).disabled)
      .map((node) => {
        const r = node.getBoundingClientRect();
        return { what: `${node.className} ${node.textContent?.slice(0, 16) ?? ''}`, width: r.width, height: r.height };
      });
    return {
      overflowY: d.scrollHeight - globalThis.innerHeight,
      overflowX: d.scrollWidth - globalThis.innerWidth,
      frameBottom: globalThis.document.querySelector('.cb-frame')!.getBoundingClientRect().bottom,
      small: targets.filter((t) => t.width < 44 || t.height < 44),
      count: targets.length,
    };
  });
}

const screen = (page: Page) => page.evaluate(() => globalThis.document.querySelector<HTMLElement>('main.shell')?.dataset['screen']);

describe('the card battle sandbox at 390x844', () => {
  it('opens on #test, fits with no scroll, and every touch target is at least 44px, through a few rounds', async () => {
    const context = await harness.browser.newContext({ viewport: PHONE, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
    await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });

    for (let round = 0; round < 3; round++) {
      const m = await measure(page);
      expect(m.overflowY, `round ${round + 1}: vertical scroll`).toBeLessThanOrEqual(0);
      expect(m.overflowX, `round ${round + 1}: horizontal scroll`).toBeLessThanOrEqual(0);
      expect(m.frameBottom).toBeLessThanOrEqual(PHONE.height);
      expect(m.small, `round ${round + 1}: targets under 44px`).toEqual([]);
      expect(m.count).toBeGreaterThan(30);
      // Plan what can be planned, then end the turn.
      const card = page.locator('.cb-card:not([data-unavailable]):not([data-selected])').first();
      if (await card.count()) {
        await card.click();
        const lit = page.locator('.cb-panel[data-target="true"], .cb-tile:has(.cb-ov--selectable)').first();
        if (await lit.count()) await lit.click();
        const tile = page.locator('.cb-tile:has(.cb-ov--selectable)').first();
        if (await tile.count()) await tile.click();
      }
      await page.locator('.cb-btn--primary').click();
      if (await page.locator('.cb-sheet:not([hidden])').count()) break;
    }
    expect(errors).toEqual([]);
    await context.close();
  }, 120_000);
});

describe('the hidden key sequence on starter select', () => {
  it('opens the sandbox, and the completing Enter does not pick the focused starter', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, SEED, PHONE);
    // Select a starter so its Choose button shows, and focus it: Enter would press it.
    await page.locator('.starter').first().locator('.starter__name').click();
    await page.locator('.starter-select__choose').focus();
    for (const key of SEQUENCE) await page.keyboard.press(key);
    await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });
    expect(await screen(page)).toBe('starter');
    await page.locator('.cb-exit').click();
    expect(await page.locator('.cb').count()).toBe(0);
    expect(await screen(page)).toBe('starter');
    expect(problems).toEqual([]);
    await context.close();
  }, 120_000);

  it('a wrong key resets the sequence', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, SEED, PHONE);
    for (const key of ['ArrowUp', 'ArrowDown', 'x', 'ArrowLeft', 'ArrowRight', 'Enter']) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    expect(await page.locator('.cb').count()).toBe(0);
    await context.close();
  }, 120_000);

  it('does nothing once starter select is gone', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, SEED, PHONE);
    await page.locator('.starter').first().locator('.starter__name').click();
    await page.locator('.starter-select__choose').click();
    await page.waitForFunction(() => globalThis.document.querySelector<HTMLElement>('main.shell')?.dataset['screen'] !== 'starter');
    for (const key of SEQUENCE) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    expect(await page.locator('.cb').count()).toBe(0);
    await context.close();
  }, 120_000);
});
