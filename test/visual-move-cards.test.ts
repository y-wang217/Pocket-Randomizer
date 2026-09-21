/**
 * Hold a move, get an explanation — on every surface that draws a move card,
 * and on no surface that submits one. **Patch 4.7.2 step 5, rebuilt at M2.1.**
 *
 * The content of an explanation is asserted without a browser, in
 * `test/move-explanation.test.ts`, and the long press itself in
 * `test/inspect.test.ts`. What needs a real run is the *reach*: which surfaces
 * the one insertion point actually got to, and that reaching it spends nothing.
 *
 * ## What M2.1 changed here, and what it did not
 *
 * Until M2.1 the mechanism was an `Explain` button under every card, and this
 * file counted those. D15 ruled it out: R5 allows exactly one explanation
 * mechanism and its forbids list names "a help button", and the census counted
 * 24 of them on the summary screen alone. The card itself is the trigger now.
 *
 * **The question is unchanged and so is the shape of the answer.** A claim
 * about which surfaces mount the shared card is a claim about the call graph,
 * and a claim about a call graph goes stale the first time a screen is added —
 * so the run still walks until it has seen the insertion point on each of the
 * seven, and the assertion is still the set. What moved is the thing counted.
 *
 * ## The seven
 *
 * `scene.moveCard` is the single insertion point, and the surfaces that call it
 * are the party screen, the party drawer, pre-gym, the move-replace incoming
 * card, the move reward card, the run summary and — from patch 4.8.0.2 — the
 * recipient screen, where the gym's granted move had been arriving with no
 * card at all.
 *
 * ## The battle bar is asserted to draw none
 *
 * `renderMove` builds its buttons from `moveFacts`, not from `moveCard`, so the
 * battle bar is structurally out of reach of this component — and it has a
 * trigger of its own, which M1.2 put on the button. A `.move--card` appearing
 * there would be a second trigger on a control where a stray tap spends a turn,
 * so its absence is worth an assertion rather than a comment. That is R8's
 * insertion point, and open item 9 is closed by M1.2 having given it one.
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
 * assumed. `summary` arrives only at the end of a run.
 *
 * `target` and `replace` are reached from the party screen's Teach control now
 * rather than from `playRun` at the node that paid the move. Same two screens,
 * same move card, same insertion point — what changed is who opens them.
 */
const SURFACES = ['party', 'drawer', 'pre-gym', 'replace', 'result', 'target', 'summary'] as const;

/**
 * The move cards on the open screen, how many are inspect triggers, and the
 * face facts. **Rewritten at M2.1; it used to count expanders.**
 *
 * `ui/move-explanation.ts` rendered an `Explain` button under every card and
 * this counted those. D15 ruled it out — R5 allows one explanation mechanism
 * and calls a help button one — and M2.1 made the card itself the trigger. So
 * the question this file exists for is unchanged (*which surfaces does the one
 * insertion point actually reach?*) and only the thing counted moved.
 *
 * **The tag count stays, because the trigger count could not have caught #24's
 * bug.** A surface whose `moveCardData` call got something other than a
 * `Tuning` still produced a trigger — that comes off `explanation` — while
 * `tagsForFace` silently returned nothing, because the cap arrived as
 * `undefined` and `slice(0, NaN)` is empty. So a reach sweep proves the
 * insertion point was reached and not that real data came through it.
 * `faceMax` is what separates the two. See `docs/generation.md` section 12g.
 *
 * `expanders` is counted so it can be asserted to be zero everywhere. A single
 * surviving one is a second mechanism, which is the thing R5 forbids.
 */
