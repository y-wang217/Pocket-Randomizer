/**
 * The Simple / Detailed toggle, in a browser, per surface. **Patch 4.7.2.**
 *
 * `test/verbosity.test.ts` owns the property that matters most — the flag is
 * unreachable from `core/` and a run plays identically in both modes — and it
 * does that by grepping and by replaying. This file owns the other half: that
 * the toggle *visibly does something*, on each of its two real readers, and
 * that flipping back restores what was there.
 *
 * A browser rather than jsdom because from 4.7.2 the mode is a `data-verbosity`
 * attribute on `<html>` and the stylesheet is its only reader. Whether a stat
 * number is on screen is now a computed-style question, and jsdom has no
 * stylesheet to ask.
 *
 * ## The two surfaces, and the one that is not asserted
 *
 * **Ruling 2: the battle panel does not branch on verbosity in this patch.**
 * The original brief asked for it, and hiding the exact HP digits in Simple was
 * proposed and rejected — exact HP is the most decision-relevant number on the
 * screen and hiding it removes the read rather than decluttering it. V5.3 had
 * already taken the six-stat block off that panel, so there is nothing left
 * there for the flag to govern. The two real readers are the **party screen**
 * and the **threat readout**, and those are what is asserted.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, openScreen, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/** How many elements matching a selector are actually rendered. */
async function paintedCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    return [...globalThis.document.querySelectorAll(sel)].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length;
  }, selector);
}

const mode = (page: Page): Promise<string | null> =>
  page.evaluate(() => globalThis.document.documentElement.getAttribute('data-verbosity'));

const toggle = async (page: Page): Promise<void> => {
  await page.locator('.verbosity__toggle').first().click();
  // No re-render to wait for; this is the paint after the attribute lands.
  await page.waitForTimeout(120);
};

/** Play to the map and open the party screen from its header. */
async function toParty(page: Page): Promise<void> {
  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (screen === 'map') {
      await page.locator(`${visible('map')} .party__header .button`).click();
      await page.waitForTimeout(200);
      return;
    }
    if (!screen) {
      await page.waitForTimeout(40);
      continue;
    }
    await stepOnce(page);
    await page.waitForTimeout(25);
  }
  throw new Error('never reached the map');
}

