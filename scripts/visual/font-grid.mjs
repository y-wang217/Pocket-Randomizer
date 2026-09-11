/**
 * Patch 4.8.0.2: does the pixel face land on the device's pixel grid?
 *
 *   node scripts/visual/font-grid.mjs [--out docs/visual/reports/patch-4.8.0.2]
 *
 * A pixel-styled face reads crisp only when every "pixel" of the design maps
 * to a whole number of device pixels. That is a property of the face's
 * outline (its pixel module, measured from the font file in the report) *and*
 * of the CSS size times the device pixel ratio. This script measures the
 * second half the only way that counts: it asks Chromium to paint the digits
 * at every size in the type scale, at 1x, 2x and 3x, and counts how much of
 * the ink is antialiased. A face on the grid paints solid pixels and nothing
 * between; a face off it paints grey edges, and at a reading size those grey
 * edges are what turns a 2 into an 8.
 *
 * Reported per size and weight, with and without the 0.08em label tracking
 * the stylesheet applies, because tracking in `em` moves every glyph origin
 * by a fraction of a device pixel even when the size itself is on the grid.
 *
 * Optionally writes crops of `2 8` at the reading sizes, at 3x, so the report
 * can show what the phone shows.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { launch, serve } from './browser.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : null;
if (out) mkdirSync(out, { recursive: true });

const SIZES = [9, 10, 11, 12, 12.48, 13, 14, 15, 16, 17, 18, 20, 24, 26, 44, 56];
const FACES = [
  { label: 'Pixelify Sans', family: '"Pixelify Sans"' },
  { label: 'mono stack', family: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' },
];

const server = await serve();
const browser = await launch();
const rows = [];
try {
  for (const scale of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto(server.url);
    await page.evaluate(() => Promise.all([
      globalThis.document.fonts.load('12px "Pixelify Sans"'),
      globalThis.document.fonts.load('bold 12px "Pixelify Sans"'),
    ]));

    for (const face of FACES) {
      for (const size of SIZES) {
        for (const weight of [400, 700]) {
          for (const tracking of [0, 0.08]) {
            const measured = await page.evaluate(({ family, size, weight, tracking, scale }) => {
              const canvas = globalThis.document.createElement('canvas');
              const width = Math.ceil(size * 12);
              const height = Math.ceil(size * 2);
              canvas.width = width * scale;
              canvas.height = height * scale;
              const ctx = canvas.getContext('2d');
              ctx.scale(scale, scale);
              ctx.font = `${weight} ${size}px ${family}`;
              if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking * size}px`;
              ctx.fillStyle = '#000';
              ctx.fillText('0123456789', 1, Math.round(size * 1.4));
              const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
              let solid = 0;
              let partial = 0;
              for (let i = 3; i < data.length; i += 4) {
                const alpha = data[i];
                if (alpha === 255) solid++;
                else if (alpha > 0) partial++;
              }
              return { solid, partial };
            }, { family: face.family, size, weight, tracking, scale });
            const ink = measured.solid + measured.partial;
            rows.push({
              face: face.label,
              scale,
              size,
              weight,
              tracking,
              antialiased: ink === 0 ? null : Number((measured.partial / ink).toFixed(3)),
            });
          }
        }
      }
    }

    if (out && scale === 3) {
      for (const size of [11, 12, 13, 24]) {
        for (const face of FACES) {
          const handle = await page.evaluateHandle(({ family, size }) => {
            const el = globalThis.document.createElement('div');
            el.style.cssText = `position:fixed;left:0;top:0;padding:4px;background:#0b0f1a;color:#f3ead7;font-family:${family};font-size:${size}px;line-height:1.4;z-index:99999;letter-spacing:0.08em`;
            el.textContent = '2 8 28 82 · 0123456789';
            globalThis.document.body.append(el);
            return el;
          }, { family: face.family, size });
          const element = handle.asElement();
          await element.screenshot({ path: join(out, `digits-${face.label.replace(/\W+/g, '-')}-${size}px@3x.png`) });
          await handle.evaluate((el) => el.remove());
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

/** One line per size: the antialiased share at each scale, regular weight, no tracking, then with tracking. */
const at = (face, scale, size, weight, tracking) =>
  rows.find((r) => r.face === face && r.scale === scale && r.size === size && r.weight === weight && r.tracking === tracking)?.antialiased;
console.log('| face | size | 1x | 2x | 3x | 3x bold | 3x tracked |');
console.log('|---|---|---|---|---|---|---|');
for (const face of FACES) {
  for (const size of SIZES) {
    console.log(
      `| ${face.label} | ${size} | ${at(face.label, 1, size, 400, 0)} | ${at(face.label, 2, size, 400, 0)} | ${at(face.label, 3, size, 400, 0)} | ${at(face.label, 3, size, 700, 0)} | ${at(face.label, 3, size, 400, 0.08)} |`,
    );
  }
}
if (out) console.log(`wrote 3x digit crops to ${out}`);
