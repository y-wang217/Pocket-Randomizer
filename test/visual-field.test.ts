/**
 * The weather on the world, in a real engine. **Stage 4.11 Tier 3, D47.**
 *
 * Three things only a browser can answer: that each sky paints and moves,
 * that under reduced motion it paints and does not move, and that the text
 * over it still reads. The loaded board is played under each weather by the
 * ability that sets it (`gallery.ts`'s `weather=` and `terrain=`), so the
 * header glyph, the button and the world are one battle's truth.
 *
 * The contrast reading is the chip sweep's method: the dominant rendered
 * colour inside the element's box, off a screenshot, against its computed
 * text colour, held to the chip floor for every guarded style, with the faint
 * detail line's bare reading recorded beside it so the wash's cost stays a
 * number.
 */
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { ratio } from '../scripts/visual/contrast.mjs';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { openHarness, type Harness } from './visual/harness';

const WEATHERS = ['rain', 'sun', 'sand', 'snow', 'wind'] as const;
const TEXT = ['.screen__title', '.panel__name'] as const;
const FAINT = '.battle__detail-text';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

async function open(
  browser: Browser,
  query: string,
  options: { reducedMotion?: 'reduce' | 'no-preference' } = {},
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...options });
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=V5-LOADED-1&screen=battle&density=pocket&fixture=loaded&exposure=exhausted${query}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.waitForTimeout(250);
  return { page, context };
}

function animationOf(page: Page, kind: string): Promise<{ element: string; before: string; opacity: string }> {
  return page.evaluate((k) => {
    const el = globalThis.document.querySelector('.world__weather') as HTMLElement;
    const style = globalThis.getComputedStyle(el);
    return {
      element: style.animationName,
      before: globalThis.getComputedStyle(el, '::before').animationName,
      opacity: style.opacity,
      kind: k,
    };
  }, kind);
}

/** The text colour and the dominant colour behind it, for one selector. */
async function contrastOf(page: Page, selector: string): Promise<number> {
  const box = await page.evaluate((sel) => {
    const el = globalThis.document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const color = globalThis.getComputedStyle(el).color;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color };
  }, selector);
  expect(box, selector).not.toBeNull();
  const png = await page.screenshot({ clip: { x: box!.x, y: box!.y, width: Math.max(1, box!.width), height: Math.max(1, box!.height) } });
  const background = await page.evaluate(async (base64) => {
    const img = new globalThis.Image();
    img.src = `data:image/png;base64,${base64}`;
    await img.decode();
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      const key = `${data[i]! >> 2},${data[i + 1]! >> 2},${data[i + 2]! >> 2}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: [string, number] | null = null;
    for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
    return best![0].split(',').map((v) => (Number(v) << 2) + 2) as [number, number, number];
  }, png.toString('base64'));
  const text = box!.color.match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number];
  return ratio(text, background);
}

describe('the sky over the loaded board', () => {
  it('paints nothing and moves nothing under a bare sky', async () => {
    const { page, context } = await open(harness.browser, '&weather=none');
    expect(await page.evaluate(() => globalThis.document.documentElement.hasAttribute('data-weather'))).toBe(false);
    const motion = await animationOf(page, 'none');
    expect(motion.opacity).toBe('0');
    expect(motion.element).toBe('none');
    expect(motion.before).toBe('none');
    await context.close();
  }, 120_000);

  for (const kind of WEATHERS) {
    it(`paints and moves under ${kind}, and holds still under reduced motion`, async () => {
      const { page, context } = await open(harness.browser, `&weather=${kind}`);
      expect(await page.evaluate(() => globalThis.document.documentElement.getAttribute('data-weather'))).toBe(kind);
      const motion = await animationOf(page, kind);
      // Sun breathes on the element, so its opacity is mid-cycle when read;
      // every other kind's wash is at 1 and its texture is what moves.
      if (kind === 'sun') expect(Number(motion.opacity)).toBeGreaterThan(0.5);
      else expect(motion.opacity).toBe('1');
      expect(kind === 'sun' ? motion.element : motion.before, kind).toBe(`weather-${kind}`);
      await context.close();

      const still = await open(harness.browser, `&weather=${kind}`, { reducedMotion: 'reduce' });
      const held = await animationOf(still.page, kind);
      expect(held.opacity, `${kind} wash survives reduced motion`).toBe('1');
      expect(held.element, `${kind} element still`).toBe('none');
      expect(held.before, `${kind} texture still`).toBe('none');
      await still.context.close();
    }, 180_000);
  }

  it('tints the ground for a terrain and leaves the sky alone', async () => {
    const bare = await open(harness.browser, '&weather=none');
    const before = await bare.page.evaluate(() => globalThis.getComputedStyle(globalThis.document.querySelector('.world__layer--near')!).getPropertyValue('--layer-fill'));
    await bare.context.close();
    const { page, context } = await open(harness.browser, '&weather=none&terrain=grassy');
    expect(await page.evaluate(() => globalThis.document.documentElement.getAttribute('data-terrain'))).toBe('grassy');
    expect(await page.evaluate(() => globalThis.document.documentElement.hasAttribute('data-weather'))).toBe(false);
    const after = await page.evaluate(() => globalThis.getComputedStyle(globalThis.document.querySelector('.world__layer--near')!).getPropertyValue('--layer-fill'));
    expect(after).not.toBe(before);
    expect(await animationOf(page, 'grassy')).toMatchObject({ element: 'none', before: 'none' });
    await context.close();
  }, 120_000);
});

describe('the text over the sky', () => {
  const floor = DEFAULT_DISPLAY_TUNING.minChipContrastRatio;
  const bare: Record<string, number> = {};

  beforeAll(async () => {
    const { page, context } = await open(harness.browser, '&weather=none');
    for (const selector of [...TEXT, FAINT]) bare[selector] = await contrastOf(page, selector);
    await context.close();
  }, 120_000);

  for (const kind of WEATHERS) {
    it(`still reads under ${kind}`, async () => {
      const { page, context } = await open(harness.browser, `&weather=${kind}`);
      for (const selector of TEXT) {
        const reading = await contrastOf(page, selector);
        expect(reading, `${selector} under ${kind}`).toBeGreaterThanOrEqual(floor);
      }
      /*
       * The faint detail line costs the most, because it is the faintest ink
       * on the screen: measured 2026-09-25 at 7.25 under a bare sky and 5.49
       * to 5.91 under the five weathers, on the loaded board's locale. It is
       * held to the same floor as the title rather than to a share of its own
       * bare reading, because the floor is the promise and the share was a
       * guess. The bare reading is asserted too, so a wash that ever cost
       * more than it does today is a number in a failure rather than a drift.
       */
      const faint = await contrastOf(page, FAINT);
      expect(faint, `${FAINT} under ${kind}, bare ${bare[FAINT]}`).toBeGreaterThanOrEqual(floor);
      expect(faint, `${FAINT} under ${kind} lost more than a third of its bare reading ${bare[FAINT]}`).toBeGreaterThanOrEqual((bare[FAINT] ?? 0) * 0.66);
      await context.close();
    }, 120_000);
  }
});
