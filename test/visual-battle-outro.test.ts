/**
 * The end of a fight, in a browser. **The battle animation run, Branch 3A.**
 *
 * `test/battle-outro.test.ts` asserts the attributes and the promise in jsdom,
 * where no custom property resolves and so no hold ever runs. **That leaves the
 * one claim the patch exists for unasserted**: that the stage is still on
 * screen, mid-animation, when it used to have been replaced already. Only a
 * real engine can say so, because only a real engine resolves
 * `--motion-outro`, runs a CSS animation and reports what is painted.
 *
 * So this plays a real fight on SMOKE24 to its end and looks at the frame that
 * did not previously exist.
 *
 * It is one test rather than several because the expensive part is reaching the
 * end of a fight, and splitting it would pay that cost per assertion.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, stepOnce } from '../scripts/visual/browser.mjs';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

const PHONE = { width: 390, height: 844 };

describe('a fight ends on the stage it was fought on', () => {
  it('holds the battle screen through the outro, then shows the result', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24', PHONE);
    await playUntil(page, (screen) => screen === 'battle');

    /*
     * Step until a body is leaving. The marker is `data-outro` on an actor,
     * which `scene.ts` sets only from `outro()` and therefore only when a
     * fight has finished — so finding it is finding the end of a fight, with
     * no guess about how many turns that took.
     */
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await stepOnce(page);
      await page.waitForTimeout(60);
      if ((await page.locator('.stage__actor[data-outro]').count()) === 0) continue;

      const probe = await page.evaluate(() => ({
        screen: globalThis.document.querySelector('.screen:not([hidden])')?.getAttribute('data-screen'),
        scrollWidth: globalThis.document.documentElement.scrollWidth,
        kinds: [...globalThis.document.querySelectorAll('.stage__actor[data-outro]')].map(
          (actor) => (actor as HTMLElement).dataset['outro'],
        ),
        running: [...globalThis.document.querySelectorAll('.stage__actor[data-outro] .sprite:not(.sprite--ghost)')].map(
          (sprite) => globalThis.getComputedStyle(sprite).animationName,
        ),
      }));

      /*
       * **This is the assertion the patch exists for.** Before the gate this
       * read `result`: the beats started on the frame the KO arrived and the
       * screen was swapped in the same microtask, so no frame of them was ever
       * painted.
       */
      expect(probe.screen, 'the stage left before the fight had finished playing').toBe('battle');
      // And something is actually moving on it, not merely marked.
      expect(probe.running).toContain('sprite-recall');
      /*
       * Nothing in the outro may leave the box its body stood in. The first cut
       * translated a recalled sprite toward the screen edge and would have
       * pushed `scrollWidth` past the viewport on a phone; `.stage` cannot clip
       * because the panels are its children and overhang it by design, so the
       * direction is carried by `transform-origin` instead. See the
       * `sprite-recall` note in `styles.css`.
       */
      expect(probe.scrollWidth, 'the outro overflowed the viewport').toBe(PHONE.width);
      /*
       * SMOKE24's first fight is a wild node, so the foe is taken by the ball
       * and the player's own lead is recalled. Asserted as a set rather than in
       * order: which actor is which is the stylesheet's business, and that the
       * two sides get *different* treatments is the fact worth holding.
       */
      expect(new Set(probe.kinds)).toEqual(new Set(['caught', 'recall']));

      // And the hold ends. A gate that never opened would be a worse bug than
      // the one it fixed.
      await page.waitForTimeout(DEFAULT_DISPLAY_TUNING.battleFeedbackMs + 300);
      const after = await page.evaluate(() =>
        globalThis.document.querySelector('.screen:not([hidden])')?.getAttribute('data-screen'),
      );
      expect(after, 'the outro held the run past its own duration').not.toBe('battle');

      await context.close();
      return;
    }

    await context.close();
    throw new Error('never reached the end of a fight');
  }, 300_000);
});
