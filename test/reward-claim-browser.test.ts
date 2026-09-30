/**
 * A reward is claimed exactly once across a reload. **Stage 5.0/3, the plan's
 * test 7, D69.**
 *
 * The claim is two presses now: a tap selects and opens the band, the band's
 * commit claims. The selection is UI state and must never reach the log, so a
 * reload with the band up asks the same question again, and a reload after the
 * commit does not ask it at all. Both are read off the saved log, which is the
 * one thing a reload restores.
 *
 * In a browser because the property lives in the wiring between the result
 * screen, the band, `app.ts`'s save and a real reload.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { openApp, openScreen, settle, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

const cards = (page: Page) => page.locator(`${visible('result')} .rewards .reward`);

/** How many reward decisions the saved log holds. */
const rewardsLogged = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const raw = globalThis.localStorage.getItem('gymrun.lastRun');
    const log = raw ? (JSON.parse(raw) as { decisions: { kind: string }[] }) : { decisions: [] };
    return log.decisions.filter((decision) => decision.kind === 'reward').length;
  });

/** Walk, the smoke bot's way, until the result screen shows its cards. */
async function walkToCards(page: Page): Promise<boolean> {
  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (screen === 'result' && (await cards(page).count()) > 0) return true;
    if (screen === 'summary') return false;
    await stepOnce(page, screen);
  }
  return false;
}

describe('the claim across a reload', () => {
  it('asks again after a reload with the band up, and never twice after the commit', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24');
    expect(await walkToCards(page), 'never reached a reward offer').toBe(true);
    const before = await rewardsLogged(page);

    // No card is selected at rest (C1).
    expect(await page.locator(`${visible('result')} .reward[aria-pressed="true"]`).count()).toBe(0);

    // Tap: selected, band up, nothing logged.
    await cards(page).first().click({ position: { x: 8, y: 8 } });
    await page.waitForSelector('.confirm-band');
    expect(await page.locator(`${visible('result')} .reward[aria-pressed="true"]`).count()).toBe(1);
    expect(await rewardsLogged(page)).toBe(before);

    // Reload mid-claim: the same offer comes back, unselected, with no band.
    const offered = await cards(page).count();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(`${visible('result')} .rewards .reward`, { timeout: 30_000 });
    await settle(page);
    expect(await cards(page).count()).toBe(offered);
    expect(await page.locator('.confirm-band').count()).toBe(0);
    expect(await page.locator(`${visible('result')} .reward[aria-pressed="true"]`).count()).toBe(0);
    expect(await rewardsLogged(page)).toBe(before);

    // Commit. The band closes and the cards are gone from the screen.
    await cards(page).first().click({ position: { x: 8, y: 8 } });
    await page.locator('.confirm-band .primary-action').click();
    await settle(page);
    expect(await page.locator('.confirm-band').count()).toBe(0);
    expect(await cards(page).count()).toBe(0);

    /*
     * The reward reaches the log when the node completes, which at a wild node
     * is after the capture question on the same screen (`core/run.ts`, the
     * `reward` record after Part A). That order predates this stage. So walk
     * on until the node has completed, and the one reward decision is in.
     */
    for (let step = 0; step < 20 && (await rewardsLogged(page)) === before; step++) {
      await stepOnce(page, await openScreen(page));
    }
    expect(await rewardsLogged(page)).toBe(before + 1);

    // Reload after the claim: the offer is not asked again.
    await page.reload({ waitUntil: 'load' });
    await settle(page);
    const resumed = await openScreen(page);
    const cardsAgain = resumed === 'result' ? await cards(page).count() : 0;
    expect(cardsAgain, 'the claimed offer came back after a reload').toBe(0);
    expect(await rewardsLogged(page)).toBe(before + 1);
    expect(problems).toEqual([]);
    await context.close();
  }, 240_000);
});
