/**
 * A width that can never paint. **Patch 4.7.2, and this is a class of bug.**
 *
 * `width` and `height` do not apply to a non-replaced **inline** box. CSS says
 * so and no browser warns about it: the declaration is valid, the property
 * computes, `element.style.width` reads back exactly what was written, and the
 * box renders at 0x0. Every instrument short of looking at the pixels agrees the
 * value is there.
 *
 * That is what happened to the party screen's six stat bars. `.stat__bar-fill`
 * was an `el('span', …)` whose rule set `height: 100%` and whose component wrote
 * `style.width = '47%'`. Measured on the real screen: the inline width present,
 * the bounding box 0x0, and the player looking at a flat dark track on all six
 * rows. `.hp__fill` escaped the identical bug only by being a `div`. Nothing in
 * the tree could have caught it — the values were right, the arithmetic was
 * right, and the DOM assertion a jsdom test would make passes.
 *
 * So the guard is not "the stat bar paints" — that is
 * `test/visual-stat-bars.test.ts` and it would not have caught the *next* one.
 * This asserts the property the bug is an instance of, over every element on
 * every screen the run reaches: **if something is given an inline width or
 * height, it must be in a box where those mean something.**
 *
 * ## What counts as a box where they mean something
 *
 * Anything but `display: inline`. Replaced elements — `img`, `svg`, `canvas`,
 * `video`, `input` and friends — are the exception the spec itself carves out:
 * width and height apply to them while inline, which is why they are named here
 * rather than left to trip a test they do not violate.
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

interface Offender {
  screen: string;
  selector: string;
  declared: string;
  display: string;
}

/**
 * Replaced elements, where width and height apply while inline.
 *
 * Listed rather than sniffed: "is this element replaced" has no DOM predicate,
 * and a regex over tag names is at least a list a reader can check.
 */
const REPLACED = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'EMBED', 'OBJECT', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'PROGRESS', 'METER']);

/** Every element on the open screen carrying an inline width or height. */
async function offendersOn(page: Page, screen: string): Promise<Omit<Offender, 'screen'>[]> {
  return page.evaluate(
    ([sel, replaced]) => {
      const root = globalThis.document.querySelector(sel as string);
      if (!root) return [];
      const skip = new Set(replaced as string[]);
      return [...root.querySelectorAll('[style]')].flatMap((node) => {
        const inline = (node as HTMLElement).style;
        const declared = [
          inline.width ? `width: ${inline.width}` : '',
          inline.height ? `height: ${inline.height}` : '',
        ].filter(Boolean).join('; ');
        if (!declared) return [];
        if (skip.has(node.tagName)) return [];
        const display = globalThis.getComputedStyle(node).display;
        if (display !== 'inline') return [];
        // A readable identity, since the element itself cannot cross the bridge.
        const selector = `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).trim().split(/\s+/).join('.')}` : ''}`;
        return [{ selector, declared, display }];
      });
    },
    [visible(screen), [...REPLACED]] as const,
  );
}

interface Shown {
  screen: string;
  selector: string;
  display: string;
  height: number;
}

/**
 * Every element carrying `hidden` that is nonetheless laid out.
 *
 * **The same family as the rule above and the third time it has bitten this
 * codebase.** `hidden` is a UA style — `display: none` at the lowest possible
 * specificity — so *any* author rule that sets `display` on the element beats
 * it, silently. `styles.css` carries the note twice already; 4.7.2 added the
 * third instance, `.move__explain { display: grid }`, and it cost two guarded
 * fold properties before the assertions caught it.
 */
async function shownWhileHiddenOn(page: Page, screen: string): Promise<Omit<Shown, 'screen'>[]> {
  return page.evaluate((sel) => {
    const root = globalThis.document.querySelector(sel as string);
    if (!root) return [];
    return [...root.querySelectorAll('[hidden]')].flatMap((node) => {
      const display = globalThis.getComputedStyle(node).display;
      if (display === 'none') return [];
      const height = node.getBoundingClientRect().height;
      const selector = `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).trim().split(/\s+/).join('.')}` : ''}`;
      return [{ selector, display, height }];
    });
  }, visible(screen));
}

describe('an inline width is a width that paints', () => {
  let offenders: Offender[];
  let shown: Shown[];
  let screens: string[];

  beforeAll(async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const found: Offender[] = [];
    const laidOut: Shown[] = [];
    const seen = new Set<string>();
    let openedParty = false;

    for (let step = 0; step < 600; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      // The party screen is where the bug that prompted this test lived, and
      // the run never routes through it on its own.
      if (screen === 'map' && !openedParty) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(50);
        openedParty = true;
        continue;
      }
      if (!seen.has(screen)) {
        seen.add(screen);
        await page.waitForTimeout(120);
        found.push(...(await offendersOn(page, screen)).map((offender) => ({ ...offender, screen })));
        laidOut.push(...(await shownWhileHiddenOn(page, screen)).map((entry) => ({ ...entry, screen })));
      }
      if (screen === 'summary') break;
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    await context.close();
    offenders = found;
    shown = laidOut;
    screens = [...seen];
  }, 900_000);

  it('walks the screens the run reaches, so the check is not vacuous', () => {
    expect(screens).toEqual(
      expect.arrayContaining(['starter', 'locale', 'map', 'party', 'battle', 'result']),
    );
  });

  it('never leaves an element with an inline width or height as an inline box', () => {
    expect(
      offenders.map((offender) => `${offender.screen} ${offender.selector} { ${offender.declared} } is display: inline`),
      'width and height do not apply to a non-replaced inline box: the value is set and never paints',
    ).toEqual([]);
  });

  /**
   * The other half of the same family, and the one that has bitten three times.
   *
   * An element with `hidden` set that still lays out is a rule quietly beating
   * the UA stylesheet. The DOM says closed, the layout says open, and the only
   * instrument that disagrees is a measurement — which is what this is.
   */
  it('never lays out an element that carries the hidden attribute', () => {
    expect(
      shown.map((entry) => `${entry.screen} ${entry.selector} is display: ${entry.display} at ${entry.height}px while [hidden]`),
      'an author rule setting display beats the UA [hidden] rule, silently',
    ).toEqual([]);
  });
});
