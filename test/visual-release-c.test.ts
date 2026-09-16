/**
 * Release C in a real browser: the timing token, and reduced motion.
 *
 * ## Why these two are not jsdom tests
 *
 * `test/battle-feedback.test.ts` covers everything about Release C that is a
 * question about the DOM — which elements exist, which attributes they carry,
 * which words they print — and jsdom answers those perfectly well.
 *
 * These two are different in kind. `--motion-duration` is only interesting
 * *resolved*: the assertion is that a number in `data/tuning.ts` reaches a
 * computed `animation-duration` on the HP shadow through a chain of `calc`,
 * and jsdom has no cascade to resolve it through. Reduced motion is a media
 * query, and a media query with nothing evaluating it is a comment. Both need
 * Chromium, so both are here, on the same harness the V-stage tests use.
 *
 * The reduced-motion pair is the one that matters most, because it is the
 * rule most easily satisfied by accident and most easily broken by accident:
 * **every animation resolves instantly and every flag still displays.** A
 * change that hid the flag strip under reduced motion would look like
 * respecting the setting and would be removing information from the player who
 * asked for less movement, not less to read.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, stepOnce, visible, skipTutorialIn } from '../scripts/visual/browser.mjs';
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

/**
 * Play one turn that the battle **survives**, and stop with it on screen.
 *
 * The insisting is the whole helper, and the first cut did not do it. On
 * SMOKE24 the opening fight is over in a turn, so "reach a battle, click a
 * move, look" lands on the result screen — and because screens are hidden
 * with `[hidden]` rather than unmounted, the battle's markup is still in the
 * document with its last shadow mid-fade. Every assertion below would have
 * been reading a screen the player is no longer on: the reduced-motion checks
 * would have passed on stale DOM and the input check failed on buttons that
 * are correctly dead because the fight is over.
 *
 * So: step until a battle, take a turn, and if that ended it, carry on to the
 * next fight and try again. The wait is half `battleFeedbackMs`, which puts
 * every reading inside the window the shadow is still fading.
 *
 * **"Still on the battle screen" is not enough on its own**, which cost the
 * second debugging pass. `playUntil` returns the instant the screen becomes
 * `battle`, which is before the run has asked for a choice — so `stepOnce`
 * finds no enabled move, clicks nothing, and the helper returns happily on a
 * freshly-entered fight where no turn has resolved and every marker is
 * correctly absent.
 *
 * The witness is therefore the **log**, which grows by an entry or more on
 * every resolved turn and knows nothing about Release C. Waiting on the flag
 * strip or the nudge instead would be waiting on the thing under test.
 *
 * **And the log is not enough either, since the outro gate.** "Still on the
 * battle screen after half a budget" used to mean the fight survived, because
 * a fight that ended swapped to the result screen on the same microtask. It
 * now means nothing on its own: the battle animation run holds the stage for
 * `--motion-outro` precisely so the last turn is seen, so a *finished* fight is
 * still on screen — with a grown log — for the whole of that hold. This helper
 * read that as a surviving turn and every assertion below then ran against a
 * fight that was over: no second lunge, and move buttons correctly dead.
 *
 * So the third condition is that the run has **asked for another choice**: an
 * enabled move button. A fight that is over has none, whether the result screen
 * has arrived yet or not, which is the property that outlives the gate.
 */
