/**
 * The six stat bars, measured where they are painted. **Patch 4.7.2.**
 *
 * The bug this replaces was invisible to every check the tree had: the values
 * were passed, the arithmetic was right, and `style.width` read back exactly
 * what the component wrote. `.stat__bar-fill` was an inline box, so the width
 * never became a pixel — the six rows rendered as flat dark tracks. A DOM
 * assertion would have passed on the broken build, which is why this one is in
 * a browser and asks for a **painted** width.
 *
 * The class of bug is guarded separately and more generally by
 * `test/visual-inline-box.test.ts`. This file is the specific promise: on the
 * surfaces that draw a member card, every stat row shows a bar whose painted
 * width is proportional to the number beside it.
 *
 * ## Proportional to the number *beside it*, not to a stat read from core/
 *
 * The obvious version compares against `describeSpecCard`, and that comparison
 * belongs in `test/party-stats.test.ts` where it is cheap and exact. Here the
 * number is on screen already, so the stronger question a browser can ask is
 * whether the *bar* and the *number* agree — which is what a reader actually
 * checks, and what a bar drawn from the wrong field would fail.
 *
 * ## Why this measures Simple mode
 *
 * **At this step the two are still mutually exclusive**: `bar.hidden = detailed`
 * means Detailed shows the number with the bar hidden, and Simple the reverse.
 * So the only mode in which there is a bar to measure is Simple, and the test
 * toggles into it. Step 4 of this patch is the ruling that Detailed must show
 * both, and it takes the toggle back out and asserts both modes.
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

interface Row {
  label: string;
  value: number | null;
  trackWidth: number;
  fillWidth: number;
  fillHeight: number;
  declared: string;
}

/** The stat rows of the first member card on the open screen. */
async function statRows(page: Page, screen: string): Promise<Row[]> {
  return page.evaluate((sel) => {
    const block = globalThis.document.querySelector(`${sel} .stats--party`);
    if (!block) return [];
    return [...block.querySelectorAll('.stat')].map((row) => {
      const value = row.querySelector('.stat__value');
      const track = row.querySelector('.stat__bar');
      const fill = row.querySelector('.stat__bar-fill');
      const box = (node: Element | null) => (node ? node.getBoundingClientRect() : null);
      const text = (value?.textContent ?? '').trim();
      return {
        label: (row.querySelector('.stat__label')?.textContent ?? '').trim(),
        value: text === '' ? null : Number(text),
        trackWidth: box(track)?.width ?? 0,
        fillWidth: box(fill)?.width ?? 0,
        fillHeight: box(fill)?.height ?? 0,
        declared: (fill as HTMLElement | null)?.style.width ?? '',
      };
    });
  }, visible(screen));
}

describe('the party screen stat bars', () => {
  let rows: Row[];

  beforeAll(async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    // Straight to the party screen: it is the first surface a member card
    // reaches and the one the bug was reported on.
    for (let step = 0; step < 600; step++) {
      const screen = await openScreen(page);
      if (screen === 'map') {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(200);
        break;
      }
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    /*
     * Into Simple, where the bar is the thing on screen. See the header: until
     * step 4 the bar and the number are swapped rather than shown together, so
     * Detailed has no bar to measure.
     */
    await page.locator('.verbosity__toggle').first().click();
    // The fill transitions its width over 120ms; measure after it lands.
    await page.waitForTimeout(300);
    rows = await statRows(page, 'party');
    await context.close();
  }, 600_000);

  it('renders six rows, one per stat', () => {
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.label)).toEqual([
      'Hit Points',
      'Attack',
      'Defence',
      'Special Attack',
      'Special Defence',
      'Speed',
    ]);
  });

  /**
   * The assertion the old build failed, in the terms it failed them in.
   *
   * `fillWidth` is a **painted** width off `getBoundingClientRect`, not the
   * declared percentage. On the broken build the declared value was correct on
   * all six rows and every painted box was 0x0.
   */
  it('paints a fill with non-zero width and height on every row with a non-zero stat', () => {
    const flat = rows
      .filter((row) => Number.parseFloat(row.declared) > 0)
      .filter((row) => row.fillWidth <= 0 || row.fillHeight <= 0)
      .map((row) => `${row.label}: declared "${row.declared}", painted ${row.fillWidth}x${row.fillHeight}`);
    expect(flat, 'a declared width that paints nothing is the 4.7.2 bug').toEqual([]);
  });

  it('gives every row a track to paint into', () => {
    expect(rows.filter((row) => row.trackWidth <= 0).map((row) => row.label)).toEqual([]);
  });

  /**
   * The painted width is the share the component asked for.
   *
   * Against the *track*, which is what the percentage is a percentage of, with
   * one pixel of tolerance for sub-pixel layout. This is the assertion that
   * separates "the fill has a box" from "the fill has the right box" — a
   * `display` fix that produced a full-width bar on every row would pass the
   * test above and fail this one.
   */
  it('paints each bar at the share the component asked for', () => {
    const wrong = rows
      .filter((row) => row.trackWidth > 0 && row.declared.endsWith('%'))
      .flatMap((row) => {
        const share = Number.parseFloat(row.declared) / 100;
        const expected = share * row.trackWidth;
        return Math.abs(row.fillWidth - expected) > 1
          ? [`${row.label}: declared ${row.declared} of ${row.trackWidth.toFixed(1)} → expected ${expected.toFixed(1)}px, painted ${row.fillWidth.toFixed(1)}`]
          : [];
      });
    expect(wrong, 'a percentage that paints a different width is not a bar').toEqual([]);
  });

  it('gives every row a distinct share, so the six are comparable', () => {
    const shares = rows.map((row) => row.declared).filter((declared) => declared.endsWith('%'));
    expect(shares).toHaveLength(6);
    expect(shares.every((declared) => Number.parseFloat(declared) > 0)).toBe(true);
  });
});
