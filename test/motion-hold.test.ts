/**
 * The end-of-fight hold is never zero. **The iOS animations patch, Bug A.**
 *
 * @vitest-environment jsdom
 *
 * `outroHoldMs` is the one place the length of the hold is decided. Before this
 * patch there was no such place: `ui/scene.ts` asked the stylesheet, and every
 * way of failing to get an answer — an engine that spells the value
 * differently, a document whose custom properties do not resolve, a
 * reduced-motion rule that set the token to `0ms` — produced the same number,
 * zero, which is the original defect rather than a degraded version of the fix.
 *
 * So these cases are all one question asked from different directions: **is
 * there any input from which the hold comes out zero?** The answer has to be no
 * for absent, nonsense and hostile inputs alike, because the caller cannot tell
 * a zero hold from a broken one and neither can a player.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { outroHoldMs, prefersReducedMotion } from '../src/ui/theme/motion';
import { BATTLE_SPEEDS, BATTLE_SPEED_SCALE, resetSettings } from '../src/ui/settings';

const FLOOR = DEFAULT_DISPLAY_TUNING.reducedMotionOutroMs;

afterEach(() => {
  resetSettings();
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
});

/** Answer `prefers-reduced-motion` the way a browser would, or refuse to. */
function withMatchMedia(reduced: boolean | 'absent'): void {
  if (reduced === 'absent') {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    return;
  }
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
  });
}

describe('the hold cannot be zero', () => {
  it('is the full budget at the shipped settings', () => {
    withMatchMedia(false);
    expect(outroHoldMs()).toBe(DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
  });

  it('is the reduced number, not zero, when the player asked for less motion', () => {
    withMatchMedia(true);
    // The whole of item 5. Reduced motion removes the movement; the last turn
    // is still painted, so the outcome is not removed with it.
    expect(outroHoldMs()).toBe(FLOOR);
    expect(outroHoldMs()).toBeGreaterThan(0);
  });

  it('floors rather than zeroes on a budget of zero', () => {
    // The shape of the old bug: something upstream produced a zero and the
    // hold silently became "no hold". It cannot now.
    withMatchMedia(false);
    expect(outroHoldMs('even', 0)).toBe(FLOOR);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -750],
    ['a hair above zero', 0.0001],
  ])('floors rather than zeroes on a %s budget', (_label, budget) => {
    withMatchMedia(false);
    const held = outroHoldMs('even', budget);
    expect(held).toBeGreaterThanOrEqual(FLOOR);
    expect(Number.isFinite(held)).toBe(true);
  });

  it('floors on a battle speed that is not one of the three', () => {
    withMatchMedia(false);
    const held = outroHoldMs('nonsense' as never, DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
    expect(held).toBeGreaterThanOrEqual(FLOOR);
  });

  it('holds for every shipped battle speed, none of them zero', () => {
    withMatchMedia(false);
    for (const speed of BATTLE_SPEEDS) {
      expect(outroHoldMs(speed), speed).toBe(DEFAULT_DISPLAY_TUNING.battleFeedbackMs * BATTLE_SPEED_SCALE[speed]);
      expect(outroHoldMs(speed), speed).toBeGreaterThan(0);
    }
  });

  /*
   * The environment that cannot answer the question. The old code's equivalent
   * — a document whose custom properties do not resolve — returned zero, and a
   * test in this suite asserted that as correct. This is the same situation
   * with the safe answer: no `matchMedia` means "not reduced", which means the
   * *longer* hold, so an engine we have not met shows more of the last turn
   * rather than none of it.
   */
  it('assumes full motion where the media query cannot be asked', () => {
    withMatchMedia('absent');
    expect(prefersReducedMotion()).toBe(false);
    expect(outroHoldMs()).toBe(DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
  });

  it('re-answers the media query on every call rather than caching it', () => {
    // The property the "reduced motion lives in the stylesheet" rule was
    // written to protect: a player who changes the OS setting mid-session gets
    // the new answer on their next fight.
    withMatchMedia(false);
    expect(outroHoldMs()).toBe(DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
    withMatchMedia(true);
    expect(outroHoldMs()).toBe(FLOOR);
    withMatchMedia(false);
    expect(outroHoldMs()).toBe(DEFAULT_DISPLAY_TUNING.battleFeedbackMs);
  });

  it('keeps the reduced hold long enough to paint a frame', () => {
    // It has one job. 16.7ms is one frame at 60Hz; a number that could not
    // clear several of them would be a hold that misses the turn it exists to
    // show on a phone that drops one.
    expect(FLOOR).toBeGreaterThan(16.7 * 4);
  });
});
