/**
 * V0.5: the two things the legibility gate needs a phone for, at 390 wide.
 *
 *   node scripts/visual/legibility.mjs --out docs/visual/reports/v0-legibility
 *
 * The party management six-stat block and a 2x2 move grid, cropped to the
 * element so the morning can judge the face at the size it actually renders,
 * plus a 2x device-pixel version of each because that is what a phone shows.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const args = process.argv.slice(2);
const out = args[args.indexOf('--out') + 1] ?? 'stats/legibility';
mkdirSync(out, { recursive: true });

const server = await serve();
const browser = await launch();
try {
  for (const scale of [1, 2]) {
    const { page, context } = await openApp(browser, server.url, 'SMOKE24', { width: 390, height: 844 }, { deviceScaleFactor: scale });
    await playUntil(page, (screen) => screen === 'map');
    await page.locator(`${visible('map')} .party__header .button`).click();
    await page.waitForSelector(visible('party'));
    await page.waitForTimeout(300);
    await page.locator(`${visible('party')} .party__member .stats`).first().screenshot({ path: join(out, `six-stat-block@${scale}x.png`) });
    await page.locator(`${visible('party')} .party__member`).first().screenshot({ path: join(out, `party-card@${scale}x.png`) });
    await page.locator(`${visible('party')} .primary-action`).click();
    await playUntil(page, (screen) => screen === 'battle');
    await page.waitForTimeout(600);
    await page.locator(`${visible('battle')} .moves`).screenshot({ path: join(out, `move-grid@${scale}x.png`) });
    await page.locator(`${visible('battle')} .panel--me`).screenshot({ path: join(out, `battle-panel@${scale}x.png`) });
    await context.close();
    console.log(`wrote ${scale}x shots to ${out}`);
  }
} finally {
  await browser.close();
  server.close();
}
