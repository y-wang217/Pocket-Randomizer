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
import { el } from '../scene';

export interface StarterSelect {
  root: HTMLElement;
  render(options: readonly PokemonSpec[], onPick: (index: number) => void): void;
}

export function createStarterSelect(): StarterSelect {
  const root = el('section', 'screen screen--starter');
  const heading = el('h2', 'screen__title');
  heading.textContent = 'Choose your starter';
  const blurb = el('p', 'screen__blurb');
  blurb.textContent =
    'One Pokemon carries the whole run, through eight gyms. Species, ability and ' +
    'moves are all randomized. HP and PP persist between fights; a cleared gym ' +
    'restores both.';
  const grid = el('div', 'starters');

  root.append(heading, blurb, grid);

  return {
    root,
    render(options, onPick) {
      grid.replaceChildren(...options.map((spec, index) => renderCard(spec, () => onPick(index))));
    },
  };
}

function renderCard(spec: PokemonSpec, onPick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'starter';

  const header = el('div', 'starter__header');
  const name = el('span', 'starter__name');
  const level = el('span', 'starter__level');
  const types = el('span', 'panel__types');
  header.append(name, level, types);

  const meta = el('div', 'starter__meta');
  const moves = el('ul', 'starter__moves');

  const detail = describeSpecCard(spec);
  name.textContent = detail.species;
  level.textContent = `Lv${detail.level}`;
  types.replaceChildren(...detail.types.map(typeChip));
  meta.textContent = `${detail.ability} · ${detail.maxHp} HP`;

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

  card.append(header, meta, moves);
  card.addEventListener('click', onPick);
  return card;
}

export function typeChip(type: string): HTMLElement {
  const chip = el('span', `type type--${type.toLowerCase()}`);
  chip.textContent = type;
  return chip;
}
