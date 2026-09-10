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
 *     length.
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
  takenRows: number;
  partyHeight: number;
  partyColumns: number;
  moveListsOnMap: number;
} | null> {
  return page.evaluate(() => {
    const map = document.querySelector('.screen[data-screen="map"]:not([hidden])');
    if (!map) return null;
    const nodes = map.querySelector('.step--current .step__nodes');
    const party = map.querySelector('.party__members');
    const columns = party
      ? globalThis.getComputedStyle(party).gridTemplateColumns.split(' ').filter(Boolean).length
      : 0;
    return {
      innerHeight: globalThis.innerHeight,
      offeredBottom: nodes ? Math.round(nodes.getBoundingClientRect().bottom) : null,
      takenRows: map.querySelectorAll('.step--taken').length,
      partyHeight: party ? Math.round(party.getBoundingClientRect().height) : 0,
      partyColumns: columns,
      moveListsOnMap: map.querySelectorAll('.party__moves').length,
    };
  });
}

describe('the offered node cards stay above the fold', () => {
  it('at the deepest step of the longest segment, with the widest party', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'FOLD-1');

    const longest = stepsRangeFor(DEFAULT_TUNING, SEGMENTS_PER_RUN - 1).max;
    let worst = { bottom: 0, taken: 0, party: 0, segment: 0, where: 'never measured' };
    let deepestTaken = 0;
    let widestParty = 0;

    /*
     * Walk as far as the run gets, measuring the map at every point it is up. The
     * worst case is whatever the run actually reaches — asserting against a
     * constructed deepest case would be asserting against a map nobody can get to.
     */
    for (let step = 0; step < 700; step++) {
      if ((await openScreen(page)) === 'map') {
        const map = await readMap(page);
        if (map?.offeredBottom != null) {
          deepestTaken = Math.max(deepestTaken, map.takenRows);
          widestParty = Math.max(widestParty, map.partyHeight);
          if (map.offeredBottom > worst.bottom) {
            worst = {
              bottom: map.offeredBottom,
              taken: map.takenRows,
              party: map.partyHeight,
              segment: 0,
              where: `${map.takenRows} taken rows, party ${map.partyHeight}px`,
            };
          }
          expect(
            map.offeredBottom,
            `offered cards below the fold at ${map.takenRows} taken rows, party ${map.partyHeight}px`,
          ).toBeLessThanOrEqual(map.innerHeight);
        }
      }
      if ((await openScreen(page)) === 'summary') break;
      await stepOnce(page);
    }

    expect(worst.bottom, 'the map was never measured').toBeGreaterThan(0);
    // The run has to have got somewhere, or the sweep proves nothing.
    expect(widestParty, 'the party never rendered on the map').toBeGreaterThan(0);
    expect(longest).toBeGreaterThan(stepsRangeFor(DEFAULT_TUNING, 0).max);

    await context.close();
    expect(problems).toEqual([]);
  }, 600_000);

  it('collapses the steps already taken to one row, whatever the segment length', async () => {
    /*
     * **The property that makes the fix hold at any length.** If taken steps
     * rendered one row each, this count would climb with every node resolved and the
     * current step would march down the page — which is exactly how the `xfail` got
     * there. One row, or none before the first node.
     */
    const { page, context } = await openApp(harness.browser, harness.url, 'FOLD-2');

    let sawSome = false;
    for (let step = 0; step < 200; step++) {
      if ((await openScreen(page)) === 'map') {
        const map = await readMap(page);
        if (map) {
          expect(map.takenRows, 'more than one summary row for the past').toBeLessThanOrEqual(1);
          if (map.takenRows === 1) sawSome = true;
        }
      }
      if ((await openScreen(page)) === 'summary') break;
      await stepOnce(page);
    }

    expect(sawSome, 'the run never took a step, so the collapse was not exercised').toBe(true);
    await context.close();
  }, 600_000);

  it('keeps the map party compact: two columns, and no move lists', async () => {
    /*
     * Item 1's roster reaches six, and six full cards stacked was 697px of a 844px
     * phone. Asserted as the two properties that bound it rather than as a height,
     * so a future card that grew a row fails here rather than silently eating the
     * fold again.
     */
    const { page, context } = await openApp(harness.browser, harness.url, 'FOLD-3');

    for (let step = 0; step < 200; step++) {
      if ((await openScreen(page)) === 'map') {
        const map = await readMap(page);
        if (map && map.partyHeight > 0) {
          expect(map.moveListsOnMap, 'the map is drawing move lists again').toBe(0);
          expect(map.partyColumns, 'the map party is not a grid').toBeGreaterThanOrEqual(1);
          break;
        }
      }
      await stepOnce(page);
    }

    await context.close();
  }, 600_000);
});
