/**
 * Every slot a node can take, drawn over every map backdrop. **Stage 5.0/5.**
 *
 *   npx vite-node scripts/visual/slot-overlay.ts [--out DIR]
 *
 * The art pass's second bullet: *"Tune per-backdrop slot grids so nodes sit on
 * plausible ground, not in water or on rooftops."* The rulings before 5.0/5
 * (item 6) make it a check before it is a change: an entry in `BACKDROP_GRIDS`
 * only where a node lands on water or a roof, and an empty table is a valid
 * outcome.
 *
 * A seed shows the slots its own steps happen to use. This shows all of them:
 * the gallery's worst case (`deepMapState`, seven steps) is mounted at each
 * size, each locale's painting is put behind it in turn, and every step row
 * gets a ring at every place a node could stand, for two options and for
 * three, by `slotX`, the function the map itself places nodes with. The rings
 * are the question; the real nodes on the row are context.
 *
 * Nothing asserts. A person reads the sheets, as the plan's outcome asks
 * (*"nodes sit on plausible ground"*), and the report says what was read.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

import { launch, serve } from './browser.mjs';
import { LOCALES } from '../../src/data/locales';
import { slotX } from '../../src/ui/map-layout';

const args = process.argv.slice(2);
const at = args.indexOf('--out');
const out = at === -1 ? join(tmpdir(), 'gymrun-slot-overlay') : (args[at + 1] ?? '');
const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1366, height: 768 },
  { name: 'se', width: 375, height: 667 },
];
const STEPS = 10;

mkdirSync(out, { recursive: true });
const dist = mkdtempSync(join(tmpdir(), 'gymrun-slots-'));
await build({
  configFile: join(process.cwd(), 'vite.gallery.config.ts'),
  logLevel: 'silent',
  build: { outDir: dist, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
});
const server = await serve(dist);
const browser = await launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.route(/play\.pokemonshowdown\.com/, (route) => route.abort());
    await page.goto(`${server.url}/gallery.html#screen=map&seed=SMOKE24`, { waitUntil: 'load' });
    await page.waitForSelector('html[data-gallery-ready="true"]', { timeout: 60_000 });
    for (const locale of LOCALES) {
      const png = `data:image/png;base64,${readFileSync(join('src/ui/assets/backdrops/map', `${locale.id}.png`)).toString('base64')}`;
      // Every slot, per step index, for two and for three options.
      const slots: number[][] = [];
      for (let step = 0; step < STEPS; step++) {
        slots.push([0, 1].map((option) => slotX(locale.id, step, 2, option)).concat([0, 1, 2].map((option) => slotX(locale.id, step, 3, option))));
      }
      await page.evaluate(
        ({ png, slots }) => {
          const graph = document.querySelector<HTMLElement>('.screen--map .map-graph, .map-graph:not(.map-drawer__chain)');
          if (!graph) return;
          graph.style.setProperty('--backdrop-image', `url(${png})`);
          for (const ghost of document.querySelectorAll('.slot-ghost')) ghost.remove();
          for (const row of document.querySelectorAll<HTMLElement>('.map-graph:not(.map-drawer__chain) .step[data-step]')) {
            const nodes = row.querySelector('.step__nodes');
            const xs = slots[Number(row.dataset['step'])] ?? [];
            xs.forEach((x, n) => {
              const ghost = document.createElement('span');
              ghost.className = 'slot-ghost';
              // Two options in magenta, three in cyan: both rings are drawn
              // where a two-slot and a three-slot coincide.
              ghost.style.cssText = `position:absolute;left:${x}%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);border:3px solid ${n < 2 ? '#ff2bd6' : '#00e5ff'};border-radius:50%;z-index:9;pointer-events:none;box-shadow:0 0 0 1px #000`;
              nodes?.append(ghost);
            });
          }
        },
        { png, slots },
      );
      await page.waitForTimeout(60);
      await page.locator('.map-graph:not(.map-drawer__chain)').screenshot({ path: join(out, `${size.name}-${locale.id}.png`) });
    }
    await page.close();
  }
  console.log(`slot-overlay: ${SIZES.length * LOCALES.length} sheets in ${out}`);
} finally {
  await browser.close();
  server.close();
  rmSync(dist, { recursive: true, force: true });
}
