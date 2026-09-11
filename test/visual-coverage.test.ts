/**
 * The coverage gate: every surface renders differently in all three density
 * modes. **Density modes patch, Part 2.**
 *
 * The requirement, stated as a test rather than an intention: for every
 * surface on the report's list, the rendered output in Detailed, Simple and
 * Pocket is pairwise different. Asserted per surface and named per surface, so
 * a failure says which screen has nothing to say in which mode rather than
 * failing one aggregate.
 *
 * **In a browser, against pixels (ruling 2).** Since 4.7.2 ruling 4 the mode
 * is a `data-density` attribute on `<html>` and the stylesheet is its reader,
 * so the DOM of a screen is *identical* across modes by design and a DOM diff
 * would assert nothing. What differs is what paints, and a full-page
 * screenshot at 390 wide is what paints.
 *
 * ## The fixtures
 *
 * The gallery, one surface per load, in the worst-case state
 * `ui/gallery-fixtures.ts` builds (ruling 3), with the mode read from the URL
 * so each mode is one fresh page — no hook, no mid-page toggle, the same path
 * the app takes on a stored preference.
 *
 * ## The two that stay two-valued (ruling 5)
 *
 * The log sheet is a list of protocol lines with no labels, no descriptions
 * and no stat block, and the target screen is a list of member buttons with
 * one question. Neither has a third honest density to give, and a
 * manufactured difference would be exactly the cosmetic pass the prompt
 * forbids. They are **asserted** rather than skipped: Detailed differs from
 * both, and Simple equals Pocket. If either later gains a third density this
 * says so. The measured reason is in `docs/visual/reports/patch-density-modes.md`.
 */
import { createHash } from 'node:crypto';

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { DENSITIES, type Density } from '../src/ui/settings';
import { GALLERY_SURFACES, TWO_VALUED_SURFACES, type GallerySurface } from '../src/ui/gallery-surfaces';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;
/** surface → mode → sha256 of the full-page screenshot. */
const shots = new Map<GallerySurface, Map<Density, string>>();

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
  for (const surface of GALLERY_SURFACES) {
    const byMode = new Map<Density, string>();
    for (const mode of DENSITIES) {
      byMode.set(mode, await capture(surface, mode));
    }
    shots.set(surface, byMode);
  }
}, 900_000);

afterAll(async () => {
  await harness?.close();
});

/** Open one fixture in one mode on a fresh page, settle it, and hash what paints. */
async function capture(surface: GallerySurface, mode: Density): Promise<string> {
  const context = await harness.browser.newContext({ viewport: PHONE });
  // The sprite sheet lives on Showdown's CDN. A sandbox with no route to it
  // may hang the request rather than refuse it, and a shot taken while an
  // image is still pending is a shot that depends on the clock. Refused
  // outright, every sprite fails at once and hides itself the same way on
  // every load — which is the only way two loads of one mode can agree.
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(`${harness.url}/gallery.html#seed=SMOKE24&screen=${surface}&density=${mode}&fixture=loaded`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await settle(page);
  expect(problems, `${surface} in ${mode} threw`).toEqual([]);
  expect(await page.evaluate(() => globalThis.document.documentElement.getAttribute('data-density')), `${surface} did not take the mode`).toBe(mode);
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await context.close();
  return createHash('sha256').update(png).digest('hex');
}

/**
 * Everything that could make two shots differ by timing: fonts, the pointer's
 * hover lift, and the battle feedback window. Images are not waited on — the
 * sprite route is refused above, a refused sprite hides itself at its fixed
 * size, and a lazy image below the fold never starts at all, which a wait on
 * `complete` would sit on forever.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
}

describe.each(GALLERY_SURFACES)('%s', (surface) => {
  const twoValued = (TWO_VALUED_SURFACES as readonly string[]).includes(surface);
  const hash = (mode: Density): string => {
    const value = shots.get(surface)?.get(mode);
    if (!value) throw new Error(`${surface} was not captured in ${mode}`);
    return value;
  };

  it('renders differently in Detailed and Simple', () => {
    expect(hash('detailed'), 'Simple paints the same pixels as Detailed').not.toBe(hash('simple'));
  });

  it('renders differently in Detailed and Pocket', () => {
    expect(hash('detailed'), 'Pocket paints the same pixels as Detailed').not.toBe(hash('pocket'));
  });

  if (twoValued) {
    it('renders identically in Simple and Pocket, which is the documented exemption', () => {
      expect(hash('simple'), 'the exemption no longer holds: this surface has a third density now, so take it off TWO_VALUED_SURFACES').toBe(hash('pocket'));
    });
  } else {
    it('renders differently in Simple and Pocket', () => {
      expect(hash('simple'), 'Pocket paints the same pixels as Simple').not.toBe(hash('pocket'));
    });
  }
});
