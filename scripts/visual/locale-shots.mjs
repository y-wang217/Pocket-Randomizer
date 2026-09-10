/**
 * The map (and optionally the battle) in every locale's palette, at 390x844.
 *
 *   node scripts/visual/locale-shots.mjs --out docs/visual/reports/v1-locales [--screens map,battle]
 *
 * Plays SMOKE24 to the screen, then re-tags <html data-locale> and the map's
 * watermark for each locale in turn. Not a run walked into each region, which
 * would take eight runs; the same screen wearing each palette, which is what
 * the eye is asked to compare.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out') ?? 'stats/locales';
const screens = (flag('--screens') ?? 'map').split(',');
const dist = flag('--dist') ?? 'dist';
const LOCALES = ['cave', 'shore', 'summit', 'city', 'forest', 'ruins', 'marsh', 'badlands'];
const NAMES = { cave: 'Cave', shore: 'Shore', summit: 'Summit', city: 'City', forest: 'Forest', ruins: 'Ruins', marsh: 'Marsh', badlands: 'Badlands' };

mkdirSync(out, { recursive: true });
const server = await serve(dist);
const browser = await launch();
try {
  const { page, context } = await openApp(browser, server.url, 'SMOKE24');
  for (const screen of screens) {
    await playUntil(page, (open) => open === screen);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    for (const id of LOCALES) {
      await page.evaluate(
        ([locale, name, sel]) => {
          globalThis.document.documentElement.setAttribute('data-locale', locale);
          const map = globalThis.document.querySelector(sel);
          if (map) map.setAttribute('data-watermark', name);
        },
        [id, NAMES[id], visible('map')],
      );
      await page.waitForTimeout(80);
      const file = join(out, `${screen}-${id}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}
