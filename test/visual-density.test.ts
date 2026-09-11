/**
 * The three density modes, in a browser, per surface. **Patch 4.7.2's test,
 * rewritten by the density modes patch.**
 *
 * `test/density.test.ts` owns the property that matters most — the mode is
 * unreachable from `core/` and a run plays identically in every mode — and it
 * does that by grepping and by replaying. `test/visual-coverage.test.ts` owns
 * "every surface differs in every mode", against pixels. This file owns the
 * definition, per primitive: what each mode *does* to a stat block, a threat
 * readout, a member card — the facts the definition names, not the pixels.
 *
 * A browser rather than jsdom because the mode is a `data-density` attribute
 * on `<html>` and the stylesheet is its only reader. Whether a stat number is
 * on screen is a computed-style question, and jsdom has no stylesheet to ask.
 *
 * Each mode is a fresh context with the mode stored, the same path the app
 * takes on a stored preference. The last two cases use the drawer's picker
 * (step 7) to assert that a mode change reaches a screen already open
 * without a redraw, and that it changes nothing about the run.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, openScreen, stepOnce, visible } from '../scripts/visual/browser.mjs';
import type { Density } from '../src/ui/settings';
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

/** The visible text of the first element matching a selector, or null. */
async function visibleText(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const node = globalThis.document.querySelector<HTMLElement>(sel);
    return node ? node.innerText.trim() : null;
  }, selector);
}

const mode = (page: Page): Promise<string | null> =>
  page.evaluate(() => globalThis.document.documentElement.getAttribute('data-density'));

