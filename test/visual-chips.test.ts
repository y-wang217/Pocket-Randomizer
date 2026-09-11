/**
 * The chip legibility floor, swept over every chip surface. **Patch 4.7.2.**
 *
 * Two numbers, both in `data/tuning.ts` rather than here: the smallest a chip's
 * text may render, and the smallest contrast ratio between that text and what
 * is actually behind it. This file is the instrument that makes them bite.
 *
 * ## Why a browser, and why rendered pixels
 *
 * Neither question has a computed answer. **Size** is a computed property, but
 * which rule wins on a given chip is not — the failure this patch fixes was a
 * media query at 420px quietly overriding a tag down to 9px, which no reading
 * of a single rule would have caught. **Contrast** is worse: a chip's fill is
 * `color-mix(… transparent)` over whatever it happens to sit on, which on the
 * map is a gradient with a locale glow and a watermark through it. No computed
 * property says what that came out as. So the background is sampled from a
 * screenshot of the chip's own box, the same way `scripts/visual/contrast.mjs`
 * has sampled the V1 text rule since that stage, and `ratio` is imported from
 * there rather than reimplemented.
 *
 * The dominant colour inside a chip's box is its fill: the label's glyphs are a
 * minority of the pixels at any chip size, and quantising to 4-value steps stops
 * anti-aliasing splitting the mode.
 *
 * ## Per surface, and the sweep has to be non-vacuous
 *
 * "Asserted per surface" is the brief's own instruction and it is not pedantry:
 * a floor checked over whatever chips a run happened to render is a floor that
 * silently stops covering the variant nobody reached. So chips are grouped by
 * their `chip--*` variant, every variant is asserted separately, and the set of
 * variants *seen* is asserted against the set `ui/chip.ts` can build. A run that
 * fails to reach one fails this test rather than passing quietly.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, openScreen, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { ratio } from '../scripts/visual/contrast.mjs';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/**
 * Every variant `ui/chip.ts` builds.
 *
 * Restated here rather than imported, deliberately: importing `ChipVariant`
 * would make the list and the thing it checks the same object, so a variant
 * deleted from the union would silently leave the sweep too. This is the list a
 * reader would write down, and it going stale is the point at which somebody
 * has to look.
 *
 * `capability` and `capability-band` are the node gate's two chips, which need
 * a gated node on the route; `flag` is a post-resolution word, which needs a
 * turn that produced one. Both are reachable on SMOKE24 and both are asserted
 * below, so if a tuning pass moves the route this test says so.
 */
const VARIANTS = [
  'type',
  'tier',
  'band',
  'status',
  'stage',
  'capability',
  'capability-band',
  'category',
  'effect',
  'flag',
  'neutral',
] as const;

interface ChipSample {
  variant: string;
  screen: string;
  text: string;
  fontSize: number;
  color: [number, number, number];
  background: [number, number, number];
  ratio: number;
}

/** rgb(), and the `color(srgb …)` form a `color-mix()` computes to. */
function parseColor(text: string): [number, number, number] | null {
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
  if (srgb) return [1, 2, 3].map((i) => Math.round(Number(srgb[i]) * 255)) as [number, number, number];
  return null;
}

/**
 * Sample the modal colour inside each of several boxes of one decoded PNG.
 *
 * **One screenshot per screen, not one per chip**, and the difference is not a
 * micro-optimisation: a chip-at-a-time sweep of a full run did not finish in
 * fifteen minutes, because every chip cost a screenshot round trip plus its own
 * decode. A full-page shot plus N box reads off one `ImageData` finishes in
 * seconds and asks the same question of the same pixels.
 *
 * Boxes are in page coordinates, so a chip below the fold needs no scrolling
 * and nothing about the run's layout has to be disturbed to measure it.
 *
 * Quantised to 4-value steps so anti-aliasing does not split the mode. The
 * modal colour inside a chip's box is its fill: the label's glyphs are a
 * minority of the pixels at any chip size.
 */
