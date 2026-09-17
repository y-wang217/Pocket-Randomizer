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
import type { BrowserContext, Page } from 'playwright';
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
  /** Animations the engine created for this element, by keyframe name. */
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
**The sampling is deterministic, and getting there took three tries.** Each
 * wrong turn is kept written down, because they are the ones an animation test
 * is prone to and this project has now paid for all three.
 *
 * The first version sampled at two fixed offsets and closed its listener at
 * 220ms. Four of the twelve beats below carry an `animation-delay` — the hit's
 * second slot starts at `--motion-beat * 3`, 562ms at the shipped budget — so
 * it was asking whether an animation had started *before it was due to*, and it
 * called the hit dead on WebKit on a 200ms event against a 220ms deadline.
 *
 * The second read the window off the element but still sampled it at two
 * instants. WebKit begins an attribute-triggered animation about a frame later
 * than Chromium does, so a sample near the start of a 187ms window can land
 * before the engine has begun, read the 0% keyframe, and report a working
 * animation as static. It called the lunge dead while the lunge was reaching
 * 5.95px of its 6px peak.
 *
 * The third polled densely across the window, which was right in principle and
 * still lost races: under a full 26-file suite the polling loop starves, and a
 * 187ms window can pass with one sample taken in it.
 *
 * So it does not race at all. It asks the element for its `Animation` objects,
 * **pauses them and seeks** to chosen points inside the active window, and
 * reads the computed style at each. That is the same interpolated value the
 * engine would have painted, obtained without depending on when anything is
 * scheduled — no flake under load, no sensitivity to start latency, and it
 * still fails hard on what it is for: an animation that exists and moves
 * nothing.
 *
 * `docs/generation.md` records the general form: **a test that waits a fixed
 * fraction of a motion budget and then reads the screen is making an assumption
 * about what the budget is for.**
 */