/** Open the app with a stored mode and play to the party screen. */
async function partyIn(density: Density): Promise<{ page: Page; close: () => Promise<void> }> {
  const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24', undefined, { density });
  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (screen === 'map') {
      await page.locator(`${visible('map')} .party__header .button`).click();
      await page.waitForTimeout(200);
      return { page, close: () => context.close() };
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

describe('the density modes', () => {
  it('start in Detailed on a fresh store, which is the first-launch default', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    expect(await mode(page)).toBe('detailed');
    await context.close();
  }, 300_000);

  /**
   * The stat block, per the definition: Detailed is six full labels and six
   * numbers; Simple six abbreviations and six numbers; Pocket six bars with
   * no number on screen. All six together in every mode — the counts are
   * asserted as sixes, never as "some".
   */
  it('Detailed: full stat labels and numbers, no bars', async () => {
    const { page, close } = await partyIn('detailed');
    expect(await mode(page)).toBe('detailed');
    expect(await paintedCount(page, '.stats--party .stat__value')).toBeGreaterThanOrEqual(6);
    expect(await paintedCount(page, '.stats--party .stat__bar-fill')).toBe(0);
    expect(await visibleText(page, '.stats--party .stat__label')).toBe('Hit Points');
    await close();
  }, 600_000);

  it('Simple: abbreviated stat labels and numbers, no bars', async () => {
    const { page, close } = await partyIn('simple');
    expect(await mode(page)).toBe('simple');
    expect(await paintedCount(page, '.stats--party .stat__value')).toBeGreaterThanOrEqual(6);
    expect(await paintedCount(page, '.stats--party .stat__bar-fill')).toBe(0);
    expect(await visibleText(page, '.stats--party .stat__label')).toBe('HP');
    await close();
  }, 600_000);

  it('Pocket: six bars per block and no number on screen', async () => {
    const { page, close } = await partyIn('pocket');
    expect(await mode(page)).toBe('pocket');
    const cards = await paintedCount(page, '.screen--party .party__member');
    expect(cards).toBeGreaterThan(0);
    // The body folds in Pocket; open the first card to reach its stat block.
    await page.locator(`${visible('party')} .party__member-toggle`).first().click();
    await page.waitForTimeout(150);
    expect(await paintedCount(page, '.stats--party .stat__value')).toBe(0);
    expect(await paintedCount(page, '.stats--party .stat__bar-fill'), 'the opened card shows all six bars').toBe(6);
    expect(await visibleText(page, '.stats--party .stat__label')).toBe('HP');
    await close();
  }, 600_000);

  /**
   * Uniform omission, asserted as the group (the prompt's test 8): every
   * member card on the party screen folds in Pocket, and none is open until
   * the player opens one. Counted against the number of cards, never as
   * "some folded".
   */
  it('Pocket folds every member card together, and one tap opens one', async () => {
    const { page, close } = await partyIn('pocket');
    const cards = await paintedCount(page, '.screen--party .party__member');
    expect(cards).toBeGreaterThan(0);
    expect(await paintedCount(page, '.screen--party .party__member-toggle'), 'one fold control per card').toBe(cards);
    expect(await paintedCount(page, '.screen--party .party__member .collapse__body'), 'no card starts open').toBe(0);
    expect(await paintedCount(page, '.screen--party .party__member .panel__hp-text'), 'the HP line is on the bar in Pocket').toBe(0);
    await page.locator(`${visible('party')} .party__member-toggle`).first().click();
    await page.waitForTimeout(150);
    expect(await paintedCount(page, '.screen--party .party__member .collapse__body'), 'the tap opens that card').toBe(1);
    // The bar's tap says the line the card's text says in Detailed.
    await page.locator(`${visible('party')} .party__member .hp[data-tip]`).first().click();
    await page.waitForTimeout(120);
    expect(await visibleText(page, '.tip .tip__text')).toMatch(/HP/);
    await close();
  }, 600_000);

  /**
   * The same rule on the battle buttons: in Pocket all four drop the category,
   * the base power and the effect line together; in Detailed all four keep
   * them. Asserted against the count of buttons, so a screen with three moves
   * holds the rule for three.
   */
  it('Pocket drops the same regions from every move button together', async () => {
    for (const density of ['detailed', 'pocket'] as const) {
      const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24', undefined, { density });
      let reached = false;
      for (let step = 0; step < 900; step++) {
        if ((await openScreen(page)) === 'battle') {
          reached = true;
          break;
        }
        await stepOnce(page);
        await page.waitForTimeout(25);
      }
      expect(reached, `${density}: the run never reached a battle`).toBe(true);
      await page.waitForTimeout(200);
      const buttons = await paintedCount(page, `${visible('battle')} .moves .move`);
      expect(buttons).toBeGreaterThan(0);
      const categories = await paintedCount(page, `${visible('battle')} .moves .move .badge--category`);
      const names = await paintedCount(page, `${visible('battle')} .moves .move .move__name`);
      expect(names, `${density}: every button keeps its name`).toBe(buttons);
      expect(categories, `${density}: the category goes from all or from none`).toBe(density === 'pocket' ? 0 : buttons);
      await context.close();
    }
  }, 900_000);

  /**
   * The threat readout's counts: beside the chip in Detailed and Simple, on
   * the chip's tap in Pocket. The chips themselves are in every mode.
   *
   * Walks until the readout has entries rather than stopping at the first
   * party screen: a party of one on segment one can have no unanswered type
   * to list, and an empty list would make this pass by vacuity.
   */
  it('keeps the threat counts on screen through Simple and behind a tap in Pocket', async () => {
    for (const density of ['detailed', 'simple', 'pocket'] as const) {
      const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24', undefined, { density });
      let reached = false;
      for (let step = 0; step < 900; step++) {
        if ((await openScreen(page)) === 'map') {
          await page.locator(`${visible('map')} .party__header .button`).click();
          await page.waitForTimeout(200);
          if ((await paintedCount(page, '.threats__item')) > 0) {
            reached = true;
            break;
          }
          await stepOnce(page);
          await page.waitForTimeout(25);
          continue;
        }
        await stepOnce(page);
        await page.waitForTimeout(25);
      }
      expect(reached, `${density}: the run never reached a party screen with threats listed`).toBe(true);
      const listed = await paintedCount(page, '.threats__item .type');
      const counts = await paintedCount(page, '.threats__count');
      if (density === 'pocket') {
        expect(counts, 'Pocket moves the counts behind a tap').toBe(0);
        await page.locator('.threats__item .type').first().click();
        await page.waitForTimeout(120);
        expect(await visibleText(page, '.tip .tip__text'), 'the tap says the count').toMatch(/hits \d+ of \d+/);
      } else {
        expect(counts, `${density} keeps every count on screen`).toBe(listed);
      }
      await context.close();
    }
  }, 900_000);

  /**
   * Ruling 4's live case, on a non-modal screen the old subscription never
   * redrew: the attribute lands on `<html>` and an open pre-gym screen
   * follows without navigating away. The picker in the drawer is the
   * setter, and the drawer is closed again before the screen is read so
   * the screen, not the sheet, is what took the mode.
   *
   * And the prompt's test 6, on the same screen: a mode switch mid-run
   * leaves the run where it was — the same screen, the same saved log, the
   * same party on it.
   */
  it('takes effect on pre-gym while it is open, without navigating away, and changes nothing about the run', async () => {
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

    const label = () => visibleText(page, `${visible('pre-gym')} .stat__label`);
    const runState = () =>
      page.evaluate(() => ({
        screen: [...globalThis.document.querySelectorAll<HTMLElement>('.screen')].find((el) => !el.hidden)?.dataset['screen'],
        log: globalThis.localStorage.getItem('gymrun.lastRun'),
        party: [...globalThis.document.querySelectorAll('.screen--pre-gym .panel__name')].map((el) => el.textContent),
      }));
    const pick = async (density: Density): Promise<void> => {
      await page.locator('.shell__drawer-bar [data-drawer-trigger]').click();
      await page.waitForTimeout(120);
      await page.locator(`.drawer .density__choice[data-density="${density}"]`).click();
      await page.waitForTimeout(60);
      await page.locator('.drawer .drawer__close').click();
      await page.waitForTimeout(120);
    };

    const before = await runState();
    expect(before.log, 'the run is saved before the switch').not.toBeNull();
    expect(await label()).toBe('Hit Points');
    await pick('simple');
    expect(await mode(page)).toBe('simple');
    expect(await label(), 'the open screen took the mode with no redraw').toBe('HP');
    await pick('pocket');
    expect(await mode(page)).toBe('pocket');
    expect(await runState(), 'two switches later the run is exactly where it was').toEqual(before);
    await pick('detailed');
    expect(await label()).toBe('Hit Points');
    await context.close();
  }, 900_000);
});