async function playATurn(page: Awaited<ReturnType<typeof openApp>>['page']): Promise<void> {
  const entries = async (): Promise<number> => page.locator('.log-entry').count();

  for (let attempt = 0; attempt < 16; attempt++) {
    await playUntil(page, (screen) => screen === 'battle');
    const before = await entries();
    await stepOnce(page);
    await page.waitForTimeout(DEFAULT_DISPLAY_TUNING.battleFeedbackMs / 2);

    const screen = await page.evaluate(() =>
      globalThis.document.querySelector('.screen:not([hidden])')?.getAttribute('data-screen'),
    );
    const asking = await page.locator('.screen--battle .move:not(:disabled)').count();
    if (screen === 'battle' && (await entries()) > before && asking > 0) return;
    /*
     * If that turn ended the fight, the stage is mid-outro and the result
     * screen has not arrived yet. Wait the rest of the hold out before looping,
     * or `playUntil` races the gate and clicks into a screen that is still
     * changing.
     */
    await page.waitForTimeout(DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
  }
  throw new Error('never found a turn that resolved and left the battle on screen');
}

describe('the one tuning number reaches the screen', () => {
  it('resolves --motion-duration and both lengths derived from it', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'S49R-2');
    const resolved = await page.evaluate(() => {
      const style = globalThis.getComputedStyle(globalThis.document.documentElement);
      return {
        duration: style.getPropertyValue('--motion-duration').trim(),
        shadow: style.getPropertyValue('--motion-hp-shadow').trim(),
        beat: style.getPropertyValue('--motion-beat').trim(),
        outro: style.getPropertyValue('--motion-outro').trim(),
      };
    });

    // The number `ui/theme/motion.ts` wrote at startup, straight off
    // `data/tuning.ts`. One number, and this is it arriving.
    expect(resolved.duration).toBe(`${DEFAULT_DISPLAY_TUNING.battleFeedbackMs}ms`);
    expect(resolved.shadow).toBe(`${DEFAULT_DISPLAY_TUNING.battleFeedbackMs}ms`);
    /*
     * And the outro's hold. **The battle animation run.**
     *
     * `scene.ts` reads this property to decide how long to park the result
     * screen, so it resolving is the difference between a fight that ends on
     * screen and one that is swallowed by the swap. Derived like the others,
     * so the budget is still one number — a literal here would be the second
     * constant the token exists to prevent.
     */
    expect(resolved.outro).toBe(`${DEFAULT_DISPLAY_TUNING.battleFeedbackMs}ms`);

    await playATurn(page);
    const applied = await page.evaluate(() => {
      const shadow = globalThis.document.querySelector('.panel--foe .hp__shadow');
      const first = globalThis.document.querySelector('.stage__actor[data-acted="1"]');
      const second = globalThis.document.querySelector('.stage__actor[data-acted="2"]');
      const hits = [...globalThis.document.querySelectorAll('.stage__actor[data-hit]')].map((actor) => {
        const sprite = actor.querySelector('.sprite:not(.sprite--ghost)');
        const style = sprite ? globalThis.getComputedStyle(sprite) : null;
        return { slot: (actor as HTMLElement).dataset['hit'], duration: style?.animationDuration, delay: style?.animationDelay };
      });
      const timing = (node: Element | null): { duration: string; delay: string } | null =>
        node ? { duration: globalThis.getComputedStyle(node).animationDuration, delay: globalThis.getComputedStyle(node).animationDelay } : null;
      return { shadow: shadow ? globalThis.getComputedStyle(shadow).animationDuration : null, first: timing(first), second: timing(second), hits };
    });

    // The shadow spends the whole budget; the four beats run inside it, one
    // quarter each, in their slots. That is what makes "one number" true
    // rather than aspirational.
    const ms = DEFAULT_DISPLAY_TUNING.battleFeedbackMs;
    const beat = `${ms / 4000}s`;
    expect(applied.shadow).toBe(`${ms / 1000}s`);
    expect(applied.first).toEqual({ duration: beat, delay: '0s' });
    expect(applied.second).toEqual({ duration: beat, delay: `${ms / 2000}s` });
    // A turn where both sides used a move lands at least one hit, and every
    // hit sits in the slot after the lunge that took it.
    expect(applied.hits.length).toBeGreaterThan(0);
    for (const hit of applied.hits) {
      expect(hit.duration).toBe(beat);
      expect(hit.delay).toBe(hit.slot === '1' ? beat : `${(ms * 3) / 4000}s`);
    }
    await context.close();
  }, 300_000);
});

