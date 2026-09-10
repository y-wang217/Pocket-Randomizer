/**
 * The pre-gym softlock, in a real browser.
 *
 * The jsdom half (`test/pre-gym-confirm.test.ts`) mounts the screen on a party
 * of one and asserts the confirm submits. This is the same claim reached the
 * way a player reaches it: a run that declines every capture keeps the party at
 * its starter, so gym 1 is faced by a party of exactly one — and before the
 * confirm existed every button on that screen was disabled and the run stopped
 * there for good.
 *
 * In Chromium rather than jsdom because "disabled" is the whole point: a
 * disabled button dispatches no click, so the bug is invisible to any test that
 * calls a handler directly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { openApp, openScreen, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

/**
 * One decision, the smoke bot's, except that captures are turned down.
 *
 * "Leave it" is the acquisition screen's decline, and acquisition is the only
 * path by which a party gains a member — so declining every one of them is how
 * a run arrives at a gym still solo.
 */
async function stepDeclining(page: Page): Promise<string | null> {
  const screen = await openScreen(page);
  if (screen === 'result') {
    const capture = page.locator(`${visible('result')} .result__capture`);
    if ((await capture.count()) && !(await capture.first().isHidden())) {
      await capture.locator('.acquire__actions .button:not(.primary-action)').last().click();
      return screen;
    }
  }
  return stepOnce(page);
}

describe('a party of one at the gym', () => {
  it('can confirm its lead and reach the gym battle', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24');

    for (let step = 0; step < 400; step++) {
      if ((await openScreen(page)) === 'pre-gym') break;
      await stepDeclining(page);
      await page.waitForTimeout(20);
    }
    expect(await openScreen(page), 'never reached the pre-gym screen').toBe('pre-gym');

    // The shape the screen could not leave: one member, and every per-slot
    // control on it inert.
    expect(await page.locator(`${visible('pre-gym')} .pre-gym__slot`).count()).toBe(1);
    expect(await page.locator(`${visible('pre-gym')} .pre-gym__slot .button:not(:disabled)`).count()).toBe(0);

    const confirm = page.locator(`${visible('pre-gym')} .pre-gym__confirm`);
    await expect.poll(() => confirm.isEnabled()).toBe(true);
    await confirm.click();

    // Off the screen and into the fight, not merely off the screen.
    for (let step = 0; step < 60 && (await openScreen(page)) !== 'battle'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page), 'the confirm did not reach the gym battle').toBe('battle');
    expect(await page.locator(`${visible('battle')} .moves .move`).count()).toBeGreaterThan(0);

    await context.close();
    expect(problems).toEqual([]);
  }, 240_000);
});
