/**
 * The density mode, projected onto `<html>` so the stylesheet can apply it.
 *
 * **Density modes patch, on 4.7.2 ruling 4's mechanism.** The same shape as
 * `theme/locale.ts` next door and for the same reason: one attribute, written
 * from one place in the shell, read only by CSS. Nothing under `core/` knows it
 * exists.
 *
 * ## Why an attribute rather than a redraw
 *
 * Screens are mounted once and toggled, and each is drawn by a `render(...)`
 * call whose arguments are captured at the point it is shown. A shell-level
 * redraw would need every screen to hand it a thunk — a per-screen
 * registration, which a future screen can forget.
 *
 * An attribute on the root has no such seam. **Components render the whole
 * readout, always; the mode decides what is shown.** A screen drawn before the
 * mode changed, after it, or during it is correct because the attribute is on
 * an ancestor of everything — the router's screens, the drawer, the tooltip
 * layer. There is nothing to register and nothing to forget, and an open
 * surface takes the new mode without being rebuilt, so a drawer keeps its
 * scroll position and a stat bar keeps its transition. That is also what makes
 * Part 6's "applies immediately, with no reload and no loss of run state" true
 * by construction rather than by care.
 *
 * ## The three scales ride along
 *
 * `data/densityTuning.ts` holds how much chrome each mode spends, as three
 * unitless multipliers. They are written here as custom properties beside the
 * attribute — the same bridge `theme/motion.ts` uses for the one feedback
 * duration — so the stylesheet reads `calc(var(--space-3) * var(--density-gap))`
 * and never a second constant. `tokens.css` declares the three at 1, which is
 * Detailed, for a document that never ran this code.
 *
 * ## One writer, three values
 *
 * `Density` is a union in `ui/settings.ts`; this writes whatever it is given.
 * Nothing in this file names `detailed`, `simple` or `pocket`: a mode is a
 * member of that union, a row of the table, and the CSS rules that describe
 * it. There is no `if` chain here that would have to grow a branch.
 */
import { DENSITY_SCALES } from '../../data/densityTuning';
import type { Density } from '../settings';

export const DENSITY_ATTRIBUTE = 'data-density';

/** Write the mode and its three scales onto a root element. */
export function applyDensity(mode: Density, root: HTMLElement = document.documentElement): void {
  root.setAttribute(DENSITY_ATTRIBUTE, mode);
  const scale = DENSITY_SCALES[mode];
  root.style.setProperty('--density-pad', String(scale.pad));
  root.style.setProperty('--density-gap', String(scale.gap));
  root.style.setProperty('--density-title', String(scale.title));
}

/** What the root currently says, or null before the shell has started. */
export function currentDensity(root: HTMLElement = document.documentElement): string | null {
  return root.getAttribute(DENSITY_ATTRIBUTE);
}
