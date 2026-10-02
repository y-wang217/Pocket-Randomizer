/**
 * The six stat numbers, measured where they are painted. **Patch 4.7.2; the
 * bars retired at Bible Rev 20, D82, and back against the band at Rev 21,
 * D88.**
 *
 * This file measured the six stat *bars*: the 4.7.2 bug was a fill whose
 * declared width never became a pixel, invisible to every DOM check. The bars
 * are gone and the number is the readout (R13), so the promise is the same
 * one asked of the number: on the party screen's first member card, unopened,
 * each of the six rows paints a non-empty number box, and the number painted
 * is the value the label carries for the long press.
 *
 * Since D88 each number has a bar beside it again, measured against the band
 * that stat takes at the member's level, and the 4.7.2 promise comes back
 * with it: a fill whose declared width never becomes a pixel is the bug this
 * file was written for, so each fill's painted width is measured against the
 * fraction the row declares.
 *
 * The name is kept because the documents that record the 4.7.2 bug cite it,
 * and the bug's class is still guarded generally by
 * `test/visual-inline-box.test.ts`.
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
  fraction: number | null;
  track: number;
  fill: number;
  value: number | null;
  labelled: number | null;
  width: number;
  height: number;
}

/** The stat rows of the first member card on the open screen. */
async function statRows(page: Page, screen: string): Promise<Row[]> {
  return page.evaluate((sel) => {
    const block = globalThis.document.querySelector(`${sel} .party__member .stats`);
    if (!block) return [];
    return [...block.querySelectorAll('.stat')].map((row) => {
      const value = row.querySelector('.stat__value');
      const box = value ? value.getBoundingClientRect() : null;
      const text = (value?.textContent ?? '').trim();
      const labelled = (row.querySelector('.stat__label') as HTMLElement | null)?.dataset['value'];
      const fraction = (row as HTMLElement).dataset['fraction'];
      return {
        label: (row.querySelector('.stat__label-long')?.textContent ?? '').trim(),
        fraction: fraction === undefined ? null : Number(fraction),
        track: row.querySelector('.stat__bar')?.getBoundingClientRect().width ?? 0,
        fill: row.querySelector('.stat__bar-fill')?.getBoundingClientRect().width ?? 0,
        value: text === '' ? null : Number(text),
        labelled: labelled === undefined ? null : Number(labelled),
        width: box?.width ?? 0,
        height: box?.height ?? 0,
      };
    });
  }, visible(screen));
}

describe('the party screen stat numbers', () => {
  let rows: Row[];

  beforeAll(async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    for (let step = 0; step < 600; step++) {
      const screen = await openScreen(page);
      if (screen === 'map') {
        await page.locator('[data-nav="team"]').click();
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
    // No tap: the numbers are on the card's head since D83.
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

  it('paints a number with a non-empty box on every row, without opening the card', () => {
    const flat = rows.filter((row) => row.width <= 0 || row.height <= 0).map((row) => `${row.label}: ${row.width}x${row.height}`);
    expect(flat, 'a number that paints nothing is the 4.7.2 bug in its new place').toEqual([]);
  });

  it('paints the value the label carries, on every row', () => {
    expect(rows.every((row) => row.value !== null && row.value > 0)).toBe(true);
    expect(rows.map((row) => row.value)).toEqual(rows.map((row) => row.labelled));
  });

  it('paints each band bar to the fraction its row declares (D88)', () => {
    for (const row of rows) {
      expect(row.fraction, `${row.label} declares a fraction`).not.toBeNull();
      expect(row.track, `${row.label} paints a track`).toBeGreaterThan(8);
      // The fill keeps a 2px floor so an empty bar is still seen as a bar.
      expect(row.fill, row.label).toBeCloseTo(Math.max(2, row.track * row.fraction!), 0);
    }
  });
});