describe('the verbosity toggle', () => {
  it('starts in Detailed, which is the first-launch default', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    expect(await mode(page)).toBe('detailed');
    await context.close();
  }, 300_000);

  /**
   * Ruling 3, on the surface it was written for.
   *
   * Detailed shows the bar **and** the number; Simple shows the bar alone.
   * Neither mode renders a row with neither — which is the assertion that would
   * have failed the shipped build in the other direction, since Detailed used
   * to hide the bar.
   */
  it('changes the party screen, and changes it back', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await toParty(page);

    const bars = () => paintedCount(page, '.stats--party .stat__bar-fill');
    const numbers = () => paintedCount(page, '.stats--party .stat__value');

    const detailedBars = await bars();
    const detailedNumbers = await numbers();
    expect(detailedBars, 'Detailed must show bars').toBeGreaterThan(0);
    expect(detailedNumbers, 'Detailed must show numbers').toBeGreaterThan(0);
    expect(detailedNumbers).toBe(detailedBars);

    await toggle(page);
    expect(await mode(page)).toBe('simple');
    expect(await numbers(), 'Simple must drop the numbers').toBe(0);
    expect(await bars(), 'Simple must keep the bars').toBe(detailedBars);

    await toggle(page);
    expect(await mode(page)).toBe('detailed');
    expect(await numbers()).toBe(detailedNumbers);
    expect(await bars()).toBe(detailedBars);
    await context.close();
  }, 600_000);

  /**
   * The other real reader: the per-type counts on the threat readout.
   *
   * **On the party screen, which is where the readout lives.** It was on the
   * map as well until Stage 4.8, which landed while this patch was in flight
   * and rebuilt that screen; `screens/party.ts` is now its only mount. Written
   * against the map first, and the failure after merging 4.8 is what said so —
   * a good argument for asserting against a screen rather than a coordinate.
   *
   * Walks until the readout actually has entries rather than stopping at the
   * first party screen: a party of one on segment one can have no unanswered
   * type to list, and an empty list would make this pass by vacuity.
   */
  it('changes the threat readout, and changes it back', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const counts = () => paintedCount(page, '.threats__count');
    let reached = false;
    for (let step = 0; step < 900; step++) {
      if ((await openScreen(page)) === 'map') {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(200);
        if ((await counts()) > 0) {
          reached = true;
          break;
        }
        // Nothing listed yet: leave the party screen and play on.
        await stepOnce(page);
        await page.waitForTimeout(25);
        continue;
      }
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    expect(reached, 'the run never reached a party screen with threats listed').toBe(true);
    const chips = () => paintedCount(page, '.threats__item .type');

    const detailedCounts = await counts();
    const listed = await chips();

    await toggle(page);
    expect(await counts(), 'Simple must drop the counts').toBe(0);
    expect(await chips(), 'Simple must keep the types: shorter, not different').toBe(listed);

    await toggle(page);
    expect(await counts()).toBe(detailedCounts);
    await context.close();
  }, 600_000);

  /**
   * Ruling 4, on the drawer — and the one surface where "already open" is not
   * a state a player can toggle from.
   *
   * The drawer is `aria-modal="true"` with a scrim over the whole viewport, and
   * the toggle lives in the app header underneath it. Playwright refuses the
   * click for exactly the reason a thumb would miss it: the surface is modal.
   * So the live-change assertion belongs on the non-modal surfaces below and
   * above, and what is asserted here is the property that *is* reachable —
   * **the drawer shows the current mode every time it opens, in both modes.**
   * That is the case ruling 4's own fallback names, "re-render on drawer open",
   * and for a modal surface it is not a fallback but the whole of the case.
   *
   * It still exercises the mechanism rather than a redraw: the drawer's cards
   * are built once on open, from `memberCardContents`, which no longer asks
   * what mode it is in.
   */
  it('shows the current mode every time the drawer opens', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    for (let step = 0; step < 600; step++) {
      if ((await openScreen(page)) === 'map') break;
      await stepOnce(page);
      await page.waitForTimeout(25);
    }

    const numbers = () => paintedCount(page, '.drawer .stat__value');
    const bars = () => paintedCount(page, '.drawer .stat__bar-fill');
    const open = async () => {
      await page.locator('.drawer__trigger').first().click();
      await page.waitForTimeout(200);
    };
    const close = async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    };

    await open();
    const detailedNumbers = await numbers();
    const detailedBars = await bars();
    expect(detailedNumbers, 'the drawer must open with cards in it').toBeGreaterThan(0);
    expect(detailedBars).toBe(detailedNumbers);
    await close();

    await toggle(page);
    await open();
    expect(await numbers(), 'reopened in Simple: no numbers').toBe(0);
    expect(await bars(), 'reopened in Simple: the bars are still there').toBe(detailedBars);
    await close();

    await toggle(page);
    await open();
    expect(await numbers(), 'reopened in Detailed: the numbers are back').toBe(detailedNumbers);
    await context.close();
  }, 600_000);

  /**
   * Ruling 4's live case, on a non-modal screen the old subscription never
   * redrew.
   *
   * pre-gym draws member cards, is not the map and is not the party screen, so
   * before this patch a toggle flipped while it was open did nothing at all
   * until the player navigated away and back. Nothing re-renders it here
   * either — the attribute lands on `<html>` and the card follows.
   */
  it('takes effect on pre-gym while it is open, without navigating away', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    let reached = false;
    for (let step = 0; step < 900; step++) {
      if ((await openScreen(page)) === 'pre-gym') {
        reached = true;
        break;
      }
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    expect(reached, 'the run must reach a pre-gym screen').toBe(true);
    await page.waitForTimeout(200);

    const numbers = () => paintedCount(page, `${visible('pre-gym')} .stat__value`);
    const bars = () => paintedCount(page, `${visible('pre-gym')} .stat__bar-fill`);
    const before = await numbers();
    const barsBefore = await bars();
    expect(before).toBeGreaterThan(0);

    await toggle(page);
    expect(await numbers()).toBe(0);
    expect(await bars()).toBe(barsBefore);

    await toggle(page);
    expect(await numbers()).toBe(before);
    await context.close();
  }, 900_000);
});
