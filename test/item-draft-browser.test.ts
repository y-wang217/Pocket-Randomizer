/**
 * A TM taught on the party screen, and an item moved to the bag, survive a
 * reload. **The second QA pass, QA-008 and QA-009.**
 *
 * Both are parts of an item plan, which is one logged decision per boundary,
 * and the plan used to live only in `app.ts` memory until that boundary: the
 * tester taught Icy Wind over Snore, reloaded, and found Snore back and the TM
 * in the bag. The draft now goes to storage beside the log (`ui/storage.ts`).
 *
 * In a browser because the defect is in the wiring between the party screen,
 * `app.ts` and a real reload, which no headless run passes through.
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

const tmPanel = (page: Page): Promise<string> =>
  page.locator(`${visible('party')} .tms`).first().innerText();
const partyText = (page: Page): Promise<string> => page.locator(visible('party')).innerText();

/** Walk, the smoke bot's way, until the party screen offers a Teach. */
async function walkToTeach(page: Page): Promise<boolean> {
  for (let step = 0; step < 600; step++) {
    const screen = await openScreen(page);
    if (screen === 'party') {
      const teach = page.locator(`${visible('party')} .tms__item .button--small`).first();
      if ((await teach.count()) && (await teach.textContent()) === 'Teach') return true;
    }
    if (screen === 'summary') return false;
    await stepOnce(page, screen);
  }
  return false;
}

describe('the unspent item plan across a reload', () => {
  it('keeps a TM taught at the boundary, after a reload', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24');

    expect(await walkToTeach(page), 'never reached a Teach control').toBe(true);

    // Teach it, answering the two questions the smoke bot answers.
    await page.locator(`${visible('party')} .tms__item .button--small`).first().click();
    for (let step = 0; step < 4 && (await openScreen(page)) !== 'party'; step++) {
      await stepOnce(page, await openScreen(page));
    }
    expect(await openScreen(page)).toBe('party');

    const tmsBefore = await tmPanel(page);
    const partyBefore = await partyText(page);
    expect(tmsBefore).toContain('→');

    await page.reload({ waitUntil: 'load' });
    // The save resumes on load and the replay parks on the same boundary.
    await page.waitForSelector(visible('party'), { timeout: 30_000 });
    await settle(page);

    expect(await tmPanel(page), 'the composed teach').toBe(tmsBefore);
    expect(await partyText(page), 'the learner with its new move').toBe(partyBefore);
    expect(problems).toEqual([]);
    await context.close();
  }, 240_000);

  // A seed whose smoke walk puts an item in a member's hands early; SMOKE24's
  // does not before its first loss.
  it('keeps an item moved to the bag from the map, after a reload', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMK49-2');
    // The Team tab, which from the map opens the writable party screen (5.0/4:
    // the map's Manage button went with its party HUD).
    const manage = page.locator('[data-nav="team"]');
    const toBag = page.locator(`${visible('party')} button`, { hasText: 'To bag' }).first();

    // Walk until a member is holding something, looking from the map.
    let holding = false;
    for (let step = 0; step < 900 && !holding; step++) {
      const screen = await openScreen(page);
      if (screen === 'summary') break;
      if (screen === 'map' && (await manage.count())) {
        await manage.click();
        await settle(page);
        holding = (await toBag.count()) > 0;
        if (holding) break;
        await page.locator(`${visible('party')} .primary-action`).first().click();
        await settle(page);
      }
      await stepOnce(page, await openScreen(page));
    }
    expect(holding, 'no member ever held an item').toBe(true);

    // The one face folds every member card (Stage 5.0/1; it ran in Detailed,
    // unfolded, until then). Open the holder's card to reach its control.
    const holder = page.locator(`${visible('party')} .party__member`, { has: page.locator('button', { hasText: 'To bag' }) }).first();
    await holder.locator('.party__member-toggle').click();
    await settle(page);
    await toBag.click();
    await settle(page);
    const before = await partyText(page);
    expect(before).not.toBe('');

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector(visible('map'), { timeout: 30_000 });
    await settle(page);
    await manage.click();
    await settle(page);

    expect(await partyText(page), 'the item stays in the bag').toBe(before);
    expect(problems).toEqual([]);
    await context.close();
  }, 480_000);
});
