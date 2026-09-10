/**
 * The archetype chip: one builder, six surfaces.
 *
 * Stage 4.7, Part 7. Both battle panels, the drawer, the party screen, the
 * recipient screen, the capture card and starter select all carry the label,
 * and a chip hand-rolled per screen is six places for the tooltip trigger, the
 * aria role or the display form to drift.
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
