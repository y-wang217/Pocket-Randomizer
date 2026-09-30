/**
 * The map's fold, at the longest segment the curve can draw.
 *
 * **Stage 4.8, items 1 and 3, requirement 11.** The `xfail` this closes had sat on
 * `scripts/smoke.mjs` since Release C at `cards end at y=869 of 844`. The smoke
 * check and `test/visual-v0.test.ts` both measure SMOKE24 at one point in one run,
 * which is the right guard for a regression and the wrong one for this claim: item 3
 * made segments 6-7 steps instead of 4-5, and item 1 made the roster six instead of
 * three, so **the interesting case is the deepest step of the longest segment with
 * the widest party** — a combination no fixed seed is guaranteed to visit.
 *
 * So this drives the real app, in Chromium, at 390x844, to the worst position it
 * can reach, and asserts the offered cards are above the fold there.
 *
 * ## Why the fix holds rather than happening to fit
 *
 * Two changes bound the decision's position instead of shaving pixels:
 *
 *   - Taken steps collapse to one line, so walking a segment no longer pushes the
 *     current step down. The chain above the decision is one row, whatever the
 *     length. **Until Stage 5.0/4**, which draws the whole segment as a graph of
 *     marks on one screen; the second case below says how that bounds it.
 *   - The map's party cards dropped their move lists and went to two columns, so a
 *     roster that doubled costs one extra grid row instead of three stacked cards.
 *
 * Both are asserted here as *properties*, not as pixel counts, because a pixel count
 * would pass for the wrong reason the first time a font changed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright';

import { openApp, openScreen, stepOnce } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';
import { SEGMENTS_PER_RUN } from '../src/core/run';
import { DEFAULT_TUNING, stepsRangeFor } from '../src/data/tuning';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

/** The map's vertical facts, as the player's screen has them. */
async function readMap(page: Page): Promise<{
  innerHeight: number;
  offeredBottom: number | null;
  partyCards: number;
  moveListsOnMap: number;
} | null> {
  return page.evaluate(() => {
    const map = document.querySelector('.screen[data-screen="map"]:not([hidden])');
    if (!map) return null;
    const nodes = map.querySelector('.step--current .step__nodes');
    return {
      innerHeight: globalThis.innerHeight,
      offeredBottom: nodes ? Math.round(nodes.getBoundingClientRect().bottom) : null,
      partyCards: map.querySelectorAll('.party__member').length,
      moveListsOnMap: map.querySelectorAll('.party__moves').length,
    };
  });
}

describe('the offered node cards stay above the fold', () => {
  it('at the deepest step of the longest segment, with the widest party', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMK49-2');

    const longest = stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN - 1).max;
    let worst = { bottom: 0, where: 'never measured' };
    let maps = 0;

    /*
     * Walk as far as the run gets, measuring the map at every point it is up. The
     * worst case is whatever the run actually reaches — asserting against a
     * constructed deepest case would be asserting against a map nobody can get to.
     * (The party and the taken-row count this once recorded left the map in
     * 5.0/4; the constructed worst case is the gallery's `deepMapState`.)
     */
    for (let step = 0; step < 700; step++) {
      if ((await openScreen(page)) === 'map') {
        const map = await readMap(page);
        if (map?.offeredBottom != null) {
          maps++;
          if (map.offeredBottom > worst.bottom) worst = { bottom: map.offeredBottom, where: `map ${maps}` };
          expect(map.offeredBottom, `offered cards below the fold at map ${maps}`).toBeLessThanOrEqual(map.innerHeight);
        }
      }
      if ((await openScreen(page)) === 'summary') break;
      await stepOnce(page);
    }

    expect(worst.bottom, 'the map was never measured').toBeGreaterThan(0);
    // The run has to have got somewhere, or the sweep proves nothing.
    expect(maps, 'the run reached fewer than two maps').toBeGreaterThan(1);
    expect(longest).toBeGreaterThan(stepsRangeFor(DEFAULT_TUNING, 0).max);

    await context.close();
    expect(problems).toEqual([]);
  }, 600_000);

  /*
   * **Rewritten for Stage 5.0/4** (`docs/spec/gymrun-stage5.0-visual-redesign.md`,
   * Stage 4: *"the whole segment visible at once on a phone"*). This asserted
   * that taken steps collapsed to one summary row, which was 4.8's way of
   * keeping the current step from marching down the page. The graph draws
   * every step as a row of marks instead, bottom up, and bounds the decision's
   * position the other way: the whole segment is one screen, so nothing above
   * or below it can push it off. The property is the same one, asserted as the
   * design now states it: one row per step, the gym and the entrance, and the
   * current row on screen, at every map the run reaches.
   */
  it('draws every step of the segment as one row, whatever the segment length', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMK49-2');

    let sawSome = false;
    for (let step = 0; step < 200; step++) {
      if ((await openScreen(page)) === 'map') {
        const graph = await page.evaluate(() => {
          const map = document.querySelector('.screen[data-screen="map"]:not([hidden]) .map-graph');
          return map
            ? {
                steps: Number(map.getAttribute('data-steps')),
                rows: map.querySelectorAll('.map-graph__rows > .step').length,
                done: map.querySelectorAll('.map-graph__rows > .step--done:not(.step--gym)').length,
              }
            : null;
        });
        if (graph) {
          expect(graph.rows, 'one row per step, plus the gym and the entrance').toBe(graph.steps + 2);
          if (graph.done > 0) sawSome = true;
        }
      }
      if ((await openScreen(page)) === 'summary') break;
      await stepOnce(page);
    }

    expect(sawSome, 'the run never took a step, so the walked rows were not exercised').toBe(true);
    await context.close();
  }, 600_000);

  /*
   * **Rewritten for Stage 5.0/4.** This held the map's party HUD compact (two
   * columns, no move lists), because six stacked cards once pushed the
   * decision off a phone. The author took the team off the map
   * (`docs/spec/gymrun-stage5.0-rulings-map-without-team.md`); the Team tab
   * opens the party screen instead. The claim that bounds the fold is now the
   * stronger one: the map carries no member card at all.
   */
  it('carries no team on the map', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'FOLD-3');

    let seen = 0;
    for (let step = 0; step < 200 && seen < 3; step++) {
      if ((await openScreen(page)) === 'map') {
        const map = await readMap(page);
        if (map) {
          expect(map.partyCards, 'a member card is back on the map').toBe(0);
          expect(map.moveListsOnMap, 'the map is drawing move lists again').toBe(0);
          seen++;
        }
      }
      await stepOnce(page);
    }

    expect(seen, 'the map was never measured').toBeGreaterThan(0);
    await context.close();
  }, 600_000);
});
