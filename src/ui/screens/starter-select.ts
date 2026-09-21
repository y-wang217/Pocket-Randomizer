/**
 * Starter select: three randomized Pokemon, one pick, no take-backs.
 *
 * The screen shows everything the choice actually turns on — types, ability,
 * max HP, and all four moves with type, category, base power and PP — because
 * the player carries this Pokemon through the *whole run* and a choice made
 * from three names is not a choice.
 *
 * That matters more in Stage 2 than it did in Stage 1. These three are no longer
 * curated Pokemon with curated kits: the species comes from a band window, and
 * the ability and every move are rolled. The ability in particular is not
 * flavour — it is half of what the Pokemon is, it was not chosen by anyone, and
 * it is the line on this card a player will read first.
 *
 * All of it comes from `describeSpecCard`, so this file never sees the sim.
 */
import { describeSpecCard } from '../../core/battle/driver';
import type { PokemonSpec } from '../../core/types';
import { el, levelAria, levelText } from '../scene';
import { setProse } from '../dom';
import { STARTER_COPY } from '../copy/screens';
import { abilityChip, monTypeChip, typeChip as chip } from '../chip';
import { spriteFigure } from '../sprites';
import { statBlock } from '../stat-block';

export interface StarterSelect {
  root: HTMLElement;
  render(options: readonly PokemonSpec[], onPick: (index: number) => void): void;
}

export function createStarterSelect(): StarterSelect {
  const root = el('section', 'screen screen--starter');
  const heading = el('h2', 'screen__title');
  heading.textContent = 'Choose your starter';
  const blurb = el('p', 'screen__blurb');
  setProse(blurb, STARTER_COPY.blurb);
  const grid = el('div', 'starters');
  grid.dataset['tutorial'] = 'starters';

  root.append(heading, blurb, grid);

  return {
    root,
    render(options, onPick) {
      grid.replaceChildren(...options.map((spec, index) => renderCard(spec, index, () => onPick(index))));
    },
  };
}

function renderCard(spec: PokemonSpec, index: number, onPick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'starter';

  const header = el('div', 'starter__header');
  const name = el('span', 'starter__name');
  const level = el('span', 'starter__level');
  const types = el('span', 'panel__types');
  types.dataset['tutorial'] = 'types';
  // The archetype chip on the first screen of the run, which is where the
  // vocabulary is worth learning: the player is comparing three stat blocks
  // and this is the one word that says what each is shaped for.
  const archetype = el('span', 'starter__archetype');
  header.append(name, level, archetype, types);

  const meta = el('div', 'starter__meta');
  const moves = el('ul', 'starter__moves');
  moves.dataset['tutorial'] = 'moves';

  const detail = describeSpecCard(spec);
  name.textContent = detail.species;
  level.textContent = levelText(detail.level);
  level.setAttribute('aria-label', levelAria(detail.level));
  /*
   * **The slot stays empty. M3.2.**
   *
   * Section 3 does not render the archetype label where the stat bars draw
   * it, and this card carries the block. The chip-audit patch refilled this
   * span on the argument that the first screen of a run is where the
   * vocabulary has to be learnable; M3.2 answers that by taking the label off
   * every surface that draws the bars, so there is nothing to learn here. What
   * it summarised is the six bars directly below, and section 7 already calls
   * this screen the classroom for those.
   */
  archetype.replaceChildren();
  types.replaceChildren(...detail.types.map(monTypeChip));
  /*
   * The ability is a chip rather than half of a concatenated string.
   *
   * `${detail.ability} · ${detail.maxHp} HP` put the one fact on this card
   * that has an explanation behind it into a run of text with no trigger in
   * it — so on the screen where a player has the least context to judge an
   * ability by, it was the only surface that offered no way to look it up.
   */
  const hp = el('span', 'starter__hp');
  hp.textContent = `${detail.maxHp} HP`;
  meta.replaceChildren(abilityChip(detail.ability, detail.abilityId), hp);

  moves.replaceChildren(
    ...detail.moves.map((move) => {
      const row = el('li', 'starter__move');
      const label = el('span', 'starter__move-name');
      label.textContent = move.name;
      const stats = el('span', 'starter__move-stats');
      stats.append(typeChip(move.type));
      const power = el('span', 'move__power');
      power.textContent = move.category === 'Status' ? 'Status' : `${move.basePower} BP`;
      const pp = el('span', 'move__pp');
      pp.textContent = `${move.maxPp} PP`;
      stats.append(power, pp);
      row.append(label, stats);
      return row;
    }),
  );

  /*
   * The body, in the card's corner. Idle-sprites patch: a pick screen shows a
   * sprite, which is what the row below was laid out around.
   *
   * **The row is the shared stat block now. M3.2, D20.** `statLine` lived
   * here and was exported to two other screens, which made it the second of
   * three renderings of one attribute cluster — the defect section 5 closes
   * with. `layout: 'row'` is the six-across shape it drew; the coach mark's
   * anchor rides on this instance, which is the one it points at.
   */
  card.append(
    spriteFigure(detail.species, { phase: index }),
    header,
    meta,
    statBlock({ ...detail.baseStatsAtLevel, hp: detail.maxHp }, { layout: 'row', tutorial: 'stats' }),
    moves,
  );
  card.addEventListener('click', onPick);
  return card;
}


export function typeChip(type: string): HTMLElement {
  return chip(type);
}
