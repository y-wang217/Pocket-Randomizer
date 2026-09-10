/**
 * V2.4: do the corner stamps collide with flow content on any screen?
 *
 *   node scripts/visual/stamps.mjs
 *
 * Plays SMOKE24 and, on every screen the bot reaches (plus the party screen),
 * samples what is painted under each rendered stamp's box, with
 * `elementsFromPoint`, so a row clipped inside a scrolled list does not
 * count and a card's edge does. The top stamps are checked at the top of the page and
 * the bottom stamps with the page scrolled to its end, because the stamps
 * are fixed to the viewport and content scrolls under them in between; the
 * corners are the two places a collision would be permanent. Prints one line
 * per screen and a verdict per stamp.
 */
import { launch, openApp, openScreen, playUntil, serve, stepOnce, visible } from './browser.mjs';

export async function stampCollisions(page) {
  return page.evaluate(() => {
    const doc = globalThis.document;
    const win = globalThis.window;
    const screen = doc.querySelector('.screen:not([hidden])');
    // What is painted under a point, less the page's own scaffolding. A
    // clipped row of a scrolled list is not painted, so it does not count;
    // a card's edge is, so it does.
    const scaffold = (node) => node === doc.documentElement || node === doc.body || node.id === 'app' || node.matches('.shell, .screens, .screen, .stamps, .stamp');
    const under = (x, y) => [...doc.elementsFromPoint(x, y)].filter((node) => !scaffold(node));
    const stamps = [...doc.querySelectorAll('.stamp')].filter((s) => !s.hidden);
    const results = [];
    for (const scroll of ['top', 'bottom']) {
      win.scrollTo(0, scroll === 'top' ? 0 : doc.documentElement.scrollHeight);
      for (const stamp of stamps) {
        const isTop = stamp.classList.contains('stamp--tl') || stamp.classList.contains('stamp--tr');
        if ((scroll === 'top') !== isTop) continue;
        const box = stamp.getBoundingClientRect();
        const hits = new Set();
        for (const fx of [0.05, 0.5, 0.95]) {
          for (const fy of [0.1, 0.5, 0.9]) {
            for (const node of under(box.left + box.width * fx, box.top + box.height * fy)) {
              hits.add(`${node.tagName.toLowerCase()}.${String(node.className).split(' ')[0]}`);
            }
          }
        }
        results.push({
          stamp: [...stamp.classList].find((c) => /^stamp--(tl|tr|bl|br)$/.test(c)),
          box: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)],
          hits: [...hits],
        });
      }
    }
    win.scrollTo(0, 0);
    return { screen: screen?.dataset.screen, results };
  });
}

if (process.argv[1] && /stamps\.mjs$/.test(process.argv[1])) {
  const server = await serve('dist');
  const browser = await launch();
  try {
    const { page, context } = await openApp(browser, server.url, 'SMOKE24');
    const seen = new Set();
    let opened = false;
    for (let step = 0; step < 600; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      if (screen === 'map' && !opened) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(50);
        opened = true;
        continue;
      }
      if (!seen.has(screen)) {
        seen.add(screen);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        const report = await stampCollisions(page);
        console.log(`${screen}: ${report.results.map((r) => `${r.stamp} ${r.hits.length ? 'HITS ' + r.hits.join(',') : 'clear'}`).join(' | ')}`);
      }
      if (screen === 'summary') break;
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    await playUntil(page, (s) => s === 'summary', 5).catch(() => null);
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
}