describe('reduced motion', () => {
  it('resolves every animation instantly and still prints every flag', async () => {
    const reduced = await harness.browser.newContext({ viewport: PHONE, reducedMotion: 'reduce' });
    await skipTutorialIn(reduced);
    const page = await reduced.newPage();
    await page.goto(`${harness.url}/#seed=S49R-2`, { waitUntil: 'load' });
    await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });
    await playATurn(page);

    const state = await page.evaluate(() => {
      const shadow = globalThis.document.querySelector('.panel--foe .hp__shadow');
      const actors = [...globalThis.document.querySelectorAll('.stage__actor')];
      const sprites = [...globalThis.document.querySelectorAll('.stage__actor .sprite')];
      const strip = globalThis.document.querySelector('.flags');
      return {
        shadowAnimation: shadow ? globalThis.getComputedStyle(shadow).animationName : null,
        // The resting state the animation would have reached anyway, so
        // "instant" is the same outcome and not a different one.
        shadowOpacity: shadow ? globalThis.getComputedStyle(shadow).opacity : null,
        // The lunge is on the actor and the hit on the sprite inside it; both
        // are read, so neither can slip past a check on the other.
        stageAnimations: [...actors, ...sprites].map((node) => globalThis.getComputedStyle(node).animationName),
        nudged: actors.filter((actor) => (actor as HTMLElement).dataset['acted']).length,
        hit: actors.filter((actor) => (actor as HTMLElement).dataset['hit']).length,
        flags: strip ? [...strip.querySelectorAll('.chip')].map((chip) => chip.textContent ?? '') : null,
        stripDisplay: strip ? globalThis.getComputedStyle(strip).display : null,
      };
    });

    expect(state.shadowAnimation).toBe('none');
    expect(state.shadowOpacity).toBe('0');
    for (const name of state.stageAnimations) expect(name).toBe('none');

    /*
     * The half that is easy to get wrong. The actors are still *marked* as
     * having acted and been hit — the scene does the same work either way —
     * and the strip still prints its words. Reduced motion removes the
     * movement, not the information.
     */
    expect(state.nudged, 'the sides that acted are still marked').toBeGreaterThan(0);
    expect(state.hit, 'the side that was hit is still marked').toBeGreaterThan(0);
    expect(state.stripDisplay).not.toBe('none');
    expect(state.flags, 'the strip rendered').not.toBeNull();
    expect((state.flags ?? []).length, 'a resolved turn produced at least one flag').toBeGreaterThan(0);

    await reduced.close();
  }, 300_000);

  it('leaves the move buttons live while the feedback is still on screen', async () => {
    /*
     * "No animation blocks input", measured **inside** the feedback window
     * rather than after it.
     *
     * The first cut read the buttons immediately after submitting a choice and
     * found them all disabled, which was correct and was measuring the wrong
     * thing: the engine is resolving at that instant and the buttons are meant
     * to be dead. The question Release C's rule actually asks is whether they
     * come back *before* the feedback finishes — so this waits 250ms, half the
     * shadow's 500ms, and asserts the shadow is still fading while the buttons
     * are already live.
     */
    const { page, context } = await openApp(harness.browser, harness.url, 'S49R-2');
    await playATurn(page);

    const live = await page.evaluate(() => {
      const buttons = [...globalThis.document.querySelectorAll('.moves .move:not([disabled])')];
      const fading = [...globalThis.document.querySelectorAll('.hp__shadow[data-fading]')];
      return {
        enabled: buttons.length,
        // A button covered by an overlay or made inert would fail here; a
        // button merely animating would not, which is the point.
        pointerEvents: buttons.map((button) => globalThis.getComputedStyle(button).pointerEvents),
        stillFading: fading.length,
      };
    });

    expect(live.stillFading, 'the feedback is still on screen at the halfway mark').toBeGreaterThan(0);
    expect(live.enabled, 'and the buttons are already live').toBeGreaterThan(0);
    for (const value of live.pointerEvents) expect(value).not.toBe('none');
    await context.close();
  }, 300_000);
});
