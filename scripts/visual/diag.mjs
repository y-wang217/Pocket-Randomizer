/**
 * Per-element heights on a guarded screen, for finding what moved.
 *
 *   node scripts/visual/diag.mjs <dist dir> <map|battle> [seed]
 *
 * Prints every element under the open screen with its class, top and height,
 * so two builds can be diffed line by line. A debugging instrument, not a gate.
 */
import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const [dir, screen = 'map', seed = 'SMOKE24'] = process.argv.slice(2);
const server = await serve(dir);
const browser = await launch();
try {
  const { page, context } = await openApp(browser, server.url, seed);
  await playUntil(page, (open) => open === screen);
  await page.waitForTimeout(600);
  const rows = await page.evaluate((selector) => {
    const root = globalThis.document.querySelector(selector);
    const out = [];
    const r = (n) => Math.round(n * 10) / 10;
    for (const el of root.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;
      const cls = el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : el.tagName;
      out.push(`${cls.padEnd(36)} y=${r(rect.top + globalThis.window.scrollY)} h=${r(rect.height)} w=${r(rect.width)}`);
    }
    return out;
  }, visible(screen));
  console.log(rows.join('\n'));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