async function sampleBoxes(
  scratch: Page,
  png: Buffer,
  boxes: { x: number; y: number; width: number; height: number }[],
): Promise<([number, number, number] | null)[]> {
  return scratch.evaluate(
    async ([base64, regions]) => {
      const img = new globalThis.Image();
      img.src = `data:image/png;base64,${base64 as string}`;
      await img.decode();
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return (regions as { x: number; y: number; width: number; height: number }[]).map((box) => {
        const x = Math.max(0, Math.round(box.x));
        const y = Math.max(0, Math.round(box.y));
        const w = Math.min(Math.round(box.width), img.width - x);
        const h = Math.min(Math.round(box.height), img.height - y);
        if (w < 1 || h < 1) return null;
        const { data } = ctx.getImageData(x, y, w, h);
        const counts = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const key = `${data[i]! >> 2},${data[i + 1]! >> 2},${data[i + 2]! >> 2}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        let best: [string, number] | null = null;
        for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
        return best![0].split(',').map((v) => (Number(v) << 2) + 2) as [number, number, number];
      });
    },
    [png.toString('base64'), boxes] as const,
  );
}

/** Every rendered chip on the screen currently open, measured. */
async function chipsOn(page: Page, scratch: Page, screen: string): Promise<ChipSample[]> {
  const found = await page.evaluate((sel) => {
    const root = globalThis.document.querySelector(sel);
    if (!root) return [];
    return [...root.querySelectorAll('.chip')].flatMap((node) => {
      const rect = node.getBoundingClientRect();
      const style = globalThis.getComputedStyle(node);
      // Present but not rendered — inside a closed overlay, or on a turn that
      // did not produce one. Skipping it is right; skipping it *silently* is
      // what the variant assertion catches.
      if (rect.width < 1 || rect.height < 1) return [];
      if (style.visibility === 'hidden' || style.opacity === '0') return [];
      const variant = [...node.classList].find((name) => name.startsWith('chip--'))?.slice(6);
      if (!variant) return [];
      return [{
        variant,
        text: (node.textContent ?? '').trim(),
        fontSize: Number.parseFloat(style.fontSize),
        color: style.color,
        // Page coordinates, to index into a full-page screenshot.
        box: {
          x: rect.left + globalThis.scrollX,
          y: rect.top + globalThis.scrollY,
          width: rect.width,
          height: rect.height,
        },
      }];
    });
  }, visible(screen));

  if (found.length === 0) return [];
  const png = await page.screenshot({ fullPage: true });
  const backgrounds = await sampleBoxes(scratch, png, found.map((chip) => chip.box));

  const out: ChipSample[] = [];
  for (const [index, chip] of found.entries()) {
    const color = parseColor(chip.color);
    const background = backgrounds[index];
    if (!color || !background) continue;
    out.push({
      variant: chip.variant,
      screen,
      text: chip.text,
      fontSize: chip.fontSize,
      color,
      background,
      ratio: ratio(color, background),
    });
  }
  return out;
}

/**
 * One full run, sampling every chip on every screen it opens.
 *
 * **First visit is not enough, and finding that out is what this comment is
 * for.** A sweep that sampled only the first render of each screen collected
 * eight of the eleven variants and reported the other three as "never
 * rendered": a stat stage chip needs a turn that moved a stat, a flag word
 * needs a turn that resolved into one, and the two gate chips need a gated node
 * on the route. None of the three exists on the frame a screen first opens.
 *
 * So the trigger to sample is **"this screen is showing a variant I have not
 * measured yet"**, checked with one cheap read per step, with first visits
 * sampled as well so a surface with nothing new on it is still covered. It
 * stops re-sampling once all eleven are in hand, so the cost is bounded by the
 * variant list rather than by the length of the run.
 */
async function sweep(): Promise<ChipSample[]> {
  const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
  const scratch = await context.newPage();
  await scratch.setContent('<canvas></canvas>');
  const samples: ChipSample[] = [];
  const seenScreens = new Set<string>();
  const seenVariants = new Set<string>();
  let openedParty = false;

  /** The chip variants on screen right now. One evaluate, no screenshot. */
  const variantsOn = (screen: string): Promise<string[]> =>
    page.evaluate((sel) => {
      const root = globalThis.document.querySelector(sel);
      if (!root) return [];
      return [...new Set([...root.querySelectorAll('.chip')].flatMap((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return [];
        const variant = [...node.classList].find((name) => name.startsWith('chip--'))?.slice(6);
        return variant ? [variant] : [];
      }))];
    }, visible(screen));

  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (!screen) {
      await page.waitForTimeout(40);
      continue;
    }
    // The party screen carries chips no other surface does — the lead marker,
    // the held item, the archetype — and the run never routes through it on its
    // own, so it is opened once from the map exactly as V2's stamp sweep does.
    if (screen === 'map' && !openedParty) {
      await page.locator(`${visible('map')} .party__header .button`).click();
      await page.waitForTimeout(50);
      openedParty = true;
      continue;
    }

    const fresh = !seenScreens.has(screen);
    const novel =
      seenVariants.size < VARIANTS.length &&
      (await variantsOn(screen)).some((variant) => !seenVariants.has(variant));

    if (fresh || novel) {
      seenScreens.add(screen);
      // The pointer rests where the last click landed, which is a hover state
      // on whatever is under it, and a hover changes a chip's contrast.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      const found = await chipsOn(page, scratch, screen);
      for (const sample of found) seenVariants.add(sample.variant);
      samples.push(...found);
    }

    if (screen === 'summary') break;
    await stepOnce(page);
    await page.waitForTimeout(25);
  }
  await context.close();
  return samples;
}

describe('the chip legibility floor', () => {
  let samples: ChipSample[];

  beforeAll(async () => {
    samples = await sweep();
  }, 900_000);

  it('reaches every variant ui/chip.ts can build, so the sweep is not vacuous', () => {
    const seen = new Set(samples.map((sample) => sample.variant));
    expect([...seen].sort()).toEqual([...VARIANTS].sort());
  });

  /*
   * Per surface rather than over the pile, and both floors read off `Tuning`.
   *
   * A single `every()` over every chip in the run would report one offender and
   * stop, which on a floor being raised for the first time means finding them
   * one build at a time. Grouping by variant and asserting each reports the
   * whole picture in one run, and it is what "asserted per surface" asks for.
   */
  for (const variant of VARIANTS) {
    it(`renders the ${variant} chip at or above the size floor on every surface`, () => {
      const mine = samples.filter((sample) => sample.variant === variant);
      expect(mine.length, `no ${variant} chip was rendered`).toBeGreaterThan(0);
      const under = mine
        .filter((sample) => sample.fontSize < DEFAULT_TUNING.minChipFontSizePx)
        .map((sample) => `${sample.screen} "${sample.text}" ${sample.fontSize}px`);
      expect(under, `below tuning.minChipFontSizePx (${DEFAULT_TUNING.minChipFontSizePx})`).toEqual([]);
    });

    it(`renders the ${variant} chip at or above the contrast floor on every surface`, () => {
      const mine = samples.filter((sample) => sample.variant === variant);
      expect(mine.length, `no ${variant} chip was rendered`).toBeGreaterThan(0);
      const under = mine
        .filter((sample) => sample.ratio < DEFAULT_TUNING.minChipContrastRatio)
        .map((sample) => `${sample.screen} "${sample.text}" ${sample.ratio}:1 rgb(${sample.color}) on rgb(${sample.background})`);
      expect(under, `below tuning.minChipContrastRatio (${DEFAULT_TUNING.minChipContrastRatio})`).toEqual([]);
    });
  }
});