async function cardFaces(
  page: Page,
  scope: string,
): Promise<{ cards: number; triggers: number; focusable: number; expanders: number; faceMax: number }> {
  return page.evaluate((sel) => {
    const root = globalThis.document.querySelector(sel);
    if (!root) return { cards: 0, triggers: 0, focusable: 0, expanders: 0, faceMax: 0 };
    const cards = [...root.querySelectorAll('.move--card')] as HTMLElement[];
    const faces = [...root.querySelectorAll('.move')].map(
      (face) => face.querySelectorAll('.move__facts .badge--fact').length,
    );
    return {
      cards: cards.length,
      // `move:` and nothing else: the panel the battle button has opened since
      // M1.2, so a move reads the same everywhere the player meets it.
      triggers: cards.filter((card) => (card.dataset['tip'] ?? '').startsWith('move:')).length,
      // Long press is not a keyboard gesture. This is the half of D15 that had
      // to be replaced rather than deleted.
      focusable: cards.filter((card) => card.tabIndex === 0 && card.getAttribute('role') === 'button').length,
      expanders: root.querySelectorAll('.move__explain-toggle, .move__explain').length,
      faceMax: faces.length === 0 ? 0 : Math.max(...faces),
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

    /**
     * Record this surface's cards, and check the keyboard path costs nothing.
     *
     * It used to open an expander and assert the run had not moved. There is
     * no expander to open now, and a *tap* on a card is supposed to select —
     * R5 is explicit that tap still selects and the explanation is the long
     * press — so tapping to probe would spend the very thing this guards.
     *
     * Focus is the tap's replacement and is the better probe anyway: it is the
     * path D15 had to preserve when the expander went, it is the one a
     * keyboard actually takes, and it must move nothing. The long press itself
     * is asserted in jsdom by `test/inspect.test.ts`, which is where a
     * duration belongs; this file answers reach.
     */
    const probe = async (label: string, scope: string): Promise<void> => {
      const seenHere = await cardFaces(page, scope);
      if (seenHere.cards === 0) return;
      found[label] = Math.max(found[label] ?? 0, seenHere.triggers);
      tags[label] = Math.max(tags[label] ?? 0, seenHere.faceMax);

      if (seenHere.expanders !== 0) {
        violations.push(`${label}: ${seenHere.expanders} expander(s) survive, which is a second mechanism (R5)`);
      }
      if (seenHere.triggers !== seenHere.cards) {
        violations.push(`${label}: ${seenHere.cards - seenHere.triggers} of ${seenHere.cards} cards open nothing`);
      }
      if (seenHere.focusable !== seenHere.cards) {
        violations.push(`${label}: ${seenHere.cards - seenHere.focusable} of ${seenHere.cards} cards cannot be reached by keyboard`);
      }

      const stateBefore = await runState(page);
      await page.locator(`${scope} .move--card`).first().focus();
      const stateAfter = await runState(page);
      if (stateAfter !== stateBefore) {
        violations.push(`${label}: focusing a move card changed the run\n  ${stateBefore}\n  ${stateAfter}`);
      }
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
        battleTriggers = (await cardFaces(page, visible('battle'))).cards;
      }

      if ((SURFACES as readonly string[]).includes(screen) && found[screen] === undefined) {
        await page.mouse.move(0, 0);
        await page.waitForTimeout(150);
        await probe(screen, visible(screen));
      }

      if (screen === 'summary') break;
      // The screen this lap decided about, so a transition landing mid-lap
      // costs a retry rather than a surface. See `stepOnceUnparked`.
      if (!(await stepOnce(page, screen))) await page.waitForTimeout(16);
    }

    await context.close();
    seen = found;
    faceTags = tags;
    spent = violations;
  }, 900_000);

  it('reaches all seven surfaces from the one insertion point', () => {
    expect(Object.keys(seen).sort()).toEqual([...SURFACES].sort());
  });

  it('makes every move card those surfaces draw an inspect trigger', () => {
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

  /**
   * And the one surface it must not reach, because a tap there costs a turn.
   *
   * `renderMove` builds its buttons from `moveFacts` rather than `moveCard`, so
   * the battle bar is structurally out of reach of the card trigger — it has
   * its own, which M1.2 gave it, on the button itself. What this asserts is
   * that no `.move--card` is ever drawn inside the battle screen: a card there
   * would be a second trigger on a control where a stray tap spends a turn.
   */
  it('draws no move card on the battle screen, which has its own trigger', () => {
    expect(battleTriggers, 'the battle screen was never reached').toBeGreaterThanOrEqual(0);
    expect(battleTriggers).toBe(0);
  });
});
