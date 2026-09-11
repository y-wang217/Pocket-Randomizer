/**
 * No pixel face on any text the run draws. **Patch 4.8.0.2.**
 *
 * The measurement is in `scripts/visual/font-grid.mjs` and the argument in
 * `tokens.css` under "Faces": Pixelify Sans has no pixel module, so no size at
 * any device pixel ratio puts it on a phone's grid, and a `2` read as an `8`.
 * `test/visual-tokens.test.ts` proves the *tokens* name one face; this proves
 * the *page* does, on the two guarded screens, element by element — a rule
 * that reaches for a family by name rather than a token would pass the token
 * test and fail here.
 *
 * Asserted against the computed `font-family` rather than a screenshot,
 * because a font that is not declared cannot be painted, and the declaration
 * is the thing a future stage would put back.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/** Every distinct computed family list on elements with text under a scope, with the element that carries it. */
async function families(page: Page, scope: string): Promise<Record<string, string>> {
  return page.evaluate((sel) => {
    const root = globalThis.document.querySelector(sel);
    const seen: Record<string, string> = {};
    if (!root) return seen;
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      const text = [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== '');
      if (!text) continue;
      const family = globalThis.getComputedStyle(element).fontFamily;
      if (!(family in seen)) seen[family] = `${element.tagName.toLowerCase()}.${element.className}`;
    }
    return seen;
  }, scope);
}

describe('the face the page is actually set in', () => {
  it('is the monospace stack on every text element of the map and the battle, and never the pixel face', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const found: Record<string, string> = {};

    await playUntil(page, (screen) => screen === 'map');
    Object.assign(found, await families(page, visible('map')));
    await playUntil(page, (screen) => screen === 'battle');
    await page.waitForTimeout(300);
    Object.assign(found, await families(page, visible('battle')));
    await context.close();

    const seen = Object.keys(found);
    expect(seen.length, 'no text element was measured, so this proves nothing').toBeGreaterThan(0);
    const pixel = seen.filter((family) => /pixelify/i.test(family));
    expect(pixel.map((family) => `${found[family]}: ${family}`)).toEqual([]);
    const offGrid = seen.filter((family) => !/^ui-monospace\b/.test(family));
    expect(offGrid.map((family) => `${found[family]}: ${family}`)).toEqual([]);
  }, 600_000);
});
