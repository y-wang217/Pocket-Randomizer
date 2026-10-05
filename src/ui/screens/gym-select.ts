/**
 * Gym type select: Fire, Psychic or Flying, one pick, the defender run's first
 * decision. **Defender Mode v0, bible Rev 25, D100 and D101.**
 *
 * The locale screen's grammar: the instruction, then one card per option. A
 * card is the type chip and the badge's mark, zero words (D101's budget). What
 * the badge does changes the pick, so it is the mark's press (C2, R5), from
 * `data/defenderCopy.ts` through the `badge:` tip kind, never a line at rest.
 *
 * The cards stand in the table's order (`DEFENDER_GYM_TYPES`), never sorted,
 * and nothing marks one (C1).
 */
import { GLYPH_LABELS } from '../../data/glyphLabels';
import { glyphNode } from '../theme/glyph';
import { DEFENDER_SCREEN_COPY } from '../copy/defender';
import { el } from '../dom';
import { typeChip } from '../chip';

/** The badge mark each gym type's card carries. */
export const BADGE_GLYPHS: Readonly<Record<string, string>> = {
  Fire: 'badge-flame',
  Psychic: 'badge-eye',
  Flying: 'badge-wing',
};

export interface GymSelect {
  root: HTMLElement;
  render(options: readonly string[], onPick: (index: number) => void): void;
}

export function createGymSelect(): GymSelect {
  const root = el('section', 'screen screen--gym-select');
  const heading = el('h2', 'screen__title');
  heading.textContent = DEFENDER_SCREEN_COPY.gymSelect;
  const grid = el('div', 'gym-types');
  root.append(heading, grid);

  return {
    root,
    render(options, onPick) {
      let committed = false;
      grid.replaceChildren(
        ...options.map((type, index) =>
          renderCard(type, () => {
            if (committed) return;
            committed = true;
            onPick(index);
          }),
        ),
      );
    },
  };
}

function renderCard(type: string, onPick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `gym-type gym-type--${type.toLowerCase()}`;
  card.dataset['type'] = type;
  card.setAttribute('aria-label', type);

  const chips = el('span', 'gym-type__chips');
  chips.append(typeChip(type, { tip: `type:${type}` }));
  const key = BADGE_GLYPHS[type];
  const mark = key ? glyphNode(key, { label: GLYPH_LABELS[key] ?? '' }) : null;
  if (mark) {
    const holder = el('span', 'gym-type__badge');
    mark.dataset['tip'] = `badge:${type}`;
    holder.append(mark);
    chips.append(holder);
  }
  card.append(chips);
  card.addEventListener('click', onPick);
  return card;
}