async function observe(
  page: Page,
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

      /*
       * `none` and the identity matrix are the same rendering and different
       * strings. Comparing the strings counted the switch from `transform: none`
       * at rest to `matrix(1, 0, 0, 1, 0, 0)` at the 0% keyframe as *motion* —
       * which is how a static animation once passed as a moving one.
       */
      const IDENTITY = 'matrix(1, 0, 0, 1, 0, 0)';
      const shape = (t: string): string => (t === 'none' ? IDENTITY : t);

      const rest = style();
      (host as HTMLElement).setAttribute(attribute as string, value as string);

      /*
       * The engine's own view of what it is about to run. Asked for immediately
       * and with no waiting: `getAnimations()` reports the animations the
       * cascade has produced for this element, so a rule that did not apply —
       * or a declaration the engine dropped whole — shows up as an empty list
       * rather than as an event that never arrives.
       */
      const running = watched.getAnimations();
      const started = running.map((animation) => (animation as CSSAnimation).animationName ?? '');

      const samples: { at: number; transform: string; opacity: string }[] = [];
      let moved = false;
      for (const animation of running) {
        const timing = animation.effect?.getComputedTiming();
        const duration = typeof timing?.duration === 'number' ? timing.duration : 0;
        const delay = timing?.delay ?? 0;
        if (duration <= 0) continue;
        animation.pause();
        // Across the whole active window: a keyframe can put its peak anywhere
        // in it, and `ball-catch` holds its end state while `actor-lunge` peaks
        // at 40% and returns to rest.
        for (const fraction of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) {
          animation.currentTime = delay + duration * fraction;
          const now = style();
          if (shape(now.transform) !== shape(rest.transform) || now.opacity !== rest.opacity) {
            moved = true;
            if (samples.length < 6) samples.push({ at: Math.round(duration * fraction), ...now });
          }
        }
        animation.cancel();
      }
      if (!samples.length) samples.push({ at: 0, ...style() });

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
  let page: Page;
  let context: BrowserContext;

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
   * `getAnimations()` says the engine *created* an animation. This says it
   * **ran** one, start to finish, on its own clock with nothing seeking it.
   *
   * The two questions are genuinely different and only the pair covers the
   * ground: a paused-and-seeked animation would still report interpolated
   * values on an engine that never scheduled it, and an `animationstart` alone
   * says nothing about whether anything moved. The lunge is the case used here
   * because it carries no `animation-delay` in slot 1, so the window is the
   * whole of `--motion-beat` and the wait below is bounded by the tuning rather
   * than by a guess.
   */
  it('runs a beat to completion on its own clock, start and end', async () => {
    const budget = DEFAULT_DISPLAY_TUNING.battleFeedbackMs;
    const seen = await page.evaluate(async (beat) => {
      const actor = document.querySelector('.stage__actor--me');
      if (!actor) throw new Error('no player actor on the stage');
      const events: string[] = [];
      const record = (event: Event): void => {
        events.push(`${event.type}:${(event as AnimationEvent).animationName}`);
      };
      for (const type of ['animationstart', 'animationend']) actor.addEventListener(type, record);
      actor.setAttribute('data-acted', '1');
      // A whole feedback budget is four beats; one beat cannot outlast it.
      await new Promise((resolve) => setTimeout(resolve, beat as number));
      for (const type of ['animationstart', 'animationend']) actor.removeEventListener(type, record);
      actor.removeAttribute('data-acted');
      return events;
    }, budget);

    expect(seen, `the lunge did not start on ${engine}`).toContain('animationstart:actor-lunge');
    expect(seen, `the lunge started but never finished on ${engine}`).toContain('animationend:actor-lunge');
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

/**
 * The turn's beats in the order the turn resolved. **The victory-order patch,
 * item 2.**
 *
 * ## The report
 *
 * "Animations are not tied to speed right now, are they? I just saw a Snubbull
 * go before my Sizzlipede and the animation for my attack went first."
 *
 * ## What was already covered, and what was not
 *
 * The *markers* are covered and were correct. `ui/scene.beats` places a side by
 * its first action in the turn the protocol reported, and
 * `test/battle-feedback.test.ts` drives a real Snorlax/Jolteon fight through the
 * real adapter and asserts both directions: the priority move gets slot 1 and,
 * on the turn where Speed decides, the fast side does. Nothing there is a
 * stylesheet reading its own intentions back — it is the sim's protocol.
 *
 * What nothing asserted anywhere is that **slot 2 is later than slot 1 on the
 * screen**. `[data-acted="2"]` is one `animation-delay` declaration, sitting at
 * the same specificity as the rule it overrides and winning only on source
 * order; the twelve beats above all trigger slot 1; and every other motion test
 * in the repo reads a single element in isolation. A build where that one
 * declaration was dropped, overridden, or resolved to `0s` would show both
 * bodies lunging on the same frame — and two simultaneous lunges is exactly
 * what "the animation for my attack went first" looks like, because a player
 * watching their own side sees their own body move at the same instant the
 * other one does and reads the pair as their own turn.
 *
 * ## How it is asserted
 *
 * The same pause-and-seek `observe` uses, applied to both actors at once and
 * read at two points on a shared timeline. It is a statement about the
 * *relative* schedule rather than about either animation alone, which is the
 * thing the report is about and the thing no per-element test can see.
 */
describe(`the two lunges are ordered on ${engine}`, () => {
  let page: Page;
  let context: BrowserContext;

  beforeAll(async () => {
    const opened = await openApp(harness.browser, harness.url, 'SMOKE24', PHONE);
    page = opened.page;
    context = opened.context;
    await playUntil(page, (screen) => screen === 'battle');
    await page.waitForTimeout(1200);
  }, 180_000);

  afterAll(async () => {
    await context?.close();
  });

  /**
   * Both actors marked as one turn, sampled at a shared offset from the turn's
   * start. Returns whether each is displaced from its resting transform.
   *
   * `first` and `second` are the slots, not the sides: the caller decides which
   * body went first, which is what makes the two cases below mirror images.
   */
  async function atOffset(
    first: 'me' | 'foe',
    fractionOfBeat: number,
  ): Promise<{ first: boolean; second: boolean; beat: number }> {
    return page.evaluate(
      async ([firstSide, fraction]) => {
        const second = (firstSide as string) === 'me' ? 'foe' : 'me';
        const of = (side: string): HTMLElement => {
          const actor = document.querySelector(`.stage__actor--${side}`);
          if (!(actor instanceof HTMLElement)) throw new Error(`no ${side} actor`);
          return actor;
        };
        const IDENTITY = 'matrix(1, 0, 0, 1, 0, 0)';
        const shape = (t: string): string => (t === 'none' ? IDENTITY : t);
        const transformOf = (el: HTMLElement): string => shape(getComputedStyle(el).transform);

        const actors = { first: of(firstSide as string), second: of(second) };

        // Settle any attribute a previous case left mid-recalc before reading a
        // resting transform off these elements. See the note in the slot-2 delay
        // case below: style resolves on a frame, and `getAnimations()` answers
        // about what has already resolved.
        for (const actor of [actors.first, actors.second]) actor.removeAttribute('data-acted');
        void getComputedStyle(actors.first).animationName;
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

        const rest = { first: transformOf(actors.first), second: transformOf(actors.second) };

        // The turn, exactly as `beats()` writes it: the side that acted first
        // in slot 1, the other in slot 2.
        actors.first.setAttribute('data-acted', '1');
        actors.second.setAttribute('data-acted', '2');

        /*
         * The beat, read off the engine rather than recomputed here. It is the
         * *duration* of the lunge, which is `--motion-beat`, and taking it from
         * the animation means this test cannot disagree with the tuning about
         * what a beat is.
         */
        void getComputedStyle(actors.first).animationName;
        const lunge = (el: HTMLElement): Animation | undefined =>
          el.getAnimations().find((a) => (a as CSSAnimation).animationName === 'actor-lunge');
        const one = lunge(actors.first);
        const two = lunge(actors.second);
        if (!one || !two) throw new Error('one of the two lunges was never created');

        const timingOf = (a: Animation): { duration: number; delay: number } => {
          const t = a.effect?.getComputedTiming();
          return {
            duration: typeof t?.duration === 'number' ? t.duration : 0,
            delay: t?.delay ?? 0,
          };
        };
        const beat = timingOf(one).duration;

        /*
         * One shared clock. Each animation's `currentTime` is measured from its
         * own start *including* its delay, so seeking both to the same absolute
         * offset reads the frame the engine would paint at that moment of the
         * turn. An animation still inside its delay has no fill mode here, so
         * it reads as its resting transform — which is the whole assertion.
         */
        const at = beat * (fraction as number);
        const displaced: { first: boolean; second: boolean } = { first: false, second: false };
        for (const [key, animation] of [['first', one], ['second', two]] as const) {
          animation.pause();
          animation.currentTime = at;
          displaced[key] = transformOf(actors[key]) !== rest[key];
        }
        for (const animation of [one, two]) animation.cancel();

        actors.first.removeAttribute('data-acted');
        actors.second.removeAttribute('data-acted');
        return { ...displaced, beat };
      },
      [first, fractionOfBeat] as const,
    );
  }

  /*
   * Both directions, because the defect the report describes is direction-
   * specific: a player only notices when the side that moved first on screen
   * was not the side that acted first in the fight, and they are only ever
   * watching one of the two.
   */
  for (const first of ['foe', 'me'] as const) {
    const second = first === 'foe' ? 'me' : 'foe';

    it(`holds the ${second} body still while the ${first} body lunges`, async () => {
      // 0.4 of a beat is the peak of `actor-lunge`'s keyframe. The second
      // actor's window has not opened: its delay is two whole beats.
      const seen = await atOffset(first, 0.4);
      expect(seen.beat, 'the lunge has no duration at all').toBeGreaterThan(0);
      expect(seen.first, `the ${first} body did not lunge in its own slot on ${engine}`).toBe(true);
      expect(
        seen.second,
        `the ${second} body lunged in the ${first} body's slot on ${engine} — the two are simultaneous, which is the reported defect`,
      ).toBe(false);
    });

    it(`lunges the ${second} body two beats later, in its own slot`, async () => {
      // 2.4 beats in: slot 2's window is open and at the same 40% peak.
      const seen = await atOffset(first, 2.4);
      expect(seen.second, `the ${second} body never lunged at all on ${engine}`).toBe(true);
    });
  }

  it('gives slot 2 exactly the two-beat delay the four-slot budget is built from', async () => {
    /*
     * The declaration itself, read off the engine. The two cases above would
     * also pass if the delay were any number larger than a beat, and the
     * stylesheet's four-slot layout — first actor, its target, second actor,
     * its target, each `--motion-beat` long — depends on it being exactly two.
     * A drift here is a turn whose beats no longer land inside one feedback
     * budget, which is the thing `battleFeedbackMs` is the single source of.
     */
    const timing = await page.evaluate(async () => {
      const actor = document.querySelector('.stage__actor--me');
      if (!(actor instanceof HTMLElement)) throw new Error('no player actor');
      /*
       * **Settle first, then set.** This is the fourth timing trap this file
       * has paid for and it is a different one from the three in `observe`'s
       * note.
       *
       * `getAnimations()` reports what style has already been resolved into,
       * and the cascade runs on a frame. A previous case in this suite removes
       * `data-acted` at the end of its own `evaluate`; if this one sets it again
       * before that removal has been recalculated, the engine sees no net change
       * to the computed style and creates nothing — and the case reports "slot
       * 2 has no lunge" on a build whose slot 2 works perfectly. It failed
       * exactly that way, intermittently, before this was written.
       *
       * So the attribute is cleared, a frame is allowed to pass, and only then
       * is it set. A computed read after that is the flush that makes
       * `getAnimations()` answer about the rule we just applied.
       */
      actor.removeAttribute('data-acted');
      void getComputedStyle(actor).animationName;
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      actor.setAttribute('data-acted', '2');
      void getComputedStyle(actor).animationName;
      const animation = actor
        .getAnimations()
        .find((a) => (a as CSSAnimation).animationName === 'actor-lunge');
      const computed = animation?.effect?.getComputedTiming();
      const out = {
        duration: typeof computed?.duration === 'number' ? computed.duration : 0,
        delay: computed?.delay ?? 0,
      };
      actor.removeAttribute('data-acted');
      return out;
    });

    expect(timing.duration, `slot 2 has no lunge on ${engine}`).toBeGreaterThan(0);
    expect(timing.delay / timing.duration).toBeCloseTo(2, 5);
  });

  /**
   * The chunk a bar draws, held through its slot and faded after it.
   *
   * This is the half of the report the lunges were not: both bars used to
   * resolve on the frame the update arrived, whoever had acted, so a turn's
   * damage appeared before the turn's movement did. The fix is an
   * `animation-delay` and an `animation-fill-mode`, and the fill mode is the
   * part that a plausible tidy-up would drop — without a backwards fill the
   * shadow sits at its base rule's `opacity: 0` through the delay, and the
   * chunk is simply invisible for the part of the turn it is waiting out.
   * Observed here rather than read off the rule, for the reason at the top of
   * this file.
   */
  it.each([['1', 1, 3], ['2', 3, 1]] as const)(
    'holds a slot %s chunk at full strength through its delay, then fades it',
    async (slot, delayInBeats, durationInBeats) => {
      const seen = await page.evaluate((which) => {
        const shadow = document.querySelector('.panel--foe .hp__shadow');
        if (!(shadow instanceof HTMLElement)) throw new Error('no foe shadow on the stage');

        // A chunk to look at. `ui/bar.ts` writes these three the same way.
        shadow.style.left = '40%';
        shadow.style.width = '20%';
        delete shadow.dataset['fading'];
        delete shadow.dataset['slot'];
        shadow.dataset['slot'] = which as string;
        void shadow.offsetWidth;
        shadow.dataset['fading'] = 'true';

        void getComputedStyle(shadow).animationName;
        const animation = shadow
          .getAnimations()
          .find((a) => (a as CSSAnimation).animationName === 'hp-chunk');
        const computed = animation?.effect?.getComputedTiming();
        const duration = typeof computed?.duration === 'number' ? computed.duration : 0;
        const delay = computed?.delay ?? 0;

        const opacityAt = (at: number): number => {
          if (!animation) return -1;
          animation.pause();
          animation.currentTime = at;
          return Number(getComputedStyle(shadow).opacity);
        };

        const out = {
          duration,
          delay,
          // Mid-delay: the chunk is at full strength, waiting for its slot.
          held: opacityAt(delay / 2),
          // Just inside its own window: still essentially full.
          opening: opacityAt(delay + duration * 0.02),
          // At the end: gone.
          ended: opacityAt(delay + duration),
        };

        animation?.cancel();
        delete shadow.dataset['fading'];
        delete shadow.dataset['slot'];
        shadow.style.width = '0%';
        return out;
      }, slot);

      expect(seen.duration, `slot ${slot} has no chunk animation on ${engine}`).toBeGreaterThan(0);

      /*
       * Delay plus duration is four beats on both slots, which is exactly
       * `--motion-duration`. The fade still ends where the last lunge does, so
       * a turn's whole feedback is still the one number — what moved is where
       * inside that window the chunk resolves.
       */
      const beat = (seen.delay + seen.duration) / 4;
      expect(seen.delay / beat, `slot ${slot} delay on ${engine}`).toBeCloseTo(delayInBeats, 4);
      expect(seen.duration / beat, `slot ${slot} duration on ${engine}`).toBeCloseTo(durationInBeats, 4);

      expect(
        seen.held,
        `a slot ${slot} chunk was invisible during its delay on ${engine} — the backwards fill is missing`,
      ).toBeCloseTo(1, 2);
      expect(seen.opening).toBeGreaterThan(0.5);
      expect(seen.ended, `a slot ${slot} chunk never faded on ${engine}`).toBeCloseTo(0, 2);
    },
  );
});
