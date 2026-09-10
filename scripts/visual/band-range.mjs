/**
 * V2.2: where the band sits at 390x844, and what is under it.
 *
 *   node scripts/visual/band-range.mjs
 *
 * Opens the party screen's Release confirm and prints the band body's y-range,
 * then, for the day Release A lands, where the move replacement screen's
 * pinned incoming card sits on the same viewport, so the report can say
 * whether the band would cover it.
 */
import { launch, openApp, playUntil, serve, visible } from './browser.mjs';

const server = await serve('dist');
const browser = await launch();
try {
  const { page, context } = await openApp(browser, server.url, 'SMOKE24');
  await playUntil(page, (screen) => screen === 'map');
  await page.locator(`${visible('map')} .party__header .button`).click();
  await page.waitForSelector(visible('party'));
  // A party of one cannot release, so the button is disabled; force the band
  // open through the helper's DOM instead by using the backpack discard when
  // there is one, else a script-opened band of the same shape.
  const discard = page.locator(`${visible('party')} .backpack__item .button--danger`).first();
  if (await discard.count()) await discard.click();
  else {
    await page.locator(`${visible('party')} .button--danger`).first().evaluate((el) => {
      el.disabled = false;
      el.click();
    });
  }
  await page.waitForSelector('.confirm-band');
  const band = await page.locator('.confirm-band__body').boundingBox();
  const accents = await page.evaluate(() => {
    const accent = globalThis.getComputedStyle(globalThis.document.documentElement).getPropertyValue('--accent').trim();
    const probe = globalThis.document.createElement('span');
    probe.style.color = accent;
    globalThis.document.body.append(probe);
    const rgb = globalThis.getComputedStyle(probe).color;
    probe.remove();
    return [...globalThis.document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && globalThis.getComputedStyle(b).backgroundColor === rgb).map((b) => b.textContent);
  });
  console.log(JSON.stringify({ band: { top: band.y, bottom: band.y + band.height, height: band.height }, accentButtonsVisible: accents }));
  await page.locator('.confirm-band .button--hollow').click();
  await page.locator(`${visible('party')} .primary-action`).click();
  await playUntil(page, (screen) => screen === 'replace', 900).catch(() => null);
  const pinned = await page.locator(`${visible('replace')} .replace__incoming`).boundingBox().catch(() => null);
  console.log(JSON.stringify({ replaceIncomingCard: pinned ? { top: pinned.y, bottom: pinned.y + pinned.height } : 'not reached on this seed' }));
  await context.close();
} finally {
  await browser.close();
  server.close();
}
