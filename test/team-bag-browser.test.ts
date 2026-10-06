/**
 * The Team and Bag screens. **Bible Rev 23, D95 to D97.**
 *
 * Team: three views behind a switch, a sort that is the player's and starts in
 * party order, and a moves view with one row per member. Bag: who holds what at
 * rest, and two taps to move anything, between members as well as to and from
 * the backpack.
 *
 * On the gallery's loaded party, whose six members each hold an item and whose
 * backpack is full, so every act has something to act on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness({ gallery: true });
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

async function open(query: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await harness.browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${harness.url}/gallery.html#seed=S49B-1&screen=party&fixture=loaded&${query}`, { waitUntil: 'load' });
  await page.waitForSelector('html[data-gallery-ready]', { timeout: 120_000 });
  return { page, close: () => context.close() };
}

const heldNames = (page: Page): Promise<string[]> =>
  page.locator('.screen--party .held__name').allTextContents();
const looseNames = (page: Page): Promise<string[]> =>
  page.locator('.screen--party .backpack__name').allTextContents();

describe('the Bag screen', () => {
  it('lists who holds what at rest, and draws no Team half', async () => {
    const { page, close } = await open('focus=bag');
    expect(await page.locator('.screen--party .held__item').count()).toBe(6);
    expect(await page.locator('.screen--party .party__team').isVisible()).toBe(false);
    expect(await page.locator('.screen--party .screen__blurb').isVisible()).toBe(false);
    await close();
  }, 180_000);

  it('swaps two members’ items in two taps', async () => {
    const { page, close } = await open('focus=bag');
    const before = await heldNames(page);
    await page.locator('.held__item[data-slot="0"] .held__pick').click();
    expect(await page.locator('.held__item[data-slot="0"]').getAttribute('data-picked')).toBe('true');
    await page.locator('.held__item[data-slot="1"] .held__pick').click();
    const after = await heldNames(page);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
    expect(after.slice(2)).toEqual(before.slice(2));
    await close();
  }, 180_000);

  it('gives a backpack item in two taps, and the displaced one goes to the bag', async () => {
    const { page, close } = await open('focus=bag');
    const held = await heldNames(page);
    const loose = await looseNames(page);
    await page.locator('.backpack__item').first().locator('.backpack__pick').click();
    await page.locator('.held__item[data-slot="2"] .held__pick').click();
    expect((await heldNames(page))[2]).toBe(loose[0]);
    const nowLoose = await looseNames(page);
    expect(nowLoose).toContain(held[2]);
    expect(nowLoose).not.toContain(loose[0]);
    await close();
  }, 180_000);

  it('puts a held item away with To bag', async () => {
    const { page, close } = await open('focus=bag');
    const held = await heldNames(page);
    await page.locator('.held__item[data-slot="3"] .held__pick').click();
    await page.locator('.held__item[data-slot="3"] .held__away').click();
    expect((await heldNames(page))[3]).toBe('Nothing held');
    expect(await looseNames(page)).toContain(held[3]);
    await close();
  }, 180_000);
});

describe('the Team screen', () => {
  it('starts in party order, sorts by a stat when asked, and goes back', async () => {
    const { page, close } = await open('focus=team');
    const slots = (): Promise<(string | null)[]> =>
      page.locator('.screen--party .party--manage .party__member').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-slot')));
    expect(await slots()).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(await page.locator('.party__sort-key[data-sort="party"]').getAttribute('aria-pressed')).toBe('true');

    await page.locator('.party__sort-key[data-sort="spe"]').click();
    const speeds = await page
      .locator('.screen--party .party--manage .party__member')
      .evaluateAll((cards) => cards.map((card) => Number(card.querySelector('.stat[data-row="spe"] .stat__value')?.textContent)));
    expect(speeds).toEqual([...speeds].sort((a, b) => b - a));
    // No member is marked: the sort is the only thing that moved.
    expect(await page.locator('.screen--party .party__member[data-best], .screen--party .party__member[data-rank]').count()).toBe(0);

    await page.locator('.party__sort-key[data-sort="party"]').click();
    expect(await slots()).toEqual(['0', '1', '2', '3', '4', '5']);
    await close();
  }, 180_000);

  it('draws a row per member of its four moves with PP, and the coverage wheel', async () => {
    const { page, close } = await open('focus=team&view=moves');
    expect(await page.locator('.moves-grid__row').count()).toBe(6);
    const perRow = await page.locator('.moves-grid__row').evaluateAll((rows) => rows.map((row) => row.querySelectorAll('.move--chip').length));
    expect(perRow.every((count) => count >= 1 && count <= 4)).toBe(true);
    expect(await page.locator('.moves-grid .move--chip .move__pp, .moves-grid .move--chip [class*="pp"]').count()).toBeGreaterThan(0);
    await page.locator('.party__view-tab[data-view="coverage"]').click();
    expect(await page.locator('.screen--party .coverage__wheel').count()).toBe(1);
    await close();
  }, 180_000);
});
