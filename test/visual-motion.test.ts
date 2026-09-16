/**
 * The battle motion system, observed rather than inspected. **The iOS
 * animations patch, items 1 and 3.**
 *
 * ## Why this file exists
 *
 * Every motion assertion in the repo before this patch asked whether an
 * animation was *wired*: is the class on the element, does `animation-duration`
 * compute to the token, is `animationName` the name we expect. All of them pass
 * on an engine where nothing moves, because all of them are reading the
 * stylesheet's intentions back out of the stylesheet. That is how a defect in
 * the switch-out survived from V5.5 to here, and it is the coverage hole the
 * patch was written to close — the bugs were not in the wiring.
 *
 * So every case here asserts **motion that was observed**: an `animationstart`
 * event that actually fired, and a computed `transform` or `opacity` sampled
 * mid-flight that differs from the value the element rests at. A stylesheet
 * that declared every animation correctly and ran none of them fails all of it.
 *
 * ## Why the beats are triggered by attribute rather than by playing a fight
 *
 * `ui/scene.ts` drives all nine of these by setting one attribute, and which
 * attribute it sets on which turn is asserted at length elsewhere —
 * `test/battle-outro.test.ts` and `test/battle-feedback.test.ts` in jsdom,
 * `test/visual-battle-outro.test.ts` and `test/visual-v5.test.ts` in a browser.
 * Duplicating that here would pay the cost of reaching a flinch, a switch and a
 * capture in one seeded run to re-answer a question already answered.
 *
 * What none of those can answer is the one this file is for: **given the
 * attribute, does the engine move the pixels.** That is a property of the
 * stylesheet and the engine, and it is exactly where the iOS defect lived. The
 * stage is a real one in a real built app, so the CSS under test is the CSS
 * that ships.
 *
 * ## Both engines
 *
 * This file is engine-agnostic and runs under whichever `GYMRUN_ENGINE`
 * selects; `npm run check` runs Chromium and then WebKit, and both gate. On
 * WebKit the context is Playwright's iPhone 14 Pro Max descriptor, so touch,
 * the Mobile Safari user agent and 3x device pixel ratio are all in play — the
 * three properties a 390px desktop window was missing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contextFor, openApp, playUntil, PHONE, visible } from '../scripts/visual/browser.mjs';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { engine, openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

interface Observed {
  /** Animations the engine actually started, by keyframe name. */
  started: string[];
  /** Whether a sampled transform or opacity differed from the resting value. */
  moved: boolean;
  /** What was sampled, for a failure message worth reading. */
  samples: { at: number; transform: string; opacity: string }[];
  rest: { transform: string; opacity: string };
}

/**
 * Set an attribute on the live stage and watch what the engine does about it.
 *
 * Samples at two points inside the window rather than one, because a single
 * sample cannot distinguish "moving" from "displaced and static" — and a
 * keyframe whose `var()` failed to resolve produces exactly the latter on an
 * engine that will not interpolate an unregistered custom property, which is
 * the first of the five causes this patch had to rule out.
 *
 * **The window is read off the element, and sampled across rather than at.**
 * Two earlier versions of this helper each produced a wrong answer about WebKit
 * before it sampled this way, and both mistakes are worth keeping written down
 * because they are the ones an animation test is prone to.
 *
 * The first sampled at two fixed offsets and closed its listener at 220ms. Four
 * of the twelve beats below carry an `animation-delay` — the hit's second slot
 * starts at `--motion-beat * 3`, 562ms at the shipped budget — so it was asking
 * whether an animation had started *before it was due to*, and it called the
 * hit dead on WebKit on a 200ms event against a 220ms deadline. That is a coin
 * toss, not a finding.
 *
 * The second read the window off the element but still sampled it at two
 * instants, 25% and 66% in. **WebKit begins an attribute-triggered animation
 * roughly a frame later than Chromium does**, so a sample taken near the start
 * of a 187ms window can land before the engine has begun, read the 0% keyframe,
 * and report a working animation as static. It called the lunge dead on WebKit
 * while the lunge was in fact reaching 5.95px of its 6px peak.
 *
 * So it polls: every frame or so across the whole declared window, keeping the
 * largest deviation from rest. That is insensitive to start latency, to frame
 * scheduling and to where in the curve a keyframe puts its peak, and it still
 * fails hard on the thing it is for — an animation that runs and moves nothing.
 *
 * `docs/generation.md` records the general form, because this project has now
 * paid for it three times: **a test that waits a fixed fraction of a motion
 * budget and then reads the screen is making an assumption about what the
 * budget is for.**
 */
