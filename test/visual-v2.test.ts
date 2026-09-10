/**
 * Stage V2's browser assertions: the band, the slots, the stamps, the chips,
 * and the vertical budget. Computed style and layout questions, so Chromium.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureGuardedScreens, openApp, playUntil, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/** Visible buttons whose computed background is the accent token's colour. */
async function accentButtons(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const accent = globalThis.getComputedStyle(globalThis.document.documentElement).getPropertyValue('--accent').trim();
    const probe = globalThis.document.createElement('span');
    probe.style.color = accent;
    globalThis.document.body.append(probe);
    const rgb = globalThis.getComputedStyle(probe).color;
    probe.remove();
    return [...globalThis.document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && globalThis.getComputedStyle(b).backgroundColor === rgb)
      .map((b) => b.textContent ?? '');
  });
}

/** To the party screen from the first map, with the Release band open. */
async function openReleaseBand(page: Page): Promise<void> {
  await playUntil(page, (screen) => screen === 'map');
  await page.locator(`${visible('map')} .party__header .button`).click();
  await page.waitForSelector(visible('party'));
  // A party of one cannot release, so the button is disabled on this seed at
  // this point; the band is opened through the button's own handler anyway.
  await page.locator(`${visible('party')} .party__actions .button--danger`).first().evaluate((el) => {
    (el as HTMLButtonElement).disabled = false;
    (el as HTMLButtonElement).click();
  });
  await page.waitForSelector('.confirm-band');
}

describe('the vertical budget', () => {
  it('leaves both guarded screens at the baseline height, to the pixel', async () => {
    const expected = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/baseline/heights.json'), 'utf8'));
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.problems ?? []).toEqual([]);
    expect(measured.map).toEqual(expected.map);
    expect(measured.battle).toEqual(expected.battle);
  }, 180_000);
});

describe('the band', () => {
  it('is a strip across the middle, the one accent while open, and clear of a pinned card', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await openReleaseBand(page);

    const body = await page.locator('.confirm-band__body').boundingBox();
    expect(body).not.toBeNull();
    const top = body?.y ?? 0;
    const bottom = (body?.y ?? 0) + (body?.height ?? 0);
    // Full width, and across the middle third of the viewport.
    expect(body?.width).toBe(390);
    expect(top).toBeGreaterThan(844 / 3 - 60);
    expect(bottom).toBeLessThan((844 * 2) / 3 + 60);

    // The band's primary is the only accent-coloured button on screen: the
    // screen's own primary behind it has gone hollow.
    expect(await accentButtons(page)).toEqual(['Release']);
    expect(await page.locator(`${visible('party')} .primary-action`).count()).toBe(1);

    // The secondary is hollow: transparent, text only.
    const hollow = await page.locator('.confirm-band .button--hollow').evaluate((el) => globalThis.getComputedStyle(el).backgroundColor);
    expect(hollow).toBe('rgba(0, 0, 0, 0)');

    // Escape cancels, and the screen's primary is the accent again.
    await page.keyboard.press('Escape');
    expect(await page.locator('.confirm-band').count()).toBe(0);
    expect(await accentButtons(page)).toEqual(['Back to the map']);

    // The pinned incoming move card on the replacement screen sits above the
    // band's range. Release A's confirm is not merged; this is the card it
    // would pin, measured where it renders today.
    await page.locator(`${visible('party')} .primary-action`).click();
    const reached = await playUntil(page, (screen) => screen === 'replace', 900);
    expect(reached).toBe('replace');
    const card = await page.locator(`${visible('replace')} .replace__incoming`).boundingBox();
    expect(card).not.toBeNull();
    expect((card?.y ?? 0) + (card?.height ?? 0)).toBeLessThan(top);
    await context.close();
  }, 300_000);
});
