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
   * on a 390x844 phone, with room under it for a thumb.
   *
   * **Real assertions since 2026-09-10, and the `it.fails` marker is gone.**
   * They were marked expected-to-fail for as long as the tree missed the line,
   * with a note saying the day it reached 740 vitest would report the `fails` as
   * an error and the marker would come off. That is what happened: the fold
   * patch took the fourth move button from 946.5 to 722.5 and the map's last
   * offered node card from 728.22 to 683.72, in five measured cuts of which four
   * were needed. `docs/visual/reports/restore-the-fold.md` itemises them.
   *
   * Two assertions rather than one. The screens miss this line for unrelated
   * reasons and are cut back by unrelated changes — the stat block is the
   * battle's and the party HUD is the map's — so a single test that failed would
   * not say which screen moved, and the map's margin is thinner than it looks.
   *
   * These are a *budget*, not a baseline: the test above pins the exact heights,
   * and this one says the heights are on the right side of a line. A cut that
   * takes more is welcome here and will still be caught there.
   */
  it('ends the battle screen decision point above y=740 at 390x844', async () => {
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.battle.decisionBottom, 'battle: fourth move button').toBeLessThanOrEqual(740);
  }, 180_000);

  it('ends the map screen decision point above y=740 at 390x844', async () => {
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.map.decisionBottom, 'map: last offered node card').toBeLessThanOrEqual(740);
  }, 180_000);

  /**
   * The collapsed stat block belongs to the battle panels and to nothing else.
   *
   * There are two stat blocks in the app. `ui/scene.ts` builds the panel's, one
   * per side, with a toggle and a `data-expanded` attribute; `ui/member-card.ts`
   * builds `stats--party`, on every party, drawer and result card, with neither.
   * The fold patch's one-row form is scoped to the attribute for that reason —
   * written against `.stats` it squeezed the member cards into one row as well,
   * with no control anywhere to open them again.
   *
   * **This is a test because the way that regression announced itself was
   * useless.** It did not fail as a squashed card. The geometry it moved put an
   * archetype chip under a point the browser bot taps, the tooltip that raised
   * covered the screen, and four visual tests in three files timed out clicking
   * through a dialog — none of them anywhere near the stylesheet. One assertion
   * at 390px on the shape of the grid says it in one line instead.
   */
  it('collapses the panel stat block and leaves the member cards alone', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'map');
    await page.locator('[data-drawer-trigger]').click();
    await page.waitForTimeout(200);

    const shape = await page.evaluate(() => {
      const columns = (node: Element | null): number =>
        node ? globalThis.getComputedStyle(node).gridTemplateColumns.split(' ').length : -1;
      const card = globalThis.document.querySelector('.drawer .stats--party');
      return {
        cardBlocks: globalThis.document.querySelectorAll('.stats--party').length,
        cardColumns: columns(card),
        cardToggles: card?.querySelectorAll('.stats__toggle').length ?? -1,
        cardHasAttribute: card?.hasAttribute('data-expanded') ?? true,
      };
    });
    await context.close();

    expect(shape.cardBlocks, 'the drawer draws a stat block per member').toBeGreaterThan(0);
    // Two columns is the four-row layout the member cards have always had. The
    // collapsed form is seven: six values and the toggle.
    expect(shape.cardColumns, 'member cards keep the two-column block').toBe(2);
    expect(shape.cardToggles, 'a member card has no control to open a block with').toBe(0);
    expect(shape.cardHasAttribute, 'only a block with a toggle is collapsible').toBe(false);
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
