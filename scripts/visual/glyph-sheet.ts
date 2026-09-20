/**
 * The glyph sheet's contact sheet, colour-blind check and 16px separation test.
 *
 * **Milestone M1.1.**
 *
 *   npx vite-node scripts/visual/glyph-sheet.ts          # render and measure
 *   npx vite-node scripts/visual/glyph-sheet.ts --write  # also write the PNGs
 *
 * Three outputs. A contact sheet per colour-blindness simulation under
 * `docs/visual/`, which is where M1.1 says to put them. A separation table,
 * which is the item's kills-it condition measured rather than asserted. And an
 * exit code, so `test/glyphs.test.ts` and a human get the same answer.
 *
 * ## Rendered in the app's own stylesheet
 *
 * The script builds the app, opens it, and then replaces the body with the
 * contact sheet. The app's CSS stays loaded, so a type chip here is coloured by
 * the same `.type--rock` rule the game uses and a status chip by the same
 * `[data-status]`. A sheet that invented its own colours would be a colour-blind
 * check of colours nothing ships.
 *
 * **No glyph is mounted on any screen by this.** The item forbids that, and the
 * body is replaced in a throwaway page, never in the app.
 *
 * ## Why the simulation is done twice, two different ways
 *
 * The **picture** uses an SVG `feColorMatrix` over the whole sheet, because
 * that is what a human wants to look at and it composites exactly as a browser
 * would.
 *
 * The **measurement** applies the same matrix numerically to pixels read back
 * from a canvas, because the question is "how far apart are these two marks"
 * and that is a number, not a look. Doing it in the page avoids decoding PNGs
 * in Node, which would need an image library this repo does not have.
 *
 * ## What the number means
 *
 * For each pair of glyphs in one family, both are rasterised at 16px, the
 * simulation matrix is applied, and the score is **the share of pixels that
 * differ**, where a pixel counts as differing if any channel moves by more than
 * 8/255. 0.0 means the two marks are the same picture; 1.0 means they share no
 * pixel.
 *
 * The floor is `SEPARATION_FLOOR`. It is a judgement, not a finding: 0.12 is
 * roughly "an eighth of the box disagrees", which at 16px is two or three
 * strokes' worth. The table carries every pair's real number so the floor can
 * be argued with. **A pair under the floor sends that pair back to be redrawn
 * before anything mounts it**, which is the item's own kills-it line.
 *
 * Colour is never the carrier — every mark is monochrome `currentColor` — so a
 * simulation cannot change a *shape* score. That is the point, and the table
 * showing identical numbers across four simulations is the evidence for it. The
 * simulations earn their keep on the two families that *are* coloured, type and
 * status, and those are judged from the pictures.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright';
import { build } from 'vite';

import { launch, serve } from './browser.mjs';
import { GLYPHS, GLYPH_FAMILIES, GLYPH_SIZES, GLYPH_VIEWBOX, type Glyph } from '../../src/ui/theme/glyphs';

export const SHEET_DIR = join(process.cwd(), 'docs/visual');

/** Below this share of differing pixels, a pair goes back to be redrawn. */
export const SEPARATION_FLOOR = 0.12;

/**
 * The four renderings. `none` is the control.
 *
 * Matrices are the Machado/Vienot approximations in common use for
 * deuteranopia, protanopia and tritanopia. They are here rather than imported
 * because they are three constants and a dependency for three constants is a
 * dependency to keep updated.
 */
export const SIMULATIONS = {
  none: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
} as const satisfies Record<string, readonly number[]>;

export type Simulation = keyof typeof SIMULATIONS;

export interface Separation {
  family: string;
  a: string;
  b: string;
  simulation: Simulation;
  score: number;
}

