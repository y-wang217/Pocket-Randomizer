/**
 * Locale select: two or three regions, one pick, before the segment begins.
 *
 * **The strictest application of the Part 4 editorial rule in the game so far.**
 * A card shows the region's name, its four types, and one line of flavour that
 * says where you are. That is the whole card.
 *
 * What is deliberately absent, and why each one is absent:
 *
 *   - **No difficulty rating.** A locale does not carry one. Tiers, levels and
 *     team sizes are identical whichever region is picked (`data/locales.ts`),
 *     so a "harder" badge would be the UI inventing a fact.
 *   - **No reward hint.** Same reason: the payouts behind a route are not a
 *     function of the locale either.
 *   - **No recommendation, no ordering, no "best for your party" marker.** The
 *     four types *are* the decision — the player reads them against the party
 *     they are carrying and against the gym they can see on the rail — and a
 *     screen that did that reading for them would replace the decision with a
 *     button.
 *   - **No preview of the route.** The map is revealed after the pick, exactly
 *     as it always was. A player choosing between two fully-readable maps is
 *     solving an optimisation problem, not making a decision; this is the same
 *     argument `run-map.ts` makes for showing tiers but never the three cards.
 *
 * The one thing a card *could* honestly say and does not is which of its types
 * the party already covers. That is a real fact and it is on the map screen's
 * threat readout, one click away, rather than repeated here — putting it on the
 * card would sort the cards in the reader's eye, which is an ordering that
 * implies a ranking.
 *
 * ## Stage 4.7, Part 3: the two facts the choice was being made without
 *
 * The cards are unchanged. What is added is context around them, because
 * locale choice was being made blind against two things the player has every
 * right to see.
 *
 *   - **The segment's gym**, in the header: leader identity and type identity.
 *     This is what makes region selection a counter-pick rather than a coin
 *     flip, which is the point of the screen.
 *   - **The party**, as a compact strip and through the drawer, since this is
 *     the screen where the player is deciding what they want to catch.
 *
 * **Part 4 applies and it is the whole design of this addition.** No locale
 * card is annotated with how its types fare against the gym. The cards are not
 * ordered by matchup. Nothing is marked. Both facts are on screen, side by
 * side, and working out the relationship is the player's job and the entire
 * decision.
 *
 * ### The flagged default: one gym, not eight
 *
 * Only the current segment's gym is revealed, not the full eight-gym ladder.
 * Revealing the whole ladder turns the run into a draft plan, which is a
 * different and probably interesting game, but it is a bigger change than this
 * patch and it wants its own playtest. It is a UI change with no structural or
 * version consequence, so revisiting it later is cheap.
 */
import { archetypeOf } from '../../core/archetype';
import { describeSpecCard } from '../../core/battle/driver';
import type { PokemonState } from '../../core/types';
import { ARCHETYPE_DISPLAY } from '../../data/archetypes';
import type { GymDefinition } from '../../data/gyms';
import { localeById, type LocaleId } from '../../data/locales';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface LocaleSelect {
  root: HTMLElement;
  render(view: LocaleSelectView, onPick: (index: number) => void): void;
}

export interface LocaleSelectView {
  options: readonly LocaleId[];
  segment: number;
  /** The gym guarding this segment. Revealed; the other seven are not. */
  gym: GymDefinition;
  /** The party as it stands, for the compact strip. */
  party: readonly PokemonState[];
}

export function createLocaleSelect(): LocaleSelect {
  const root = el('section', 'screen screen--locale');
  const heading = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  blurb.textContent =
    'Where this segment is walked. The region decides which wild Pokemon live ' +
    'in it, and nothing else — trainers, shops, rests and the gym are the same ' +
    'either way.';
  const grid = el('div', 'locales');
  grid.dataset['tutorial'] = 'regions';

  /*
   * The gym rail, above the cards.
   *
   * Above rather than below, because it is the fact the choice is *against*:
   * a player who reads the region names first and the gym second has already
   * made the pick by the time they learn what it was for.
   */
  const rail = el('div', 'locale__gym');
  rail.dataset['tutorial'] = 'gym';
  const railLabel = el('span', 'locale__gym-label');
  railLabel.textContent = 'This segment ends at';
  const railLeader = el('span', 'locale__gym-leader');
  const railType = el('span', 'locale__gym-type');
  rail.append(railLabel, railLeader, railType);

  /*
   * The party strip: a name, a level, types and the archetype label per member.
   *
   * Compact *and* the full cards are one tap away in the drawer, which is the
   * split that keeps this from being a reduced variant in the sense Part 1
   * forbids: the strip is a reminder of who is in the party, and the drawer is
   * the readout. A strip that tried to be the readout would have to choose
   * which stats to drop.
   */
  const strip = el('div', 'locale__party');

  root.append(heading, rail, blurb, strip, grid);

  return {
    root,
    render(view, onPick) {
      heading.textContent = `Segment ${view.segment + 1} — choose a region`;
      railLeader.textContent = view.gym.leader;
      railType.replaceChildren(typeChip(view.gym.type));
      strip.replaceChildren(...view.party.map(renderStripMember));
      grid.replaceChildren(
        ...view.options.map((locale, index) => renderCard(locale, () => onPick(index))),
      );
    },
  };
}

/**
 * One party member on the strip: who they are, and what shape they are.
 *
 * Deliberately not a stat block, a move list, or an HP bar. Those are in the
 * drawer, one tap away and identical to what the party screen shows. This is
 * the line that stops the player having to remember *which three Pokemon they
 * have* while reading four types off a card.
 */
function renderStripMember(member: PokemonState): HTMLElement {
  const card = describeSpecCard(member.spec);
  const row = el('div', 'locale__party-member');
  if (member.fainted) row.classList.add('locale__party-member--fainted');

  const name = el('span', 'locale__party-name');
  name.textContent = card.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${card.level}`;

  const archetype = el('span', 'badge badge--archetype');
  archetype.textContent = ARCHETYPE_DISPLAY[archetypeOf(card.baseStats)].short;
  archetype.dataset['tip'] = 'archetype:all';
  archetype.tabIndex = 0;
  archetype.setAttribute('role', 'button');

  row.append(name, level, ...card.types.map(typeChip), archetype);
  return row;
}

function renderCard(id: LocaleId, onPick: () => void): HTMLElement {
  const locale = localeById(id);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `locale locale--${id}`;

  const name = el('span', 'locale__name');
  name.textContent = locale.name;

  const types = el('span', 'locale__types');
  // The four types, in table order rather than sorted, so the same region reads
  // the same way every time it is offered.
  types.replaceChildren(...locale.types.map(typeChip));

  const blurb = el('span', 'locale__blurb');
  blurb.textContent = locale.blurb;

  /*
   * The palette swatch. Stage V1. Three blocks, deep, mid and glow, drawn
   * from the card's own locale tokens (`theme/locales.css` declares each
   * palette on the card class as well as on the page). A fact about the
   * region, the same size on every card, and no more of one than a type chip.
   */
  const swatch = el('span', 'locale__swatch');
  swatch.setAttribute('aria-hidden', 'true');
  for (const tone of ['deep', 'mid', 'glow']) swatch.append(el('span', `locale__swatch-${tone}`));

  card.append(name, types, blurb, swatch);
  card.addEventListener('click', onPick);
  return card;
}
