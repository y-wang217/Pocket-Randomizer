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
 *
 * ## The second softlock, and why it is in this file
 *
 * 4.7's confirm gave the screen a way out. It did not give the screen's *detour*
 * a way back: the party screen's Done was `showScreen('map')` for both of its
 * entrances, and from the gym the map is a screen with no control that advances
 * the run — `run-map.ts` arms `onChoose` only on the row at `state.position`,
 * which at the gym no row matches, and `nodeOptions` is empty there by design so
 * `nodePick` is never armed either. Map to party to map, with `leadPick` pending
 * and nothing able to resolve it.
 *
 * It belongs beside the first because it is the same screen, the same pending
 * promise and the same class of mistake — a control whose label names a
 * destination it cannot reach. It is also only reachable in a browser for a
 * second reason on top of `disabled`: the bug is in `app.ts`'s wiring between
 * two screens, and a test that mounts either screen alone cannot see it.
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
    // The fold control (`ui/collapse.ts`, density modes patch) is a button on
    // the card and not a per-slot control; it is excluded, not counted inert.
    expect(await page.locator(`${visible('pre-gym')} .pre-gym__slot .button:not(:disabled):not(.collapse__toggle)`).count()).toBe(0);

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

  it('comes back to the gym from the party screen, and can still send its lead', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24');

    for (let step = 0; step < 400; step++) {
      if ((await openScreen(page)) === 'pre-gym') break;
      await stepDeclining(page);
      await page.waitForTimeout(20);
    }
    expect(await openScreen(page), 'never reached the pre-gym screen').toBe('pre-gym');

    // Out to the party screen, the way the pre-gym screen offers: item
    // assignment does not live on it, so it sends the player where it does.
    const manage = page.locator(`${visible('pre-gym')} .pre-gym__actions .button:not(.primary-action)`);
    await expect.poll(() => manage.isEnabled()).toBe(true);
    await manage.click();
    for (let step = 0; step < 60 && (await openScreen(page)) !== 'party'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page), 'the pre-gym screen did not reach the party screen').toBe('party');

    // The way out names where it goes. Entered from the gym, it is the gym —
    // "Back to the map" here was the softlock announced a click in advance.
    const done = page.locator(`${visible('party')} .primary-action`);
    expect(await done.textContent()).toBe('Back to the gym');
    await done.click();

    /*
     * The assertion the softlock fails. Before the fix this landed on the map,
     * where every node row is inert and `nodePick` is unarmed, so the run sat on
     * an unresolved `leadPick` until the tab was reloaded.
     */
    for (let step = 0; step < 60 && (await openScreen(page)) !== 'pre-gym'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page), 'Done from the party screen did not return to the gym').toBe('pre-gym');

    // And the screen it returned to is live, not a husk: the confirm still
    // carries the lead through to the fight.
    const confirm = page.locator(`${visible('pre-gym')} .pre-gym__confirm`);
    await expect.poll(() => confirm.isEnabled()).toBe(true);
    expect(await confirm.textContent()).toMatch(/^Send .+ in$/);
    await confirm.click();

    for (let step = 0; step < 60 && (await openScreen(page)) !== 'battle'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page), 'the confirm did not reach the gym battle').toBe('battle');

    await context.close();
    expect(problems).toEqual([]);
  }, 240_000);

  it('still goes back to the map when the map is where it came from', async () => {
    /*
     * The other entrance, which the fix must not break: the map's own Manage
     * button. Asserted on the label rather than by a round trip, because the
     * round trip is what every other map test already exercises.
     */
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24');

    for (let step = 0; step < 400; step++) {
      if ((await openScreen(page)) === 'map') break;
      await stepDeclining(page);
      await page.waitForTimeout(20);
    }
    expect(await openScreen(page), 'never reached the map').toBe('map');

    await page.locator(`${visible('map')} .party__header .button`).click();
    for (let step = 0; step < 60 && (await openScreen(page)) !== 'party'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page)).toBe('party');

    const done = page.locator(`${visible('party')} .primary-action`);
    expect(await done.textContent()).toBe('Back to the map');
    await done.click();
    for (let step = 0; step < 60 && (await openScreen(page)) !== 'map'; step++) await page.waitForTimeout(50);
    expect(await openScreen(page), 'Done did not return to the map').toBe('map');

    await context.close();
    expect(problems).toEqual([]);
  }, 240_000);
});
