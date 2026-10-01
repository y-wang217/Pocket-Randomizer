/**
 * The battle stage against every backdrop, under every field state.
 * **Stage 5.0/5**, the art pass's third bullet: *"Check HP box and text
 * contrast against every battle backdrop."* The rulings before 5.0/5 (item 7)
 * made it a measured test across 9 backdrops by 10 field states, and D60 had
 * already said the field state is part of the question (the wash and the
 * tint sit on the backdrop).
 *
 * ## What the backdrop can and cannot reach
 *
 * Measured first, then asserted: **no text and no glyph on the stage is drawn
 * on the bare backdrop.** Every one sits inside the HP box, which is an
 * opaque panel, so the backdrop cannot move a text contrast reading at all,
 * and the first test below holds that, because the day a word is drawn
 * straight onto the art is the day this file needs a text reading per
 * backdrop.
 *
 * What the backdrop does reach is **the HP box against its surroundings**:
 * whether the panel reads as a panel on a painting. That is a non-text
 * contrast, WCAG 2 1.4.11's 3:1, read off rendered pixels in the art's way:
 * the dominant colour in a band just outside the box, against the box's
 * border and against its fill, and the better of the two is the edge the eye
 * finds. Both readings are kept in the failure message.
 *
 * Every backdrop is put behind the loaded board in turn, through the same
 * three properties `applyBackdrop` writes, so the board, its panels and its
 * field state are one battle's truth and only the painting changes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PHONE } from '../scripts/visual/browser.mjs';
import { ratio } from '../scripts/visual/contrast.mjs';
import { LOCALES } from '../src/data/locales';
import { NATIVE } from '../src/ui/assets/manifest';
import { openHarness, type Harness } from './visual/harness';

/** WCAG 2, 1.4.11: a user interface component against what is adjacent to it. */
const NON_TEXT_FLOOR = 3;

const BACKDROPS = [...LOCALES.map((locale) => locale.id), 'gym'] as const;
/** None, five weathers, four terrains: ten states (`gallery.ts`'s setters). */
const FIELDS = ['weather=none', 'weather=rain', 'weather=sun', 'weather=sand', 'weather=snow', 'weather=wind', 'weather=none&terrain=electric', 'weather=none&terrain=grassy', 'weather=none&terrain=misty', 'weather=none&terrain=psychic'] as const;

const STAGE = '.screen[data-screen="battle"] .stage';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 300_000);

afterAll(async () => {
  await harness?.close();
});

async function open(browser: Browser, field: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=V5-LOADED-1&screen=battle&fixture=loaded&exposure=exhausted&${field}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
  await page.evaluate(() => globalThis.document.fonts.ready);
  return { page, context };
}

/** Put one painting behind the stage, as `applyBackdrop` does. */
async function paint(page: Page, id: string): Promise<void> {
  const png = `data:image/png;base64,${readFileSync(join('src/ui/assets/backdrops/battle', `${id}.png`)).toString('base64')}`;
  await page.evaluate(
    ({ selector, key, png, width, height }) => {
      const stage = globalThis.document.querySelector<HTMLElement>(selector);
      if (!stage) return;
      stage.dataset['backdrop'] = key;
      stage.dataset['art'] = 'file';
      stage.style.setProperty('--backdrop-image', `url(${png})`);
      stage.style.setProperty('--backdrop-w', String(width));
      stage.style.setProperty('--backdrop-h', String(height));
    },
    { selector: STAGE, key: `battle-backdrop:${id}`, png, width: NATIVE.battleBackdrop.width, height: NATIVE.battleBackdrop.height },
  );
  await page.waitForTimeout(40);
}

interface Edge {
  panel: string;
  border: number;
  fill: number;
  around: [number, number, number];
}

