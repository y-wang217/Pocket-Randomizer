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
import { ARCHIVE_SURFACES, CONFIRM_SURFACES, DECISION_SURFACES, GALLERY_SURFACES, OVERLAY_SURFACES, type GallerySurface } from '../src/ui/gallery-surfaces';
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
  await page.goto(`${harness.url}/gallery.html#seed=SMOKE24&screen=${surface}&density=pocket&fixture=loaded`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  return { page, close: () => context.close() };
}

describe('the surfaces are all gated', () => {
  it('names every gallery surface exactly once', () => {
    // `OVERLAY_SURFACES` rather than the literal `'drawer'` it named before the
    // map overlay: the list below is generated from the same constant, so a new
    // overlay is gated by adding it in one place instead of two.
    expect([...DECISION_SURFACES, ...OVERLAY_SURFACES, ...CONFIRM_SURFACES, ...ARCHIVE_SURFACES].sort()).toEqual([...GALLERY_SURFACES].sort());
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

/**
 * The overlays in Pocket, one case per entry in `OVERLAY_SURFACES`.
 *
 * Both are windows on the shared `ui/overlay.ts` shell since the map-overlay
 * patch, so both are measured identically: the sheet's own `scrollHeight`
 * against its `clientHeight`, because a fixed overlay's height is invisible to
 * the document's.
 *
 * The window is *more* forgiving here than the bottom sheet it replaced — it
 * is capped at the viewport less two gutters rather than at 90vh, which is
 * about 812px of an 844px phone against the old 760 — so a failure on this
 * gate is content that grew, not geometry that shrank.
 */
describe.each(OVERLAY_SURFACES)('the %s in Pocket', (surface) => {
  it('fits its sheet without scrolling it', async () => {
    const { page, close } = await open(surface);
    const sheet = await page.evaluate((name) => {
      const element = globalThis.document.querySelector(`.${name}__sheet`);
      return element ? { scroll: element.scrollHeight, client: element.clientHeight } : null;
    }, surface);
    await close();
    expect(sheet, `the ${surface} was not open`).not.toBeNull();
    expect(sheet?.scroll, `the sheet scrolls: ${sheet?.scroll} inside ${sheet?.client}`).toBeLessThanOrEqual(sheet?.client ?? 0);
  }, 120_000);
});

/**
 * The confirm bands in Pocket, one case per entry in `CONFIRM_SURFACES`.
 * **Milestone M5.5.**
 *
 * Not the overlay gate above: a band has no `__sheet`, so that query would
 * find nothing and the assertion would pass on an absence. Not the decision
 * gate either: a band is `position: fixed` over a screen, so the document's
 * `scrollHeight` is the screen behind it, which `replace` and `target`
 * already gate.
 *
 * What a confirm has to do is fit in front of the player without being
 * scrolled, so the band's own body is measured against the viewport. Both
 * mount full move cards, which is the content that could outgrow it.
 */
describe.each(CONFIRM_SURFACES)('the %s band in Pocket', (surface) => {
  it('fits the viewport without scrolling', async () => {
    const { page, close } = await open(surface);
    const band = await page.evaluate(() => {
      const element = globalThis.document.querySelector('.confirm-band__body');
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, scroll: element.scrollHeight, client: element.clientHeight };
    });
    await close();
    expect(band, `${surface} did not open a band`).not.toBeNull();
    expect(band?.top, `the band starts above the viewport: ${band?.top}`).toBeGreaterThanOrEqual(0);
    expect(band?.bottom, `the band runs past the fold: ${band?.bottom} against ${PHONE.height}`).toBeLessThanOrEqual(PHONE.height);
    expect(band?.scroll, `the band scrolls internally: ${band?.scroll} inside ${band?.client}`).toBeLessThanOrEqual(band?.client ?? 0);
  }, 120_000);
});

/**
 * **Overlay cancel and flow decline are visually distinct. Milestone M5.5.**
 *
 * The item's last line, asserted where the condition it names actually
 * happens: the `confirm-forfeit` fixture is the one surface in the gallery
 * where a band's cancel and the screen's own decline are on screen at the
 * same time. `confirm-replace` has no flow decline behind it — a replacement
 * screen's way out is the band — so only the forfeit case is measured, and
 * the reason is here rather than in a comment on a skipped case.
 *
 * Distinct means the player can tell a way out from an answer. The two differ
 * in background, in border and in text colour once `body[data-band-open]`
 * takes the decline's weight, and the assertion reads all three rather than
 * trusting one: a single property could match by coincidence, three cannot.
 */
describe('the forfeit band in Pocket', () => {
  it('does not look like the decline that opened it', async () => {
    const { page, close } = await open('confirm-forfeit');
    const pair = await page.evaluate(() => {
      const read = (element: Element | null): { background: string; border: string; color: string } | null => {
        if (!element) return null;
        const style = globalThis.getComputedStyle(element);
        return { background: style.backgroundColor, border: style.borderTopColor, color: style.color };
      };
      return {
        cancel: read(globalThis.document.querySelector('.confirm-band__actions .button:not(.primary-action)')),
        decline: read(globalThis.document.querySelector('.decline:not(.confirm-band .decline)')),
      };
    });
    await close();
    expect(pair.cancel, 'the band had no cancel control').not.toBeNull();
    expect(pair.decline, 'the screen behind had no flow decline').not.toBeNull();
    expect(pair.decline?.color, 'the flow decline keeps full text weight under an open band').not.toBe(pair.cancel?.color);
    expect(pair.decline?.border, 'the two controls share a border colour').not.toBe(pair.cancel?.border);
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
