/**
 * Tap a move, get an explanation — on every surface that draws a move card, and
 * on no surface that submits one. **Patch 4.7.2, step 5.**
 *
 * The content of an explanation is asserted without a browser, in
 * `test/move-explanation.test.ts`. What needs a real run is the *reach*: which
 * surfaces the one insertion point actually got to, and that opening a panel on
 * each of them spends nothing.
 *
 * ## The six, and why the count is asserted rather than described
 *
 * `scene.moveCard` is the single insertion point, and the surfaces that call it
 * are the party screen, the party drawer, pre-gym, the move-replace incoming
 * card, the move reward card and the run summary. That list is a claim about
 * the call graph, and a claim about a call graph goes stale the first time a
 * screen is added. So the run walks until it has seen an expander on each, and
 * the assertion is the set — a surface that stops carrying one fails here
 * rather than being quietly dropped.
 *
 * ## The battle bar is asserted to have none
 *
 * `renderMove` builds its buttons from `moveFacts`, not from `moveCard`, so the
 * battle bar is structurally out of reach of this feature — a tap on a move
 * button spends a turn, and that it *cannot* grow an expander by accident is
 * worth an assertion rather than a comment. Open item 9 records that R8 will
 * need its own insertion point.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, openScreen, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';
import { DEFAULT_TUNING } from '../src/data/tuning';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/**
 * The surfaces the insertion point is expected to reach.
 *
 * `party` covers the party screen and, through the same `memberCardContents`,
 * the drawer — which is opened explicitly below so it is measured rather than
 * assumed. `summary` is the sixth and arrives only at the end of a run.
 */
const SURFACES = ['party', 'drawer', 'pre-gym', 'replace', 'result', 'summary'] as const;

/**
 * Expanders on the open screen, whether any panel is showing, and the face tags.
 *
 * **The tag count is here because the expander count could not have caught
 * #24's bug.** A surface whose `moveCardData` call got something other than a
 * `Tuning` still renders an expander — that comes off `explanation` — while
 * `tagsForFace` silently returns nothing, because the cap arrives as `undefined`
 * and `slice(0, NaN)` is empty. So this sweep proved the insertion point was
 * reached and not that real data came through it. `faceMax` is what separates
 * the two. See `docs/generation.md` section 12g.
 */
async function expanders(page: Page, scope: string): Promise<{ triggers: number; open: number; faceMax: number }> {
  return page.evaluate((sel) => {
    const root = globalThis.document.querySelector(sel);
    if (!root) return { triggers: 0, open: 0, faceMax: 0 };
    const triggers = [...root.querySelectorAll('.move__explain-toggle')];
    const panels = [...root.querySelectorAll('.move__explain')];
    // Per face, not per screen: the cap in `tuning.maxMoveTagsOnFace` is a
    // per-card number, so a screen total would not test it.
    const faces = [...root.querySelectorAll('.move')].map(
      (face) => face.querySelectorAll('.move__tags .badge').length,
    );
    return {
      faceMax: faces.length === 0 ? 0 : Math.max(...faces),
      triggers: triggers.length,
      // **Painted, not `.hidden`.** The property said closed while the panel
      // laid out at full height, because `.move__explain` sets `display: grid`
      // and that beats the UA's `[hidden]` rule — the trap `styles.css` has
      // now been bitten by three times. Measuring the box is what notices.
      open: panels.filter((panel) => (panel as HTMLElement).getBoundingClientRect().height > 0).length,
    };
  }, scope);
}

/** A fingerprint of everything a tap must not change. */
async function runState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const screen = [...globalThis.document.querySelectorAll('.screen')].find((el) => !(el as HTMLElement).hidden);
    const log = globalThis.document.querySelectorAll('.log-entry').length;
    const hp = [...globalThis.document.querySelectorAll('.panel__hp-text')].map((n) => n.textContent).join('|');
    const pp = [...globalThis.document.querySelectorAll('.move__pp')].map((n) => n.textContent).join('|');
    return JSON.stringify({ screen: (screen as HTMLElement | undefined)?.dataset.screen ?? null, log, hp, pp });
  });
}

