/**
 * The one face, in a browser, per primitive. **Stage 5.0/1.**
 *
 * This file was `test/visual-density.test.ts`, which defined what each of the
 * three density modes did to a stat block, a member card, a move button and
 * the threat readout. Stage 5.0/1
 * (`docs/spec/gymrun-stage5.0-visual-redesign.md`) retired Simple and Detailed
 * (bible R6, D50), so the Detailed and Simple cases, the first-launch default
 * and the live mode switch on pre-gym are deleted, and what each case asserted
 * about Pocket is asserted here about the only face there is.
 *
 * A browser rather than jsdom because whether a stat number is on screen is a
 * computed-style question, and jsdom has no stylesheet to ask.
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

/** The visible text of the first element matching a selector, or null. */
async function visibleText(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((sel) => {
    const node = globalThis.document.querySelector<HTMLElement>(sel);
    return node ? node.innerText.trim() : null;
  }, selector);
}

/** Open the app and play to the party screen. */
async function partyScreen(): Promise<{ page: Page; close: () => Promise<void> }> {
  const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (screen === 'map') {
      await page.locator('[data-nav="team"]').click();
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

describe('the one face', () => {
  it('six bars per block and no number on screen', async () => {
    const { page, close } = await partyScreen();
    const cards = await paintedCount(page, '.screen--party .party__member');
    expect(cards).toBeGreaterThan(0);
    // The body folds in Pocket; open the first card to reach its stat block.
    await page.locator(`${visible('party')} .party__member-toggle`).first().click();
    await page.waitForTimeout(150);
    /*
     * Scoped to the party screen since bible Rev 19 (D79): the starter detail
     * panel's block wears `stats--grid` with its numbers at rest, and the
     * starter screen stays in the document, hidden, after the pick.
     */
    const party = visible('party');
    expect(await paintedCount(page, `${party} .stats--grid .stat__value`)).toBe(0);
    expect(await paintedCount(page, `${party} .stats--grid .stat__bar-fill`), 'the opened card shows all six bars').toBe(6);
    /*
     * **The label is the glyph in Pocket. M3.2.** Section 3's Six stats row is
     * "glyph, bar, number" and R2 forbids the word at rest, so the mark from
     * M1.1's sheet carries the stat and the two word forms are hidden — the
     * same shape D16 ruled for the type chip's word, and reversed by the same
     * item that reverses that one, M6.4.
     */
    expect(await visibleText(page, `${party} .stats--grid .stat__label`)).toBe('');
    expect(await paintedCount(page, `${party} .stats--grid .stat__label .glyph`)).toBe(6);
    await close();
  }, 600_000);

  /**
   * Uniform omission, asserted as the group (the prompt's test 8): every
   * member card on the party screen folds in Pocket, and none is open until
   * the player opens one. Counted against the number of cards, never as
   * "some folded".
   */
  it('folds every member card together, and one tap opens one', async () => {
    const { page, close } = await partyScreen();
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
   * **Pocket stopped dropping these regions at M2.1, and that was the bug.**
   *
   * This asserted that in Pocket all four buttons drop the category chip, the
   * base power and the effect line together, and that Detailed keeps them. The
   * "together" half was a real rule and still is — a mode that dropped a region
   * from one button and not the next would be unreadable. The dropping half was
   * a C2 violation: section 3 makes base power *"the largest text on the card"*
   * and Pocket was deleting it, along with the category glyph and the whole
   * fact strip, with no tap that reached any of them. Filed as D16.
   *
   * So the rule inverts. **Every button carries every region in every mode**,
   * and the mode chooses the encoding rather than the presence: Pocket renders
   * the category as its glyph and hides the word, Detailed and Simple do the
   * reverse. Still asserted against the count of buttons, so a screen with
   * three moves holds it for three, and still all-or-none.
   */
  it('keeps every region on every move button, the category as its glyph', async () => {
    {
      const density = 'the one face';
      const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
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
      const powers = await paintedCount(page, `${visible('battle')} .moves .move .move__power`);
      // The two encodings of one fact: the word in Detailed, the glyph in
      // Pocket, never both and never neither.
      const words = await paintedCount(page, `${visible('battle')} .moves .move .badge--category .chip__word`);
      const glyphs = await paintedCount(page, `${visible('battle')} .moves .move .badge--category .glyph`);

      expect(names, `${density}: every button keeps its name`).toBe(buttons);
      expect(categories, `${density}: the category chip is on every button`).toBe(buttons);
      expect(words, `${density}: no category word at rest`).toBe(0);
      expect(glyphs, `${density}: the category glyph on every button`).toBe(buttons);
      // C2, the rule D16 was filed against: base power is never dropped. A
      // status move renders an em dash rather than a number, but it renders.
      expect(powers, `${density}: base power is on every button`).toBeGreaterThan(0);
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
  it('keeps the threat counts behind a tap', async () => {
    {
      const density = 'the one face';
      const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
      let reached = false;
      for (let step = 0; step < 900; step++) {
        if ((await openScreen(page)) === 'map') {
          await page.locator('[data-nav="team"]').click();
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
      expect(listed).toBeGreaterThan(0);
      expect(counts, 'the counts are behind a tap').toBe(0);
      await page.locator('.threats__item .type').first().click();
      await page.waitForTimeout(120);
      expect(await visibleText(page, '.tip .tip__text'), 'the tap says the count').toMatch(/hits \d+ of \d+/);
      await context.close();
    }
  }, 900_000);
});
