/**
 * The figure, as the browser reads it. **Idle-sprites patch.**
 *
 * Chromium rather than jsdom, because every assertion here is about computed
 * style: that the figure animates, that two figures on one surface start at
 * different points of the loop, that reduced motion holds every one of them
 * still, and that a figure costs its card nothing in the flow. The DOM half —
 * which surfaces carry one and with what phase — is `test/sprites.test.ts`.
 *
 * Measured on the gallery's worst-case fixtures, the same pages the Pocket
 * gate reads, with the sprite CDN aborted: a figure is a fixed box whether or
 * not its image arrived, and this file measures boxes.
 */
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import type { GallerySurface } from '../src/ui/gallery-surfaces';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

async function open(
  browser: Browser,
  surface: GallerySurface,
  density: 'detailed' | 'pocket',
  options: { reducedMotion?: 'reduce' | 'no-preference' } = {},
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: PHONE, reducedMotion: options.reducedMotion ?? 'no-preference' });
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=SMOKE24&screen=${surface}&density=${density}&fixture=loaded`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  return { page, close: () => context.close() };
}

interface FigureReading {
  name: string;
  duration: string;
  delay: string;
  size: number;
  /** Whether the figure sits out of the flow: absolutely positioned inside its host. */
  absolute: boolean;
}

async function readFigures(page: Page): Promise<FigureReading[]> {
  return page.evaluate(() =>
    [...globalThis.document.querySelectorAll<HTMLElement>('.figure')].map((figure) => {
      // The CDN is aborted here, so every sprite is missing and the
      // missing-sprite rule has stopped its bob. Clear the mark to read the
      // figure as a player with the network sees it; the rule itself is the
      // last case below.
      figure.querySelector('.sprite')?.removeAttribute('data-missing');
      const style = globalThis.getComputedStyle(figure);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        delay: style.animationDelay,
        size: figure.getBoundingClientRect().width,
        absolute: style.position === 'absolute',
      };
    }),
  );
}

describe('the idle bob', () => {
  it('does not run on an empty box: a sprite the CDN did not have holds still', async () => {
    const { page, close } = await open(harness.browser, 'party', 'detailed');
    // The first card's sprite is in the viewport, so its lazy request is made
    // and aborted; the mark lands when the error fires. A card below the fold
    // never requests, so it is never marked, and is not read here.
    await page.waitForFunction(() => globalThis.document.querySelector('.figure > .sprite')?.getAttribute('data-missing') === 'true', undefined, { timeout: 10_000 });
    const name = await page.evaluate(() => globalThis.getComputedStyle(globalThis.document.querySelector('.figure')!).animationName);
    await close();
    expect(name).toBe('none');
  });

  it('runs on every figure of the party screen, phased by slot, out of the flow', async () => {
    const { page, close } = await open(harness.browser, 'party', 'detailed');
    const figures = await readFigures(page);
    await close();
    expect(figures.length).toBeGreaterThanOrEqual(2);
    for (const figure of figures) {
      expect(figure.name).toBe('figure-idle');
      expect(parseFloat(figure.duration)).toBeGreaterThan(0);
      expect(figure.absolute).toBe(true);
      expect(figure.size).toBe(48);
    }
    // Six bodies, not one mechanism: the first two slots start apart.
    expect(figures[0]?.delay).not.toBe(figures[1]?.delay);
  });

  it('is smaller on a member card in Pocket, where the head is the whole card', async () => {
    const { page, close } = await open(harness.browser, 'party', 'pocket');
    const figures = await readFigures(page);
    await close();
    expect(figures.length).toBeGreaterThanOrEqual(2);
    for (const figure of figures) expect(figure.size).toBe(24);
  });

  it('holds still under reduced motion, on every surface that carries one', async () => {
    // The event gate's figures ride the same `.figure` rule; the gallery's
    // event fixture is not pinned to the `latent` band, so it is not listed.
    for (const surface of ['starter', 'replace', 'target', 'party'] as const) {
      const { page, close } = await open(harness.browser, surface, 'detailed', { reducedMotion: 'reduce' });
      const figures = await readFigures(page);
      await close();
      expect(figures.length, `${surface} carries a figure`).toBeGreaterThan(0);
      for (const figure of figures) expect(figure.name, surface).toBe('none');
    }
  }, 300_000);
});