/** Each HP box on the stage: its border and fill against the art around it. */
async function edges(page: Page): Promise<Edge[]> {
  const boxes = await page.evaluate((selector) => {
    const stage = globalThis.document.querySelector(selector);
    if (!stage) return [];
    const rgb = (value: string): [number, number, number] => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
    return [...stage.querySelectorAll<HTMLElement>('.panel')]
      .filter((panel) => panel.getBoundingClientRect().width > 0)
      .map((panel) => {
        const rect = panel.getBoundingClientRect();
        const style = globalThis.getComputedStyle(panel);
        return {
          panel: panel.dataset['side'] ?? panel.className,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          border: rgb(style.borderTopColor),
          fill: rgb(style.backgroundColor),
        };
      });
  }, STAGE);
  const out: Edge[] = [];
  const BAND = 6;
  // The stage's own frame is not the art: the band is kept inside its border,
  // or a box set two pixels from the frame reads the frame's colour as
  // "around" (the foe's box did, at first, on every backdrop alike).
  const stageBox = await page.evaluate((selector) => {
    const stage = globalThis.document.querySelector<HTMLElement>(selector)!;
    const rect = stage.getBoundingClientRect();
    return { x: rect.x + stage.clientLeft, y: rect.y + stage.clientTop, width: stage.clientWidth, height: stage.clientHeight };
  }, STAGE);
  for (const box of boxes) {
    // The band outside the box, kept inside the stage: only the art counts.
    const clip = {
      x: Math.max(stageBox.x, box.rect.x - BAND),
      y: Math.max(stageBox.y, box.rect.y - BAND),
      width: 0,
      height: 0,
    };
    clip.width = Math.min(stageBox.x + stageBox.width, box.rect.x + box.rect.width + BAND) - clip.x;
    clip.height = Math.min(stageBox.y + stageBox.height, box.rect.y + box.rect.height + BAND) - clip.y;
    const png = await page.screenshot({ clip });
    const inner = { x: box.rect.x - clip.x, y: box.rect.y - clip.y, width: box.rect.width, height: box.rect.height };
    const around = await page.evaluate(
      async ({ base64, inner }) => {
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
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            // Outside the box only: the ring of art the panel stands in.
            if (x >= inner.x - 1 && x < inner.x + inner.width + 1 && y >= inner.y - 1 && y < inner.y + inner.height + 1) continue;
            const i = (y * img.width + x) * 4;
            const key = `${data[i]! >> 3},${data[i + 1]! >> 3},${data[i + 2]! >> 3}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        let best: [string, number] | null = null;
        for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
        return (best?.[0] ?? '0,0,0').split(',').map((v) => (Number(v) << 3) + 4) as [number, number, number];
      },
      { base64: png.toString('base64'), inner },
    );
    out.push({ panel: box.panel, border: ratio(box.border, around), fill: ratio(box.fill, around), around });
  }
  return out;
}

describe('the stage on every backdrop', () => {
  it('draws no text and no glyph on the bare backdrop: all of it sits on an opaque panel', async () => {
    const { page, context } = await open(harness.browser, 'weather=rain');
    const bare = await page.evaluate((selector) => {
      const stage = globalThis.document.querySelector(selector);
      if (!stage) return ['no stage'];
      const opaque = (element: Element): boolean => {
        const style = globalThis.getComputedStyle(element);
        const alpha = Number((style.backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? 1);
        return alpha > 0.5;
      };
      const found: string[] = [];
      for (const element of stage.querySelectorAll<HTMLElement>('*')) {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        if (!rect.width || style.display === 'none' || style.visibility === 'hidden') continue;
        const text = [...element.childNodes].some((child) => child.nodeType === 3 && (child.textContent ?? '').trim() !== '');
        if (!text && !element.classList.contains('glyph')) continue;
        let covered = false;
        for (let up: Element | null = element.parentElement; up && up !== stage; up = up.parentElement) {
          if (opaque(up)) {
            covered = true;
            break;
          }
        }
        if (!covered && !opaque(element)) found.push(`${element.className}: ${(element.textContent ?? '').trim().slice(0, 24)}`);
      }
      return found;
    }, STAGE);
    expect(bare).toEqual([]);
    await context.close();
  }, 120_000);

  for (const field of FIELDS) {
    it(`keeps both HP boxes distinct from all nine backdrops under ${field}`, async () => {
      const { page, context } = await open(harness.browser, field);
      const failures: string[] = [];
      let measured = 0;
      for (const id of BACKDROPS) {
        await paint(page, id);
        for (const edge of await edges(page)) {
          measured++;
          const best = Math.max(edge.border, edge.fill);
          if (best < NON_TEXT_FLOOR) failures.push(`${id} ${edge.panel}: border ${edge.border.toFixed(2)}, fill ${edge.fill.toFixed(2)} against rgb(${edge.around.join(',')})`);
        }
      }
      expect(measured, 'two HP boxes on each of nine backdrops').toBe(BACKDROPS.length * 2);
      expect(failures).toEqual([]);
      await context.close();
    }, 240_000);
  }
});
