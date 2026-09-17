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
import type { PokemonSpec, StatName } from '../../core/types';
import { el } from '../scene';
import { setProse } from '../dom';
import { STARTER_COPY } from '../copy/screens';
import { abilityChip, monTypeChip, typeChip as chip } from '../chip';
import { archetypeChip } from '../archetype-chip';
import { spriteFigure } from '../sprites';

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
  level.textContent = `Lv${detail.level}`;
  // The chip is back in the slot that was always reserved for it. Chip-audit
  // patch, question 1. The note on `const archetype` above still says why the
  // first screen of a run is the one the vocabulary has to be learnable on;
  // 4.8.0.3 emptied the span and left that argument standing over an empty
  // element, which is how the span survived the removal to be refilled here.
  archetype.replaceChildren(archetypeChip(detail.baseStats));
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

  // The body, in the card's corner. Idle-sprites patch: the header comment
  // below on `statLine` already assumed a pick screen shows a sprite.
  card.append(spriteFigure(detail.species, { phase: index }), header, meta, statLine(detail.baseStatsAtLevel, detail.maxHp), moves);
  card.addEventListener('click', onPick);
  return card;
}

/**
 * The five boostable stats plus HP, as one compact row. **Item F, part 4.**
 *
 * A pick screen that shows a sprite, a name and a moveset is asking the player
 * to choose between three bodies whose *bulk and speed are invisible* — and
 * speed in particular decides most turns, which is the whole argument
 * `core/battle/view.ts` makes for the battle screen's speed readout. Without
 * it a starter pick is a coin flip, and the spec says this game should not have
 * those.
 *
 * Numbers with no verdict: no total, no rating, no "best in class" marker, and
 * no ordering that implies one. Showdown's order, the same order the battle
 * panel uses, so the number a player learns here is in the place they will look
 * for it during a fight.
 *
 * Exported because the species reward card needs exactly the same row — a
 * Pokemon offered mid-run is the same decision as a starter, and two renderings
 * of one thing is how they drift.
 */
export function statLine(stats: Record<StatName, number>, maxHp: number): HTMLElement {
  const row = el('ul', 'statline');
  row.dataset['tutorial'] = 'stats';

  const entries: [string, number][] = [
    ['HP', maxHp],
    ['Atk', stats.atk],
    ['Def', stats.def],
    ['SpA', stats.spa],
    ['SpD', stats.spd],
    ['Spe', stats.spe],
  ];

  row.replaceChildren(
    ...entries.map(([label, value]) => {
      const cell = el('li', 'statline__stat');
      const name = el('span', 'statline__label');
      name.textContent = label;
      // The same tooltip the battle panel raises, so "what is SpA" has one
      // answer in one place. Text lives in data/statInfo.ts. The value rides
      // on the trigger so the tooltip can say it where the row is bars
      // (Pocket): the number is one tap away, never gone.
      name.dataset['tip'] = `stat:${label.toLowerCase()}`;
      name.dataset['value'] = String(value);
      const number = el('span', 'statline__value');
      number.textContent = String(value);
      /*
       * The bar, rendered in every mode and shown in Pocket. **Density modes
       * patch, Part 4.** The same ceiling the member card's bars use, so the
       * two readouts of one stat agree. All six move together: the row is
       * numbers or the row is bars, never a mix.
       *
       * The labels here stay abbreviations in Detailed, unlike the member
       * card's, because six full names do not fit a card at 390 wide — the
       * same reason Item F chose them. Recorded in the patch report.
       */
      const bar = el('span', 'statline__bar');
      const fill = el('span', 'statline__bar-fill');
      fill.style.width = `${Math.min(100, (value / STATLINE_CEILING) * 100)}%`;
      bar.append(fill);
      cell.append(name, number, bar);
      return cell;
    }),
  );
  return row;
}

/** The same ceiling `ui/member-card.ts` draws its bars against. */
const STATLINE_CEILING = 200;

export function typeChip(type: string): HTMLElement {
  return chip(type);
}
