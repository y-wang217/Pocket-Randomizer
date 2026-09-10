/**
 * Stage V0's browser assertions: the vertical budget, the sibling rule, and
 * the one accent. All three are questions about computed style or layout, so
 * they run in Chromium through `test/visual/harness.ts`.
 *
 * The seed is SMOKE24 and the clicks are the smoke bot's, so the numbers here
 * are the numbers in `docs/visual/baseline/heights.json`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureGuardedScreens, openApp, openScreen, playUntil, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

describe('the vertical budget', () => {
  it('leaves both guarded screens at the baseline height, to the pixel', async () => {
    const expected = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/baseline/heights.json'), 'utf8'));
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.problems ?? []).toEqual([]);
    expect(measured.map).toEqual(expected.map);
    expect(measured.battle).toEqual(expected.battle);
  }, 180_000);

  /*
   * The plan's budget in absolute terms: the decision point ends above the fold
   * on a 390x844 phone, with room under it for a thumb. Marked `fails` because
   * it does not hold on this tree and the baseline test above cannot say so —
   * the baseline records where the rows *are*, not where they should be.
   *
   * **It is not 4.7's to give back, and that is the 2026-09-10 correction.**
   * Stage 4.7's drawer bar, archetype chips and move tag rows are worth 106.5px
   * on this screen and the map's tier copy 29.69 on the other, itemised in
   * `docs/visual/reports/merge-4.7.md`. But the same measurer run against `main`
   * *before* any of it — `2468769`, the commit before PR #10 — puts the fourth
   * move button at 840, already 100px past this line. Rolling 4.7 back reaches
   * 840, not 740. The three trees are in
   * `docs/visual/reports/phone-regressions-4.7.md`.
   *
   * So the marker stays until something decides about the rows that predate the
   * stage: the battle heading, the two Pokemon panels, and the move grid itself.
   * The day the number reaches 740 vitest reports the `fails` as an error and
   * the marker comes off. That is still the intended way to notice.
   */
  it.fails('ends both decision points above y=740 at 390x844', async () => {
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.map.decisionBottom, 'map: last offered node card').toBeLessThanOrEqual(740);
    expect(measured.battle.decisionBottom, 'battle: fourth move button').toBeLessThanOrEqual(740);
  }, 180_000);
});

/** The computed properties the plan names for sibling cards. */
const CARD_KEYS = ['backgroundColor', 'borderTopColor', 'borderLeftColor', 'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth', 'boxShadow', 'fontSize'] as const;

async function signatures(page: Page, selector: string): Promise<string[]> {
  // The pointer rests where the last click landed, which is a hover state on
  // whichever card is under it. Park it and let the 120ms transition finish.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  return page.evaluate(
    ([sel, keys]) =>
      [...globalThis.document.querySelectorAll(sel)].map((el) => {
        const style = globalThis.getComputedStyle(el);
        return keys.map((key) => `${key}=${style[key as keyof CSSStyleDeclaration]}`).join(' ');
      }),
    [selector, CARD_KEYS as unknown as string[]] as const,
  );
}

describe('siblings', () => {
  it('render starter, locale, reward and capture cards on one surface', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const groups: Record<string, string[]> = {};

    groups.starter = await signatures(page, `${visible('starter')} .starter`);
    await playUntil(page, (screen) => screen === 'locale');
    groups.locale = await signatures(page, `${visible('locale')} .locale`);
    await playUntil(page, async (screen, p) => screen === 'result' && (await p.locator(`${visible('result')} .reward`).count()) > 0);
    groups.reward = await signatures(page, `${visible('result')} .reward`);
    await playUntil(
      page,
      async (screen, p) =>
        screen === 'result' && (await p.locator(`${visible('result')} .party__member--offered`).count()) > 0 && !(await p.locator(`${visible('result')} .result__capture`).isHidden()),
    );
    groups.capture = await signatures(page, `${visible('result')} .party__member--offered`);
    await context.close();

    for (const [name, group] of Object.entries(groups)) {
      expect(group.length, `${name} cards present`).toBeGreaterThan(0);
      expect(new Set(group).size, `${name} cards identical: ${group.join(' | ')}`).toBe(1);
    }
    const surfaces = new Set(Object.values(groups).map((group) => group[0]));
    expect(surfaces.size, `one surface across kinds: ${[...surfaces].join(' | ')}`).toBe(1);
  }, 180_000);
});

describe('one accent', () => {
  it('never shows two primary actions, and shows one on every screen that has one', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const seen = new Map<string, number>();
    const count = async (): Promise<number> =>
      page.evaluate(() => [...globalThis.document.querySelectorAll('.primary-action')].filter((el) => (el as HTMLElement).offsetParent !== null).length);

    let opened = false;
    for (let step = 0; step < 500; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      if (screen === 'summary') break;
      if (screen === 'event') {
        // The carry-on button is the primary and appears after the choice.
        const choice = page.locator(`${visible('event')} .event__choice:not([disabled])`).first();
        if (await choice.count()) {
          await choice.click();
          await page.waitForTimeout(30);
        }
      }
      if (screen === 'map' && !opened) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(30);
        opened = true;
        continue;
      }
      const n = await count();
      seen.set(screen, Math.max(seen.get(screen) ?? 0, n));
      expect(n, `${screen} shows ${n} primary actions`).toBeLessThanOrEqual(1);
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    seen.set('summary', await count());
    await context.close();

    // `pre-gym` joined this list on 2026-09-10: its confirm is the control
    // that leaves the screen, so it is the one that carries the accent, and a
    // pre-gym screen with no primary is the softlock coming back.
    for (const screen of ['party', 'shop', 'event', 'result', 'summary', 'pre-gym']) {
      if (!seen.has(screen)) continue;
      expect(seen.get(screen), `${screen} has a primary action`).toBe(1);
    }
    for (const screen of ['starter', 'locale', 'map', 'battle', 'target', 'replace']) {
      if (!seen.has(screen)) continue;
      expect(seen.get(screen), `${screen} has no primary action`).toBe(0);
    }
    expect([...seen.keys()]).toEqual(expect.arrayContaining(['party', 'result', 'summary']));
  }, 300_000);
});
