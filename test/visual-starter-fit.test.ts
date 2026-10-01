/**
 * The starter screen without a scroll. **Stage 5.1, bible Rev 21, D89 and
 * D90** (`docs/spec/gymrun-stage5.1-band-bars-and-starter-fit.md`).
 *
 * The author's phone, Safari's toolbars up, is about 390x700. On the author's
 * own seed the frame's scroller must not scroll at rest, nor with any of the
 * three cards selected, and the selected card's panel must sit over its own
 * move column rather than below the cards. The goal is a goal, not a gate on
 * every seed: `docs/generation.md` §96 records the starter that misses it by
 * 11px. This holds the seed the author reported against.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

const SEED = 'GYMRUN-715122-DNCFGVFU';
const VIEWPORT = { width: 390, height: 700 };

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scroller = globalThis.document.querySelector('.screens');
    return scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
  });
}

describe('the starter screen at 390x700', () => {
  it('does not scroll at rest, nor with any card selected, and the panel covers the selected card\'s moves', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, SEED, VIEWPORT);
    await page.mouse.move(0, 0);
    expect(await overflow(page), 'at rest').toBeLessThanOrEqual(0);

    for (let index = 0; index < 3; index++) {
      await page.locator('.starter').nth(index).locator('.starter__name').click();
      await page.waitForTimeout(150);
      expect(await overflow(page), `card ${index + 1} selected`).toBeLessThanOrEqual(0);
      const boxes = await page.evaluate((i) => {
        const card = globalThis.document.querySelectorAll('.starter')[i]!;
        const box = (selector: string) => {
          const rect = card.querySelector(selector)!.getBoundingClientRect();
          return { top: rect.top, left: rect.left, width: rect.width, bottom: rect.bottom };
        };
        return { card: box(':scope > .starter__side'), panel: box(':scope > .starter-detail'), whole: card.getBoundingClientRect().width };
      }, index);
      // Over the move column, and narrower than the card (D89).
      expect(Math.abs(boxes.panel.left - boxes.card.left)).toBeLessThan(1);
      expect(Math.abs(boxes.panel.top - boxes.card.top)).toBeLessThan(1);
      expect(boxes.panel.width).toBeLessThan(boxes.whole * 0.7);
    }
    await context.close();
  }, 120_000);
});
