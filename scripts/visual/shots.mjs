/**
 * Screenshots of screens the bot reaches, at the phone viewport.
 *
 *   node scripts/visual/shots.mjs --out <dir> [--seed SMOKE24] [--full] [--prefix p-] screen [screen...]
 *
 * Plays the seed until each named screen is up, in the order the run reaches
 * them, and writes `<dir>/<prefix><screen>.png`. `--full` captures the whole
 * page rather than the viewport. Prints whether the display face loaded, so a
 * shot taken before the font arrived is never mistaken for the design.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { launch, openApp, playUntil, serve } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const out = flag('--out') ?? 'stats/visual';
const seed = flag('--seed') ?? 'SMOKE24';
const prefix = flag('--prefix') ?? '';
const full = args.includes('--full');
const dist = flag('--dist') ?? join(process.cwd(), 'dist');
const wanted = args.filter((arg, i) => !arg.startsWith('--') && !['--out', '--seed', '--prefix', '--dist'].includes(args[i - 1]));

mkdirSync(out, { recursive: true });
const server = await serve(dist);
const browser = await launch();
try {
  const { page, context, problems } = await openApp(browser, server.url, seed);
  const remaining = new Set(wanted);
  let guard = 0;
  while (remaining.size > 0 && guard++ < 900) {
    const screen = await playUntil(page, (open) => remaining.has(open), 900);
    remaining.delete(screen);
    await page.waitForTimeout(650);
    // 4.8.0.2: no web font to wait for. The whole UI is the system monospace
    // stack, which is present before the first paint.
    const file = join(out, `${prefix}${screen}.png`);
    await page.screenshot({ path: file, fullPage: full });
    console.log(file);
  }
  if (problems.length) console.error('page problems:', problems);
  await context.close();
} finally {
  await browser.close();
  server.close();
}
