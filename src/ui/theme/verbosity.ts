/**
 * The verbosity mode, projected onto `<html>` so the stylesheet can apply it.
 *
 * **Patch 4.7.2, ruling 4.** The same shape as `theme/locale.ts` next door and
 * for the same reason: one attribute, written from one place in the shell, read
 * only by CSS. Nothing under `core/` knows it exists.
 *
 * ## Why an attribute rather than a redraw
 *
 * The ruling asks for "one subscription that re-renders the active screen" and
 * forbids "per-screen subscriptions a future screen can forget". Those two pull
 * against each other in this shell: screens are mounted once and toggled, and
 * each is drawn by a `render(...)` call whose arguments are captured at the
 * point it is shown. A shell-level redraw therefore needs every screen to hand
 * it a thunk — which is a per-screen registration, and a future screen can
 * forget it exactly as the ruling says.
 *
 * An attribute on the root has no such seam. **Components render the whole
 * readout, always; the mode decides what is shown.** A screen drawn before the
 * toggle, after it, or during it is correct because the attribute is on an
 * ancestor of everything — the router's screens, the drawer, the tooltip layer.
 * There is nothing to register and nothing to forget, and an open surface takes
 * the new mode without being rebuilt, so a drawer keeps its scroll position and
 * a stat bar keeps its transition.
 *
 * The flag is still one flag: `ui/settings.ts` owns it, this writes it down
 * once, and the stylesheet is the only reader. That is fewer readers than the
 * `showsNumbers()` call sites it replaces, not more.
 *
 * ## The seam for a third mode
 *
 * `Verbosity` is a union in `ui/settings.ts`; this writes whatever it is given.
 * A third mode is a member of that union plus the CSS rules that describe it —
 * no second mechanism, and no `if` chain here that would have to grow a branch.
 * Nothing in this file names `simple` or `detailed`.
 */
import type { Verbosity } from '../settings';

export const VERBOSITY_ATTRIBUTE = 'data-verbosity';

/** Write the mode onto a root element. */
export function applyVerbosity(mode: Verbosity, root: HTMLElement = document.documentElement): void {
  root.setAttribute(VERBOSITY_ATTRIBUTE, mode);
}

/** What the root currently says, or null before the shell has started. */
export function currentVerbosity(root: HTMLElement = document.documentElement): string | null {
  return root.getAttribute(VERBOSITY_ATTRIBUTE);
}
