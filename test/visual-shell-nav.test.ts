/**
 * The shell nav, in a browser. **Stage 5.0/1.**
 *
 * The author ruled the tabs open screens (D53) and confirmed the guard that
 * keeps that from breaking the standing rule for decision screens: a screen a
 * tab opens while a decision is pending elsewhere is a readout. This walks a
 * real run to two decisions, the map and a fight, presses every tab on each,
 * and holds three things after every press and every close:
 *
 *   - the routed screen underneath is the one that was there;
 *   - the saved run log is byte for byte what it was, so nothing was
 *     submitted and nothing was drawn;
 *   - the map a tab opens from anywhere but the map has no control to pick a
 *     node with, so there is still one path by which a node completes.
 *
 * And the plan's desktop half of test 2: at 1366x768, 1440x900 and 1920x1080
 * the page itself never scrolls.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, openScreen, playUntil } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

const savedLog = (page: Page): Promise<string | null> => page.evaluate(() => globalThis.localStorage.getItem('gymrun.lastRun'));

/** Which tab screen is open, by its overlay block, or null. */
const openTabScreen = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const open = [...globalThis.document.querySelectorAll<HTMLElement>('.overlay--screen')].find((layer) => !layer.hidden);
    return open ? open.className.split(' ').find((name) => name !== 'overlay' && name !== 'overlay--screen') ?? null : null;
  });

async function pressAndClose(page: Page, tab: string): Promise<{ opened: string | null; screenAfter: string | null }> {
  await page.locator(`[data-nav="${tab}"]`).click();
  await page.waitForTimeout(120);
  const opened = await openTabScreen(page);
  if (opened) {
    await page.locator(`.${opened} .overlay__close`).click();
    await page.waitForTimeout(80);
  }
  return { opened, screenAfter: await openScreen(page) };
}

describe('the tabs are readouts over a pending decision', () => {
  it('opens every tab over a fight and leaves the fight and the log as they were', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    await page.waitForTimeout(400);
    const before = await savedLog(page);
    expect(before).not.toBeNull();

    const expected: Record<string, string> = { map: 'map-drawer', team: 'drawer', bag: 'drawer', info: 'run-info', settings: 'settings-sheet' };
    for (const [tab, block] of Object.entries(expected)) {
      await page.locator(`[data-nav="${tab}"]`).click();
      await page.waitForTimeout(120);
      expect(await openTabScreen(page), `${tab} opens its readout`).toBe(block);
      if (tab === 'map') {
        expect(await page.locator('.map-drawer button.node').count(), 'the map over a fight has no node to pick').toBe(0);
      }
      await page.locator(`.${block} .overlay__close`).click();
      await page.waitForTimeout(80);
      expect(await openScreen(page), `${tab}: the fight is still on screen`).toBe('battle');
      expect(await savedLog(page), `${tab}: nothing was submitted`).toBe(before);
    }
    await context.close();
  }, 600_000);

  it('opens the writable party screen from the map only, and the rest as readouts', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'map');
    await page.waitForTimeout(300);
    const before = await savedLog(page);

    for (const tab of ['info', 'settings']) {
      const { opened, screenAfter } = await pressAndClose(page, tab);
      expect(opened, tab).not.toBeNull();
      expect(screenAfter, tab).toBe('map');
    }
    // The map tab on the map is the screen already on view: nothing opens.
    const map = await pressAndClose(page, 'map');
    expect(map.opened).toBeNull();
    expect(map.screenAfter).toBe('map');

    // Team from the map is the party screen its Manage button always led to.
    await page.locator('[data-nav="team"]').click();
    await page.waitForTimeout(150);
    expect(await openScreen(page)).toBe('party');
    expect(await page.locator('[data-nav="team"]').getAttribute('aria-current')).toBe('page');
    expect(await savedLog(page), 'opening the party screen submits nothing').toBe(before);

    // Map from that party screen is the way back to the map, not the readout
    // over the party screen: its nodes are buttons again.
    await page.locator('[data-nav="map"]').click();
    await page.waitForTimeout(150);
    expect(await openTabScreen(page), 'no readout opens over the party screen').toBeNull();
    expect(await openScreen(page)).toBe('map');
    expect(await page.locator('[data-nav="map"]').getAttribute('aria-current')).toBe('page');
    expect(await page.locator('.screen[data-screen="map"] button.node').count(), 'the map can pick a node').toBeGreaterThan(0);
    expect(await savedLog(page), 'leaving the party screen submits nothing').toBe(before);
    await context.close();
  }, 600_000);
});

describe('the page never scrolls on a desktop', () => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    it(`holds the frame and the sidebar inside ${viewport.width}x${viewport.height}`, async () => {
      const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24', viewport);
      await page.waitForTimeout(300);
      const read = () =>
        page.evaluate(() => {
          const root = globalThis.document.scrollingElement as HTMLElement;
          const sidebar = globalThis.document.querySelector<HTMLElement>('.sidebar');
          return {
            vertical: root.scrollHeight - root.clientHeight,
            horizontal: root.scrollWidth - root.clientWidth,
            sidebar: sidebar ? globalThis.getComputedStyle(sidebar).display : null,
          };
        });
      expect(await read()).toEqual({ vertical: 0, horizontal: 0, sidebar: 'flex' });
      await playUntil(page, (screen) => screen === 'battle');
      await page.waitForTimeout(300);
      expect(await read()).toEqual({ vertical: 0, horizontal: 0, sidebar: 'flex' });
      await context.close();
    }, 600_000);
  }
});