async function observe(
  page: import('playwright').Page,
  selector: string,
  apply: { on: string; attribute: string; value: string },
): Promise<Observed> {
  return page.evaluate(
    async ([sel, target, attribute, value]) => {
      const watched = document.querySelector(sel as string);
      const host = document.querySelector(target as string);
      if (!watched || !host) throw new Error(`no element for ${sel as string} / ${target as string}`);

      const style = (): { transform: string; opacity: string } => {
        const cs = getComputedStyle(watched);
        return { transform: cs.transform, opacity: cs.opacity };
      };

      const started: string[] = [];
      const listener = (event: Event): void => {
        started.push((event as AnimationEvent).animationName);
      };
      document.addEventListener('animationstart', listener, true);

      const rest = style();
      (host as HTMLElement).setAttribute(attribute as string, value as string);

      // The window the engine says it is going to use, in ms. Read after the
      // attribute is set, because the attribute is what selects the rule.
      const seconds = (raw: string): number => {
        const first = raw.split(',')[0]?.trim() ?? '0s';
        return first.endsWith('ms') ? Number.parseFloat(first) : Number.parseFloat(first) * 1000;
      };
      const live = getComputedStyle(watched);
      const delay = Math.max(0, seconds(live.animationDelay));
      const duration = Math.max(1, seconds(live.animationDuration));

      /*
       * `none` and the identity matrix are the same rendering and different
       * strings. Comparing the strings counted the switch from `transform: none`
       * at rest to `matrix(1, 0, 0, 1, 0, 0)` at the 0% keyframe as *motion* —
       * which is how a static animation passed as a moving one.
       */
      const IDENTITY = 'matrix(1, 0, 0, 1, 0, 0)';
      const shape = (t: string): string => (t === 'none' ? IDENTITY : t);

      const samples: { at: number; transform: string; opacity: string }[] = [];
      const start = performance.now();
      const ends = delay + duration;
      let moved = false;
      for (;;) {
        const at = performance.now() - start;
        if (at > ends + 40) break;
        if (at >= delay - 20) {
          const now = style();
          if (shape(now.transform) !== shape(rest.transform) || now.opacity !== rest.opacity) {
            moved = true;
            if (samples.length < 6) samples.push({ at: Math.round(at), ...now });
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      if (!samples.length) samples.push({ at: Math.round(ends), ...style() });

      // Past the end, so a start event is never missed by closing early.
      await new Promise((resolve) => setTimeout(resolve, 40));
      document.removeEventListener('animationstart', listener, true);
      (host as HTMLElement).removeAttribute(attribute as string);

      return { started, moved, samples, rest };
    },
    [selector, apply.on, apply.attribute, apply.value],
  );
}

/**
 * Every animated class on the battle stage, with the attribute that starts it.
 *
 * `keyframes` is asserted against the names the engine reports having started,
 * so a rule whose whole declaration was dropped — the fifth candidate cause,
 * where one unrecognised token takes the rest of the rule with it — reports as
 * a missing start rather than as a silent no-op.
 */
const BEATS = [
  { label: 'the lunge', keyframes: 'actor-lunge', on: '.stage__actor--me', watch: '.stage__actor--me', attribute: 'data-acted', value: '1' },
  { label: 'the hit', keyframes: 'sprite-hit', on: '.stage__actor--foe', watch: '.stage__actor--foe .sprite:not(.sprite--ghost)', attribute: 'data-hit', value: '1' },
  { label: 'the faint', keyframes: 'sprite-sink', on: '.stage__actor--foe', watch: '.stage__actor--foe .sprite:not(.sprite--ghost)', attribute: 'data-fainting', value: 'true' },
  { label: 'the switch-out, broken since V5.5', keyframes: 'sprite-sink', on: '.stage__actor--me', watch: '.stage__actor--me .sprite--ghost', attribute: 'data-swapped', value: 'true' },
  { label: 'the switch-in', keyframes: 'sprite-rise', on: '.stage__actor--me', watch: '.stage__actor--me .sprite:not(.sprite--ghost)', attribute: 'data-swapped', value: 'true' },
  { label: 'the recall', keyframes: 'sprite-recall', on: '.stage__actor--foe', watch: '.stage__actor--foe .sprite:not(.sprite--ghost)', attribute: 'data-outro', value: 'recall' },
  { label: 'the capture', keyframes: 'ball-catch', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__ball', attribute: 'data-outro', value: 'caught' },
  { label: 'a prevented abnormality', keyframes: 'mark-halt', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__mark', attribute: 'data-abnormal', value: 'prevented' },
  { label: 'a stage abnormality', keyframes: 'mark-shift', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__mark', attribute: 'data-abnormal', value: 'stage' },
  { label: 'a trait abnormality', keyframes: 'mark-pulse', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__mark', attribute: 'data-abnormal', value: 'trait' },
  { label: 'a volatile abnormality', keyframes: 'mark-settle', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__mark', attribute: 'data-abnormal', value: 'volatile' },
  { label: 'a field abnormality', keyframes: 'mark-sweep', on: '.stage__actor--foe', watch: '.stage__actor--foe .stage__mark', attribute: 'data-abnormal', value: 'field' },
] as const;

describe(`the stage actually moves on ${engine}`, () => {
  let page: import('playwright').Page;
  let context: import('playwright').BrowserContext;

  beforeAll(async () => {
    const opened = await openApp(harness.browser, harness.url, 'SMOKE24', PHONE);
    page = opened.page;
    context = opened.context;
    await playUntil(page, (screen) => screen === 'battle');
    // The swap beat of the first send-in settles well inside this, so no case
    // below is reading the tail of an animation it did not start.
    await page.waitForTimeout(1200);
  }, 180_000);

  afterAll(async () => {
    await context?.close();
  });

  it('is on a real phone context, with touch and the density the bug was reported at', async () => {
    const shape = await page.evaluate(() => ({
      touch: 'ontouchstart' in globalThis.window || navigator.maxTouchPoints > 0,
      dpr: globalThis.devicePixelRatio,
      webkit: /Safari/.test(navigator.userAgent) && !/Chrome|Chromium/.test(navigator.userAgent),
    }));
    if (engine === 'webkit') {
      // The three properties a 390px desktop Chromium window did not have, and
      // which the report's device does.
      expect(shape.touch, 'the WebKit leg is not running the device descriptor').toBe(true);
      expect(shape.dpr).toBe(3);
      expect(shape.webkit).toBe(true);
    } else {
      expect(shape.dpr).toBe(1);
    }
  });

  it.each(BEATS.map((beat) => [beat.label, beat] as const))('moves for %s', async (_label, beat) => {
    const seen = await observe(page, beat.watch, { on: beat.on, attribute: beat.attribute, value: beat.value });

    expect(seen.started, `${beat.keyframes} never started on ${engine}`).toContain(beat.keyframes);
    expect(
      seen.moved,
      `${beat.keyframes} started on ${engine} but nothing moved — resting ${JSON.stringify(seen.rest)}, sampled ${JSON.stringify(seen.samples)}`,
    ).toBe(true);
  });

  /*
   * The first of the five candidate causes, asserted directly rather than
   * inferred from the beats above.
   *
   * Four of the stage's keyframes interpolate a `var()`: `actor-lunge` reads
   * `--lunge-distance` and `--beat-direction`, `sprite-hit` reads
   * `--hit-recoil`, and both sink and rise read `--sprite-swap-travel`. An
   * engine that will not interpolate an unregistered custom property inside a
   * keyframe resolves the whole keyframe to a static value, with no error and
   * no failing declaration — the animation "runs" and the element does not
   * move. That is indistinguishable from a working animation to every
   * pre-patch test in this repo, and it is why this one samples twice.
   */
  it('interpolates the custom properties its keyframes are built out of', async () => {
    const seen = await observe(page, '.stage__actor--me', {
      on: '.stage__actor--me',
      attribute: 'data-acted',
      value: '1',
    });
    const offsets = seen.samples.map((sample) => {
      const match = /matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)/.exec(sample.transform);
      return match ? Math.abs(Number(match[1])) + Math.abs(Number(match[2])) : 0;
    });
    expect(seen.started, 'the lunge never started at all').toContain('actor-lunge');
    expect(
      Math.max(...offsets),
      `the lunge resolved to a static transform on ${engine}: ${JSON.stringify(seen.samples)}`,
    ).toBeGreaterThan(0);
  });

  /*
   * The panels sit directly over the sprites these beats move, and the scrim
   * that makes their text readable is translucent by design. An engine with no
   * `backdrop-filter` under either spelling must get an opaque panel instead,
   * or the HP numbers are read against a lunging Pokemon.
   */
  it('backs the panels with something, whichever spelling the engine has', async () => {
    const panel = await page.evaluate(() => {
      const found = document.querySelector('.stage .panel');
      if (!found) throw new Error('no floating panel on the stage');
      const cs = getComputedStyle(found);
      return {
        supported: CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)'),
        filter: `${cs.backdropFilter ?? ''}${cs.getPropertyValue('-webkit-backdrop-filter')}`,
        background: cs.backgroundColor,
      };
    });

    if (panel.supported) expect(panel.filter, 'the panel declared a backdrop and got none').toMatch(/blur/);
    // Either way the panel has a ground. `transparent` here would be the
    // unreadable case: translucent scrim, no blur, moving sprites behind it.
    expect(panel.background).not.toBe('rgba(0, 0, 0, 0)');
  });
});

describe(`reduced motion keeps the outcome on ${engine}`, () => {
  /*
   * Item 5. Under Reduce Motion the movement goes and the *outcome* stays: the
   * hold shortens to a tuning number rather than to zero, so the last turn of
   * the fight is still painted before the result screen arrives.
   *
   * Emulated through Playwright's `reducedMotion`, which sets the real media
   * feature, so what is under test is the stylesheet's own query and the
   * `matchMedia` call in `ui/theme/motion.ts` answering the same question.
   */
  it('publishes a hold that is short, and is not zero', async () => {
    const context = await harness.browser.newContext({
      ...contextFor(PHONE, engine),
      reducedMotion: 'reduce',
    });
    await context.addInitScript(
      (settings) => {
        try {
          globalThis.localStorage.setItem('gymrun.settings', settings as string);
        } catch {
          // Storage unavailable: defaults, and the coach marks show.
        }
      },
      JSON.stringify({ density: 'detailed', tutorial: { skipped: true, seen: [] } }),
    );
    const page = await context.newPage();
    await page.goto(`${harness.url}/#seed=SMOKE24`, { waitUntil: 'load' });
    await page.waitForSelector(`${visible('starter')} .starter`, { timeout: 20_000 });

    const held = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--motion-outro').trim(),
    );

    /*
     * **This is the assertion the patch exists for, at this end.** The token
     * used to read `0ms` here, because the reduced-motion block set it and
     * `scene.ts` read it back — so a player with Reduce Motion on got no hold,
     * which is the swallowed-last-turn defect the outro was built to fix. It
     * is now the reduced tuning number, published by `ui/theme/motion.ts`.
     */
    expect(held).not.toBe('0ms');
    expect(Number.parseFloat(held)).toBe(DEFAULT_DISPLAY_TUNING.reducedMotionOutroMs);

    await playUntil(page, (screen) => screen === 'battle');

    // And the movement really is gone, which is the half that was already
    // right: every beat resolves at its own end state.
    const running = await page.evaluate(async () => {
      const actor = document.querySelector('.stage__actor--me');
      if (!actor) throw new Error('no actor');
      const started: string[] = [];
      document.addEventListener('animationstart', (e) => started.push((e as AnimationEvent).animationName), true);
      actor.setAttribute('data-acted', '1');
      await new Promise((resolve) => setTimeout(resolve, 200));
      return started;
    });
    expect(running, 'reduced motion is supposed to remove the movement').toEqual([]);

    // Nothing is blocking input while it does so: the move buttons are live.
    const live = await page.locator(`${visible('battle')} .move:not(:disabled)`).count();
    expect(live, 'reduced motion left no enabled move button').toBeGreaterThan(0);

    await context.close();
  }, 180_000);
});
