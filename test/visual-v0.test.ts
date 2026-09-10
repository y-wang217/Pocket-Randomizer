/**
 * Stage V0's browser assertions: the vertical budget, the sibling rule, and
 * the one accent. All three are questions about computed style or layout, so
 * they run in Chromium through `test/visual/harness.ts`.
 *
 * The seed is SMOKE24 and the clicks are the smoke bot's, so the numbers here
 * are the numbers in `docs/visual/baseline/heights.json`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureGuardedScreens, openApp, openScreen, playUntil, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

describe('the vertical budget', () => {
  it('leaves both guarded screens at the baseline height, to the pixel', async () => {
    const expected = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/baseline/heights.json'), 'utf8'));
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.problems ?? []).toEqual([]);
    expect(measured.map).toEqual(expected.map);
    expect(measured.battle).toEqual(expected.battle);
  }, 180_000);
});

/** The computed properties the plan names for sibling cards. */
const CARD_KEYS = ['backgroundColor', 'borderTopColor', 'borderLeftColor', 'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth', 'boxShadow', 'fontSize'] as const;

async function signatures(page: Page, selector: string): Promise<string[]> {
  // The pointer rests where the last click landed, which is a hover state on
  // whichever card is under it. Park it and let the 120ms transition finish.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  return page.evaluate(
    ([sel, keys]) =>
      [...globalThis.document.querySelectorAll(sel)].map((el) => {
        const style = globalThis.getComputedStyle(el);
        return keys.map((key) => `${key}=${style[key as keyof CSSStyleDeclaration]}`).join(' ');
      }),
    [selector, CARD_KEYS as unknown as string[]] as const,
  );
}

describe('siblings', () => {
  it('render starter, locale, reward and capture cards on one surface', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const groups: Record<string, string[]> = {};

    groups.starter = await signatures(page, `${visible('starter')} .starter`);
    await playUntil(page, (screen) => screen === 'locale');
    groups.locale = await signatures(page, `${visible('locale')} .locale`);
    await playUntil(page, async (screen, p) => screen === 'result' && (await p.locator(`${visible('result')} .reward`).count()) > 0);
    groups.reward = await signatures(page, `${visible('result')} .reward`);
    await playUntil(
      page,
      async (screen, p) =>
        screen === 'result' && (await p.locator(`${visible('result')} .party__member--offered`).count()) > 0 && !(await p.locator(`${visible('result')} .result__capture`).isHidden()),
    );
    groups.capture = await signatures(page, `${visible('result')} .party__member--offered`);
    await context.close();

    for (const [name, group] of Object.entries(groups)) {
      expect(group.length, `${name} cards present`).toBeGreaterThan(0);
      expect(new Set(group).size, `${name} cards identical: ${group.join(' | ')}`).toBe(1);
    }
    const surfaces = new Set(Object.values(groups).map((group) => group[0]));
    expect(surfaces.size, `one surface across kinds: ${[...surfaces].join(' | ')}`).toBe(1);
  }, 180_000);
});

describe('one accent', () => {
  it('never shows two primary actions, and shows one on every screen that has one', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const seen = new Map<string, number>();
    const count = async (): Promise<number> =>
      page.evaluate(() => [...globalThis.document.querySelectorAll('.primary-action')].filter((el) => (el as HTMLElement).offsetParent !== null).length);

    let opened = false;
    for (let step = 0; step < 500; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      if (screen === 'summary') break;
      if (screen === 'event') {
        // The carry-on button is the primary and appears after the choice.
        const choice = page.locator(`${visible('event')} .event__choice:not([disabled])`).first();
        if (await choice.count()) {
          await choice.click();
          await page.waitForTimeout(30);
        }
      }
      if (screen === 'map' && !opened) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(30);
        opened = true;
        continue;
      }
      const n = await count();
      seen.set(screen, Math.max(seen.get(screen) ?? 0, n));
      expect(n, `${screen} shows ${n} primary actions`).toBeLessThanOrEqual(1);
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    seen.set('summary', await count());
    await context.close();

    for (const screen of ['party', 'shop', 'event', 'result', 'summary']) {
      if (!seen.has(screen)) continue;
      expect(seen.get(screen), `${screen} has a primary action`).toBe(1);
    }
    for (const screen of ['starter', 'locale', 'map', 'battle', 'target', 'replace']) {
      if (!seen.has(screen)) continue;
      expect(seen.get(screen), `${screen} has no primary action`).toBe(0);
    }
    expect([...seen.keys()]).toEqual(expect.arrayContaining(['party', 'result', 'summary']));
  }, 300_000);
});
