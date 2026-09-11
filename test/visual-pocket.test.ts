/**
 * The Pocket gate: no decision surface scrolls on a 390x844 phone, and every
 * archive surface holds its complete outcome in the first screenful.
 * **Density modes patch, Part 3, split by ruling 4.**
 *
 * Measured, not promised. Each surface is the gallery's worst-case fixture
 * (`ui/gallery-fixtures.ts`, ruling 3) loaded in Pocket mode on a fresh page,
 * and the assertion is the mode's whole definition:
 *
 *   - **Decision surfaces** — starter, locale, map, battle, result (both
 *     shapes), target, replace, party, pre-gym, shop, event — `scrollHeight`
 *     of the document at or under 844. A hard gate, no exemptions.
 *   - **The drawer** — a fixed overlay whose sheet scrolls on its own, so the
 *     document's height cannot see it: the sheet's `scrollHeight` at or under
 *     its `clientHeight`.
 *   - **Archive surfaces** — the summary and the log sheet — the outcome block's
 *     bottom edge at or above 844. For the summary that block runs from the
 *     outcome word through the actions; for the sheet it is the header and the
 *     latest turn's lines. Everything below may scroll (ruling 4).
 *
 * Detailed and Simple keep the existing per-screen budgets unchanged; those
 * are `test/visual-v0.test.ts` and friends against `heights.json`, and this
 * file neither relaxes nor replaces them.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { ARCHIVE_SURFACES, DECISION_SURFACES, GALLERY_SURFACES, type GallerySurface } from '../src/ui/gallery-surfaces';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

async function open(surface: GallerySurface): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await harness.browser.newContext({ viewport: PHONE });
  // The sprite CDN is unreachable here and may hang rather than refuse; see
  // the same line in `visual-coverage.test.ts`. Sprites are fixed-size boxes,
  // so a missing one moves nothing this file measures.
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=SMOKE24&screen=${surface}&density=pocket&fixture=worst`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return { page, close: () => context.close() };
}

describe('the surfaces are all gated', () => {
  it('names every gallery surface exactly once', () => {
    expect([...DECISION_SURFACES, 'drawer', ...ARCHIVE_SURFACES].sort()).toEqual([...GALLERY_SURFACES].sort());
  });
});

describe.each(DECISION_SURFACES)('%s in Pocket', (surface) => {
  it('does not scroll at 390x844', async () => {
    const { page, close } = await open(surface);
    const height = await page.evaluate(() => globalThis.document.documentElement.scrollHeight);
    await close();
    expect(height, `${surface} scrolls: ${height} against ${PHONE.height}`).toBeLessThanOrEqual(PHONE.height);
  }, 120_000);
});

describe('the drawer in Pocket', () => {
  it('fits its sheet without scrolling it', async () => {
    const { page, close } = await open('drawer');
    const sheet = await page.evaluate(() => {
      const element = globalThis.document.querySelector('.drawer__sheet');
      return element ? { scroll: element.scrollHeight, client: element.clientHeight } : null;
    });
    await close();
    expect(sheet, 'the drawer was not open').not.toBeNull();
    expect(sheet?.scroll, `the sheet scrolls: ${sheet?.scroll} inside ${sheet?.client}`).toBeLessThanOrEqual(sheet?.client ?? 0);
  }, 120_000);
});

describe('the archive surfaces in Pocket', () => {
  it('summary: the outcome block ends above the fold', async () => {
    const { page, close } = await open('summary');
    const edge = await page.evaluate(() => {
      const actions = globalThis.document.querySelector('.summary__actions');
      return actions ? actions.getBoundingClientRect().bottom + globalThis.scrollY : null;
    });
    await close();
    expect(edge, 'no actions row on the summary').not.toBeNull();
    expect(edge, `the outcome block runs past the fold: ${edge}`).toBeLessThanOrEqual(PHONE.height);
  }, 120_000);

  it('log sheet: the header and the latest turn are on screen', async () => {
    const { page, close } = await open('log-sheet');
    const reading = await page.evaluate(() => {
      const sheet = globalThis.document.querySelector('.log-sheet__sheet');
      const header = globalThis.document.querySelector('.log-sheet__header');
      const panel = globalThis.document.querySelector('.log');
      const last = [...globalThis.document.querySelectorAll('.log-entry')].at(-1);
      if (!sheet || !header || !panel || !last) return null;
      const box = (element: Element) => element.getBoundingClientRect();
      return {
        sheetTop: box(sheet).top,
        sheetBottom: box(sheet).bottom,
        headerVisible: box(header).top >= box(sheet).top && box(header).bottom <= box(sheet).bottom,
        lastVisible: box(last).top >= box(panel).top - 1 && box(last).bottom <= box(panel).bottom + 1,
        entries: globalThis.document.querySelectorAll('.log-entry').length,
      };
    });
    await close();
    expect(reading, 'the sheet was not open, or the log is empty').not.toBeNull();
    expect(reading?.entries ?? 0, 'the fixture must carry a long history').toBeGreaterThan(20);
    expect(reading?.sheetTop ?? -1).toBeGreaterThanOrEqual(0);
    expect(reading?.sheetBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(PHONE.height);
    expect(reading?.headerVisible, 'the sheet header is off screen').toBe(true);
    expect(reading?.lastVisible, 'the latest turn is not in view when the sheet opens').toBe(true);
  }, 120_000);
});