describe('the move explanation, across every surface it reaches', () => {
  let seen: Record<string, number>;
  let faceTags: Record<string, number>;
  let spent: string[];
  let battleTriggers: number;

  beforeAll(async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const found: Record<string, number> = {};
    /** Most face tags on any one move card, per surface. */
    const tags: Record<string, number> = {};
    const violations: string[] = [];
    let openedParty = false;
    let openedDrawer = false;
    battleTriggers = -1;

    /** Open one expander on the given scope and assert nothing else moved. */
    const probe = async (label: string, scope: string): Promise<void> => {
      const before = await expanders(page, scope);
      if (before.triggers === 0) return;
      found[label] = Math.max(found[label] ?? 0, before.triggers);
      tags[label] = Math.max(tags[label] ?? 0, before.faceMax);

      const stateBefore = await runState(page);
      await page.locator(`${scope} .move__explain-toggle`).first().click();
      await page.waitForTimeout(150);

      const after = await expanders(page, scope);
      if (before.open !== 0) violations.push(`${label}: a panel was already laid out before the tap`);
      if (after.open === 0) violations.push(`${label}: the tap opened nothing`);
      const stateAfter = await runState(page);
      if (stateAfter !== stateBefore) {
        violations.push(`${label}: opening an explanation changed the run\n  ${stateBefore}\n  ${stateAfter}`);
      }
      // Closed again, so the next screen is measured from a clean state.
      await page.locator(`${scope} .move__explain-toggle`).first().click();
      await page.waitForTimeout(100);
    };

    for (let step = 0; step < 900; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }

      if (screen === 'map' && !openedParty) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(150);
        openedParty = true;
        continue;
      }

      // The drawer, from the shell-level trigger, once.
      if (screen === 'map' && !openedDrawer) {
        openedDrawer = true;
        await page.locator('.drawer__trigger').first().click();
        await page.waitForTimeout(200);
        await probe('drawer', '.drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        continue;
      }

      if (screen === 'battle' && battleTriggers < 0) {
        battleTriggers = (await expanders(page, visible('battle'))).triggers;
      }

      if ((SURFACES as readonly string[]).includes(screen) && found[screen] === undefined) {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(150);
        await probe(screen, visible(screen));
      }

      if (screen === 'summary') break;
      await stepOnce(page);
      await page.waitForTimeout(25);
    }

    await context.close();
    seen = found;
    faceTags = tags;
    spent = violations;
  }, 900_000);

  it('reaches all six surfaces from the one insertion point', () => {
    expect(Object.keys(seen).sort()).toEqual([...SURFACES].sort());
  });

  it('puts an expander on every move card those surfaces draw', () => {
    const empty = Object.entries(seen).filter(([, count]) => count === 0).map(([label]) => label);
    expect(empty).toEqual([]);
    // A party member has four moves, so the surfaces that draw one carry four.
    expect(seen['party'], 'the party screen draws a full moveset').toBeGreaterThanOrEqual(4);
  });

  /*
   * **The tag row, per surface, which is the assertion that was missing.**
   *
   * #24's bug was a surface handed something other than a `Tuning`: the expander
   * still rendered, and `tagsForFace` silently returned nothing. The test above
   * passed on a summary whose tag row had gone. See `generation.md` section 12g.
   *
   * Asserted only on the four surfaces that draw a held Pokemon's full moveset.
   * `result` and a reward card are excluded deliberately rather than for
   * convenience: a card with no recipient chosen yet passes no holder, which is
   * the documented STAB rule in `ui/move-detail.ts`, so a legitimately untagged
   * face is reachable there and a floor would be asserting the wrong thing.
   */
  const HOLDER_SURFACES = ['party', 'drawer', 'pre-gym', 'summary'] as const;

  it('fills the tag row on every surface that draws a held moveset', () => {
    // Non-vacuity first. If nothing anywhere carries a tag the per-surface
    // assertion below is comparing zeroes and proves nothing — which is exactly
    // how the bug survived a green sweep the first time.
    const best = Math.max(0, ...Object.values(faceTags));
    expect(best, 'no surface carried a single face tag, so this test proves nothing').toBeGreaterThan(0);

    const bare = HOLDER_SURFACES.filter((label) => (faceTags[label] ?? 0) === 0);
    expect(bare, 'a surface drew move cards with no face tags at all').toEqual([]);
  });

  it('keeps every face at or under the tuning cap', () => {
    // The ceiling the smoke run also checks, here across all six surfaces
    // rather than the battle screen alone. A ceiling alone is not enough — zero
    // satisfies it — which is why it sits beside the floor above, not instead.
    const over = Object.entries(faceTags).filter(([, most]) => most > DEFAULT_TUNING.maxMoveTagsOnFace);
    expect(over).toEqual([]);
  });

  /**
   * Test 10, on every surface it reaches.
   *
   * The fingerprint covers the open screen, the battle log's length, and every
   * HP and PP readout — so a tap that submitted a reward, picked a target,
   * displaced a move or spent a turn moves it.
   */
  it('never submits a move or advances a turn, on any of them', () => {
    expect(spent).toEqual([]);
  });

  /** And the one surface it must not reach, because a tap there costs a turn. */
  it('puts no expander on a battle move button', () => {
    expect(battleTriggers, 'the battle screen was never reached').toBeGreaterThanOrEqual(0);
    expect(battleTriggers).toBe(0);
  });
});
