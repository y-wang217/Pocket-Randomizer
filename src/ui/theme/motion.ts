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
 * ## Reduced motion is not handled here
 *
 * It is handled in the stylesheet, by `@media (prefers-reduced-motion: reduce)`
 * turning the animations off at their resting state. Writing `0ms` here instead
 * would work today and would be the wrong mechanism: the media query re-answers
 * itself when the OS setting changes mid-session, and a value written once at
 * startup does not. The token is the duration; the query is the override.
 */
import { DEFAULT_DISPLAY_TUNING } from '../../data/displayTuning';
import { BATTLE_SPEED_SCALE, type BattleSpeed } from '../settings';

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
}
