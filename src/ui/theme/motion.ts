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
 * ## Why it is not a delay
 *
 * Nothing waits for this. The bar, the HP text, the flag words and the move
 * buttons are all correct and interactive on the frame the update arrives, and
 * a tap resolves every animation early. The number says how long the feedback
 * *stays*, not how long the player is held.
 *
 * ## Reduced motion is not handled here
 *
 * It is handled in the stylesheet, by `@media (prefers-reduced-motion: reduce)`
 * turning the animations off at their resting state. Writing `0ms` here instead
 * would work today and would be the wrong mechanism: the media query re-answers
 * itself when the OS setting changes mid-session, and a value written once at
 * startup does not. The token is the duration; the query is the override.
 */
import { DEFAULT_TUNING } from '../../data/tuning';

/**
 * Publish the tuning's feedback duration onto the document root.
 *
 * Takes the number rather than reading `DEFAULT_TUNING` itself so a test — or a
 * future settings screen — can set it without reaching into `data/`.
 */
export function applyMotion(root: HTMLElement, feedbackMs: number = DEFAULT_TUNING.battleFeedbackMs): void {
  // Clamped at zero: a negative duration is not an animation played backwards,
  // it is an invalid CSS value that would silently drop the whole declaration
  // and leave the shadow on screen forever.
  root.style.setProperty('--motion-duration', `${Math.max(0, feedbackMs)}ms`);
}
