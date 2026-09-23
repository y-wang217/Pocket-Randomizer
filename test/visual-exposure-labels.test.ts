/**
 * The exposure labels in a real browser. **Milestone M6.1, D41.**
 *
 * Two assertions a jsdom test cannot make, because both are about what is
 * *painted*:
 *
 *   - **The family walk (D41).** On every gallery surface in Pocket, every mark
 *     of the three families that used to be drawn without the glyph layer (a
 *     band pip, a status chip, the effectiveness numeral) reports its family.
 *     Across the surfaces, all ten families are painted somewhere, so none can
 *     ship without its label ever firing. This walk found D41; kept, it would
 *     have found D37's capability glyph too.
 *   - **The classroom (section 7).** Starter select on a fresh store labels
 *     every family it paints, and on an exhausted store labels none. With
 *     `GYMRUN_RECORD=1` it writes the screenshot the item's done-when asks the
 *     visual bot for, to `docs/visual/m6.1-starter-first-run.png`.
 */
import { join } from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { GLYPH_FAMILIES } from '../src/data/glyphFamilies';
import { GALLERY_SURFACES, type GallerySurface } from '../src/ui/gallery-surfaces';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

async function open(surface: GallerySurface, seed: string, exposure: 'fresh' | 'exhausted'): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await harness.browser.newContext({ viewport: PHONE });
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=${seed}&screen=${surface}&density=pocket&fixture=loaded&exposure=${exposure}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.waitForTimeout(200);
  return { page, close: () => context.close() };
}

/** Painted families on the page, and painted marks of the D41 three that report none. */
function readFamilies(page: Page): Promise<{ families: string[]; silent: string[] }> {
  return page.evaluate(() => {
    const painted = (element: Element): boolean => element.closest('[hidden]') === null && element.checkVisibility();
    const families = new Set<string>();
    for (const mark of globalThis.document.querySelectorAll<HTMLElement>('[data-family]')) {
      if (painted(mark)) families.add(mark.dataset['family'] ?? '');
    }
    const silent: string[] = [];
    for (const mark of globalThis.document.querySelectorAll<HTMLElement>('.band__pip, .badge--status, .badge--effect')) {
      if (!painted(mark)) continue;
      if (mark.matches('[data-family]') || mark.querySelector('[data-family]')) continue;
      silent.push(mark.className);
    }
    return { families: [...families].sort(), silent };
  });
}

describe('the family walk (D41)', () => {
  it('finds every mark reporting its family, and all ten families painted somewhere', async () => {
    const seen = new Set<string>();
    const silent: string[] = [];
    // SMOKE24 is the census seed; S49B-1's starters carry a priority move, which
    // no SMOKE24 surface paints.
    const walks: [GallerySurface, string][] = [...GALLERY_SURFACES.map((surface): [GallerySurface, string] => [surface, 'SMOKE24']), ['starter', 'S49B-1']];
    for (const [surface, seed] of walks) {
      const { page, close } = await open(surface, seed, 'exhausted');
      const reading = await readFamilies(page);
      await close();
      for (const family of reading.families) seen.add(family);
      silent.push(...reading.silent.map((mark) => `${surface}: ${mark}`));
    }
    expect(silent, 'a painted mark that reports no family never gets a label').toEqual([]);
    expect([...GLYPH_FAMILIES].filter((family) => !seen.has(family)), 'families no surface paints').toEqual([]);
  }, 900_000);
});

describe('the classroom (section 7)', () => {
  it('labels every family starter select paints, on a fresh store', async () => {
    const { page, close } = await open('starter', 'S49B-1', 'fresh');
    const { families } = await readFamilies(page);
    const labelled = await page.evaluate(() =>
      [...new Set([...globalThis.document.querySelectorAll<HTMLElement>('[data-exposure-label]')].map((label) => label.dataset['exposureLabel']))].sort(),
    );
    const width = await page.evaluate(() => globalThis.document.documentElement.scrollWidth);
    if (process.env['GYMRUN_RECORD']) {
      await page.screenshot({ path: join(process.cwd(), 'docs/visual/m6.1-starter-first-run.png'), fullPage: true });
    }
    await close();
    expect(families.length, 'the classroom paints the move card families since M6.0').toBeGreaterThanOrEqual(6);
    expect(labelled).toEqual(families);
    expect(width, 'the labels never push the page sideways').toBeLessThanOrEqual(PHONE.width);
  }, 120_000);

  it('labels nothing once every family is past its third exposure', async () => {
    const { page, close } = await open('starter', 'S49B-1', 'exhausted');
    const count = await page.evaluate(() => globalThis.document.querySelectorAll('[data-exposure-label]').length);
    await close();
    expect(count).toBe(0);
  }, 120_000);
});
