/**
 * The one place a battle-feedback duration crosses from `data/` into CSS.
 *
 * V0 wrote `--motion-duration` into `tokens.css` at `0ms` and named the stage
 * that would fill it in: "when Release C adds the per-turn number, `ui/` writes
 * it here at startup and nothing reads a second constant." This is that write.
 *
 * ## Why a token and not a style each animation sets
 *
 * Because "total added time per turn is one number" only stays true if there
 * is one number. Every battle-feedback length in `styles.css` is derived from
 * `--motion-duration` with `calc` — the HP chunk's shadow spends all of it, the
 * two turn order nudges take a quarter each and run inside the same window —
 * so setting the root property sets the feel of a turn, whole. A component that
 * wrote its own duration would be a second constant, and the next one would be
 * a third.
 *
 * ## Why it is not a delay, with one exception
 *
 * Nothing mid-fight waits for this. The bar, the HP text, the flag words and
 * the move buttons are all correct and interactive on the frame the update
 * arrives, and a tap resolves every animation early. The number says how long
 * the feedback *stays*, not how long the player is held.
 *
 * **The exception is the end of a battle, and it is exactly one seam.** Until
 * the battle animation run this file said "nothing waits for this" flatly, and
 * that was the reason a fight ending in one hit showed no animation at all: the
 * last turn's beats started on the frame the KO arrived and `app.ts` swapped to
 * the result screen on the same microtask, so not one frame of them was ever
 * shown. `reviewBattle` now holds the screen until the beats have played. Every
 * other transition is unchanged and still non-blocking, and the hold is still
 * skippable by tapping. `docs/generation.md` records the superseded rule.
 *
 * ## The speed is a scale, not a second number
 *
 * `ui/settings.ts` lets a player pick a battle speed, and it multiplies the
 * shipped duration rather than replacing it. That keeps "one place the feel of
 * a turn is set" true: a settings value in milliseconds would be a second
 * constant, and the next one would be a third.
 *
 * ## Reduced motion: the movement is the stylesheet's, the hold is this file's
 *
 * **The movement** is still handled entirely in the stylesheet, by
 * `@media (prefers-reduced-motion: reduce)` cancelling each animation at its
 * own resting state. That is the right mechanism and it is unchanged: the media
 * query re-answers itself when the OS setting changes mid-session, and a class
 * written once at startup would not.
 *
 * **The hold is different, and the iOS animations patch moved it here.** Until
 * that patch the stylesheet also set `--motion-outro: 0ms` under the query and
 * `scene.ts` read the token back to decide how long to park — so Reduce Motion
 * did not shorten the hold, it deleted it, and a player with that setting on
 * got the swallowed last turn the whole outro exists to fix. Reduced motion
 * removes the movement, not the outcome, and at the end of a fight the pacing
 * *is* the outcome.
 *
 * So the query is asked here, in JavaScript, **at the moment of use** rather
 * than at startup — `outroHoldMs()` calls `matchMedia` on every fight, so it
 * re-answers itself exactly as the stylesheet's own query does. The property
 * the old design was protecting is kept; what changes is which of the two
 * numbers the query picks between, and that neither of them is zero.
 *
 * ## Nothing reads a duration back out of CSS
 *
 * **This is the direction the iOS animations patch reversed, and it is the
 * whole of Bug A.** `scene.ts` used to call
 * `getComputedStyle(root).getPropertyValue('--motion-outro')` and parse the
 * result to find out how long to hold. The number it was asking for had been
 * written into that property by this file, in this process, from
 * `data/displayTuning.ts` — so the round trip's *best* case was to recover a
 * number JavaScript already had, and its worst case was an engine that
 * serialized the property in a form the parser did not accept, in which case
 * the parse failed and the function returned **zero**: no hold, silently, and
 * indistinguishable from the bug the hold was added to fix.
 *
 * A value must travel in one direction only. `data/displayTuning.ts` is the
 * source, this file publishes it into CSS, and CSS reads it. Nothing reads it
 * back. `test/no-computed-timing.test.ts` holds that structurally, over the
 * whole of `src/`, so the next timing number cannot re-enter through a
 * different door.
 */
import { DEFAULT_DISPLAY_TUNING } from '../../data/displayTuning';
import { BATTLE_SPEED_SCALE, getBattleSpeed, type BattleSpeed } from '../settings';

/**
 * Whether the player has asked the OS for less motion.
 *
 * Asked at the moment of use, never cached. A player who turns Reduce Motion on
 * mid-session gets the answer on their next fight, which is the property the
 * "reduced motion lives in the stylesheet" rule was written to protect.
 *
 * Defaults to `false` where `matchMedia` does not exist. That is the safe
 * direction here and it is worth saying why, because the old code's equivalent
 * fallback was the bug: "no" means the **full** hold, so an environment that
 * cannot answer the question gets more of the last turn rather than none of it.
 */
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * How long the end of a fight is held, in milliseconds. **Never zero.**
 *
 * The one source for the hold `ui/scene.ts` parks on. Reads the same tuning
 * numbers `applyMotion` publishes, so the token on the root and the timer in
 * the scene cannot disagree — they are the same arithmetic on the same inputs
 * rather than one of them reading the other.
 *
 * **The floor is the point.** Every return path is at least
 * `reducedMotionOutroMs`, including the one where a caller hands in a zero or a
 * nonsense budget, because zero means "swap the screen on the frame the KO
 * lands" and that is the defect this whole seam exists to close. A hold that is
 * too long is a complaint; a hold of zero is the bug back.
 */
export function outroHoldMs(
  speed: BattleSpeed = getBattleSpeed(),
  feedbackMs: number = DEFAULT_DISPLAY_TUNING.battleFeedbackMs,
  reduced: boolean = prefersReducedMotion(),
): number {
  const floor = DEFAULT_DISPLAY_TUNING.reducedMotionOutroMs;
  if (reduced) return floor;
  const full = feedbackMs * (BATTLE_SPEED_SCALE[speed] ?? 1);
  return Number.isFinite(full) && full > floor ? full : floor;
}

/**
 * Publish the tuning's feedback duration onto the document root.
 *
 * Takes the number rather than reading `DEFAULT_DISPLAY_TUNING` itself so a test
 * — or the battle speed setting in `ui/settings.ts` — can set it without
 * reaching into `data/`.
 */
export function applyMotion(
  root: HTMLElement,
  speed: BattleSpeed = 'even',
  feedbackMs: number = DEFAULT_DISPLAY_TUNING.battleFeedbackMs,
): void {
  // Clamped at zero: a negative duration is not an animation played backwards,
  // it is an invalid CSS value that would silently drop the whole declaration
  // and leave the shadow on screen forever.
  root.style.setProperty('--motion-duration', `${Math.max(0, feedbackMs * BATTLE_SPEED_SCALE[speed])}ms`);
  /*
   * And the outro's own length, published rather than derived in CSS. **The
   * iOS animations patch.**
   *
   * `tokens.css` used to say `--motion-outro: var(--motion-duration)` and the
   * reduced-motion block used to overwrite it with `0ms` — which made the
   * stylesheet the authority on a number JavaScript then read back out of it.
   * Now the arithmetic happens once, here, and the token is the *result*.
   *
   * The token still exists because the stylesheet genuinely needs it: four
   * rules time the recall, the ball and the player's half-budget offset off it.
   * What it no longer is, is an input.
   */
  root.style.setProperty('--motion-outro', `${outroHoldMs(speed, feedbackMs)}ms`);
}
