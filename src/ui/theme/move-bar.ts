/**
 * The move bar layout, projected onto `<html>` so the stylesheet can apply it.
 *
 * **The four-column patch**, on the same mechanism as `theme/density.ts` next
 * door and for the same reasons — one attribute, written from one place in the
 * shell, read only by CSS, and nothing under `core/` knows it exists.
 *
 * The argument for an attribute over a redraw is the one density already
 * makes: screens are mounted once and toggled, and each is drawn by a
 * `render(...)` whose arguments were captured when it was shown. An attribute
 * on an ancestor of everything needs no per-screen registration, so a battle
 * already on screen takes the new layout without being rebuilt and without the
 * turn being interrupted. That is what makes flipping the layout *mid-fight*
 * safe, which is the whole point of shipping both: the report asked to compare
 * them, and comparing means switching with the same four moves on screen.
 *
 * `MoveBar` is a union in `ui/settings.ts`; this writes whatever it is given
 * and names neither value, so a third layout would be a row of CSS rather than
 * a branch here.
 */
import type { MoveBar } from '../settings';

export const MOVE_BAR_ATTRIBUTE = 'data-move-bar';

/** Write the layout onto a root element. */
export function applyMoveBar(layout: MoveBar, root: HTMLElement = document.documentElement): void {
  root.setAttribute(MOVE_BAR_ATTRIBUTE, layout);
}

/** What the root currently says, or null before the shell has started. */
export function currentMoveBar(root: HTMLElement = document.documentElement): string | null {
  return root.getAttribute(MOVE_BAR_ATTRIBUTE);
}
