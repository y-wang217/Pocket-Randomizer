/**
 * The archetype chip: one builder, every surface that draws a Pokemon.
 *
 * Stage 4.7, Part 7. **The roster is no longer listed here**, and that is the
 * chip-audit patch's doing rather than laziness: it was listed, the list went
 * stale twice — once when Patch 4.8.0.3 took the chip off six surfaces and once
 * when this patch put it back — and a list of call sites in a module comment is
 * a claim about the call graph that nothing checks. The rule is the thing worth
 * writing down, and the rule is that a surface drawing a Pokemon draws this.
 *
 * A chip hand-rolled per screen is one place per screen for the tooltip
 * trigger, the aria role or the display form to drift, and
 * `screens/locale-select.ts` was that drift for three patches — its own
 * `badge badge--archetype`, with `.badge`'s metrics and none of `.chip`'s
 * recipe. `test/chip.test.ts` scans for it now.
 *
 * **Its own module rather than a function on the member card**, because
 * `screens/starter-select.ts` needs it and `ui/member-card.ts` needs *that*
 * file's `typeChip` — the two importing each other is a cycle that ESM tolerates
 * and a reader does not.
 *
 * The battle panels are the one surface that cannot call this: `scene.ts` may
 * import only the projection and four vocabulary modules
 * (`test/boundaries.test.ts`), and `core/archetype` is neither. The label
 * reaches them on the projection instead — same words, same table, different
 * delivery.
 */
import { archetypeOf } from '../core/archetype';
import type { StatsTable } from '../core/types';
import { ARCHETYPE_DISPLAY } from '../data/archetypes';
import { neutralChip } from './chip';

export function archetypeChip(baseStats: StatsTable): HTMLElement {
  // Through the one chip component (V2): a neutral label, like every label
  // that is not a type.
  const chip = neutralChip(ARCHETYPE_DISPLAY[archetypeOf(baseStats)].short, 'archetype');
  // Every chip raises the same panel: what a player taps a label for is what
  // the *set* is, and one label in isolation says nothing about whether there
  // is a sixth or a sixtieth. `ui/tooltips.ts` renders all six plus the caveat.
  chip.dataset['tip'] = 'archetype:all';
  chip.tabIndex = 0;
  chip.setAttribute('role', 'button');
  return chip;
}