/** One glyph as SVG markup, or its lettering. */
function markup(glyph: Glyph, size: number): string {
  if (glyph.art.kind === 'text') {
    return `<span class="chip chip--status badge badge--status" data-status="${glyph.id.slice('status-'.length)}" style="font-size:${Math.round(size * 0.62)}px">${glyph.art.text}</span>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="${GLYPH_VIEWBOX}" fill="currentColor" aria-hidden="true">${glyph.art.markup}</svg>`;
}

/**
 * The coloured thing a family actually ships, beside its monochrome mark.
 *
 * The marks are `currentColor` by design, so a colour-blindness simulation
 * cannot move them and a sheet of only marks would be a colour check with no
 * colour in it. Two families carry real colour in the game — the type chip and
 * the status chip — and those are what the four pictures are for. The type
 * glyph is a *watermark behind* the chip in the app (`scene.ts`), never a
 * tinted icon, so it is drawn plain here and the chip is drawn beside it.
 */
function shipped(glyph: Glyph): string {
  if (glyph.family === 'type') {
    return `<span class="chip chip--type type type--${glyph.label.toLowerCase()}">${glyph.label}</span>`;
  }
  return '';
}

/** The contact sheet, as one HTML string. */
function sheetHtml(): string {
  const groups = GLYPH_FAMILIES.map((family) => {
    const rows = GLYPHS.filter((glyph) => glyph.family === family)
      .map(
        (glyph) =>
          `<figure class="g"><div class="g__art">${GLYPH_SIZES.map((size) => markup(glyph, size)).join('')}${shipped(glyph)}</div><figcaption>${glyph.id}</figcaption></figure>`,
      )
      .join('');
    return `<section><h2>${family}</h2><div class="row">${rows}</div></section>`;
  }).join('');
  return `<div id="sheet">${groups}</div>`;
}

const SHEET_CSS = `
#sheet { padding: 16px; display: grid; gap: 18px; }
#sheet h2 { font-size: 13px; margin: 0 0 6px; opacity: .7; text-transform: uppercase; letter-spacing: .08em; }
#sheet .row { display: flex; flex-wrap: wrap; gap: 10px; }
#sheet .g { margin: 0; width: 118px; display: grid; gap: 4px; justify-items: center; }
#sheet .g__art { display: flex; align-items: center; gap: 6px; min-height: 26px; }
#sheet figcaption { font-size: 9px; opacity: .6; text-align: center; word-break: break-all; }
`;

/** Put the contact sheet on the page, keeping the app's stylesheet. */
async function mountSheet(page: Page, html: string, css: string): Promise<void> {
  await page.evaluate(
    ({ html, css }) => {
      document.body.innerHTML = html;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      // Every filter the screenshots switch between, defined once.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.position = 'absolute';
      document.body.append(svg);
    },
    { html, css },
  );
}

/** Apply one simulation to the whole sheet, as a filter, for the picture. */
async function applyFilter(page: Page, simulation: Simulation): Promise<void> {
  await page.evaluate(
    ({ name, matrix }) => {
      const sheet = document.getElementById('sheet');
      if (!sheet) return;
      if (name === 'none') {
        sheet.style.filter = '';
        return;
      }
      const [r1, r2, r3, g1, g2, g3, b1, b2, b3] = matrix;
      const values = `${r1} ${r2} ${r3} 0 0  ${g1} ${g2} ${g3} 0 0  ${b1} ${b2} ${b3} 0 0  0 0 0 1 0`;
      const host = document.querySelector('svg[width="0"]');
      if (host) {
        host.innerHTML = `<filter id="cvd-${name}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${values}"/></filter>`;
      }
      sheet.style.filter = `url(#cvd-${name})`;
    },
    { name: simulation, matrix: [...SIMULATIONS[simulation]] },
  );
}

/**
 * Rasterise every glyph at 16px and score each within-family pair.
 *
 * Done entirely in the page: the SVG goes into an `Image` through a data URL,
 * is drawn to a 16x16 canvas, the simulation matrix is applied to the pixels,
 * and each pair is compared. Text glyphs are rasterised the same way by
 * drawing their lettering, so the status family is scored on the same scale as
 * the rest rather than exempted.
 */
async function measure(page: Page): Promise<Separation[]> {
  const payload = GLYPHS.map((glyph) => ({
    id: glyph.id,
    family: glyph.family as string,
    svg:
      glyph.art.kind === 'markup'
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="${GLYPH_VIEWBOX}" fill="#000">${glyph.art.markup}</svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><text x="8" y="12" font-family="monospace" font-size="9" text-anchor="middle" fill="#000">${glyph.art.text}</text></svg>`,
  }));

  return page.evaluate(
    async ({ glyphs, simulations }) => {
      const SIZE = 16;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return [];

      const pixelsOf = async (svg: string): Promise<Uint8ClampedArray> => {
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
        await image.decode();
        context.clearRect(0, 0, SIZE, SIZE);
        context.drawImage(image, 0, 0, SIZE, SIZE);
        return context.getImageData(0, 0, SIZE, SIZE).data;
      };

      const raster = new Map<string, Uint8ClampedArray>();
      for (const glyph of glyphs) raster.set(glyph.id, await pixelsOf(glyph.svg));

      const simulate = (data: Uint8ClampedArray, m: readonly number[]): Float32Array => {
        const out = new Float32Array(data.length);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          out[i] = (m[0] ?? 0) * r + (m[1] ?? 0) * g + (m[2] ?? 0) * b;
          out[i + 1] = (m[3] ?? 0) * r + (m[4] ?? 0) * g + (m[5] ?? 0) * b;
          out[i + 2] = (m[6] ?? 0) * r + (m[7] ?? 0) * g + (m[8] ?? 0) * b;
          out[i + 3] = data[i + 3] ?? 0;
        }
        return out;
      };

      const out: { family: string; a: string; b: string; simulation: string; score: number }[] = [];
      const families = [...new Set(glyphs.map((glyph) => glyph.family))];
      for (const family of families) {
        const members = glyphs.filter((glyph) => glyph.family === family);
        for (const [name, matrix] of Object.entries(simulations)) {
          for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
              const first = raster.get(members[i]?.id ?? '');
              const second = raster.get(members[j]?.id ?? '');
              if (!first || !second) continue;
              const a = simulate(first, matrix);
              const b = simulate(second, matrix);
              let differing = 0;
              for (let p = 0; p < a.length; p += 4) {
                // Composited against white, so a difference in coverage counts
                // as a difference in colour rather than being hidden in alpha.
                const flatten = (v: Float32Array, k: number): number[] => {
                  const alpha = (v[k + 3] ?? 0) / 255;
                  return [0, 1, 2].map((c) => (v[k + c] ?? 0) * alpha + 255 * (1 - alpha));
                };
                const [ar, ag, ab] = flatten(a, p);
                const [br, bg, bb] = flatten(b, p);
                if (
                  Math.abs((ar ?? 0) - (br ?? 0)) > 8 ||
                  Math.abs((ag ?? 0) - (bg ?? 0)) > 8 ||
                  Math.abs((ab ?? 0) - (bb ?? 0)) > 8
                ) {
                  differing++;
                }
              }
              out.push({
                family,
                a: members[i]?.id ?? '',
                b: members[j]?.id ?? '',
                simulation: name,
                score: differing / (SIZE * SIZE),
              });
            }
          }
        }
      }
      return out;
    },
    { glyphs: payload, simulations: Object.fromEntries(Object.entries(SIMULATIONS).map(([k, v]) => [k, [...v]])) },
  ) as Promise<Separation[]>;
}

/** The worst pair in each family, across every simulation. */
export function worstPerFamily(separations: readonly Separation[]): Separation[] {
  const worst = new Map<string, Separation>();
  for (const row of separations) {
    const held = worst.get(row.family);
    if (!held || row.score < held.score) worst.set(row.family, row);
  }
  return [...worst.values()];
}

async function main(): Promise<number> {
  const write = process.argv.includes('--write');
  const out = mkdtempSync(join(tmpdir(), 'gymrun-glyphs-'));
  await build({
    configFile: join(process.cwd(), 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
  });
  const server = await serve(out);
  const browser: Browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 980, height: 1400 } });
    await context.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await mountSheet(page, sheetHtml(), SHEET_CSS);

    if (write) {
      for (const simulation of Object.keys(SIMULATIONS) as Simulation[]) {
        await applyFilter(page, simulation);
        await page.waitForTimeout(80);
        const sheet = await page.$('#sheet');
        if (sheet) await sheet.screenshot({ path: join(SHEET_DIR, `m1.1-glyphs-${simulation}.png`) });
      }
      await applyFilter(page, 'none');
    }

    const separations = await measure(page);
    const worst = worstPerFamily(separations).sort((a, b) => a.score - b.score);
    const failures = worst.filter((row) => row.score < SEPARATION_FLOOR);

    console.log(`glyph-sheet: ${GLYPHS.length} glyphs, ${GLYPH_FAMILIES.length} families, ${separations.length} pair comparisons.`);
    console.log(`\nworst pair per family, any simulation (floor ${SEPARATION_FLOOR}):`);
    for (const row of worst) {
      const mark = row.score < SEPARATION_FLOOR ? 'UNDER' : '     ';
      console.log(`  ${mark} ${row.family.padEnd(14)} ${row.score.toFixed(3)}  ${row.a} vs ${row.b} (${row.simulation})`);
    }
    if (write) {
      writeFileSync(join(SHEET_DIR, 'm1.1-glyph-separation.json'), `${JSON.stringify({ floor: SEPARATION_FLOOR, worst, all: separations }, null, 1)}\n`);
      console.log(`\nwrote ${Object.keys(SIMULATIONS).length} sheets and the separation table to ${SHEET_DIR}`);
    }
    if (failures.length) {
      console.log(`\n${failures.length} family/families under the floor. M1.1's kills-it: redraw the pair before mounting.`);
      return 1;
    }
    return 0;
  } finally {
    await browser.close();
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}

if (!process.env['VITEST']) process.exit(await main());
