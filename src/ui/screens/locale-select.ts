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
import { describeSpecCard } from '../../core/battle/driver';
import type { PokemonState } from '../../core/types';
import type { GymDefinition } from '../../data/gyms';
import { localeById, type LocaleId } from '../../data/locales';
import { el, levelAria, levelText } from '../scene';
import { typeChip } from './starter-select';
import { abilityChip, monTypeChip } from '../chip';

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
  /*
   * **The explanation is gone from the screen. M5.3.**
   *
   * *"The region decides the wild Pokemon here and nothing else"* is nine
   * words explaining a mechanism, at rest, on every visit, for the whole run.
   * R5 says there is one explanation mechanism and it is the inspect layer;
   * section 7 gives first-encounter teaching to the coach marks. A sentence on
   * the screen is neither, and it is the third-largest block of words D32's
   * audit found here.
   */

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
  /*
   * **The rail's label is gone. M5.3.** *"This segment ends at"* was four
   * words introducing a leader name and a type chip that sit directly above
   * the region cards, which is the position R1 says carries the meaning. The
   * gym tip on the leader's name is unchanged, so what the label was pointing
   * at is still one press away.
   */
  const railLabel = el('span', 'locale__gym-label');
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

  root.append(heading, rail, strip, grid);

  return {
    root,
    render(view, onPick) {
      /*
       * **Three words, where there were four plus a number. M5.3, D32.**
       *
       * D32 gave this screen a budget of 4 — it had none, which is how ~30
       * words of chrome came to sit above a card row budgeted at 0. The
       * segment number goes because the map rail and the shell both carry it
       * and this screen is reached from one of them; what is left is the
       * instruction, which is the one thing here a player cannot read off
       * anything else.
       */
      heading.textContent = 'Choose a region';
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
  level.textContent = levelText(card.level);
  level.setAttribute('aria-label', levelAria(card.level));

  /*
   * **The archetype label is gone. M5.3, and section 3 asks for it twice.**
   *
   * Its own row: *"Archetype | Not rendered where the stat bars already draw
   * it | Absent | **Not on inspect either; it is a derived label and can lie
   * under randomization**."* This strip has no stat bars, so the first clause
   * did not reach it and the chip survived D18 — but the sentence after the
   * bar is unconditional about what the label is worth, and on a screen D32
   * budgets at 4 it was spending **12 words** across six members to say
   * something the bible says can be false.
   *
   * Nothing replaces it. The stat block it summarised is one tap away in the
   * drawer, drawn as six bars and six numbers, which is the readout this label
   * was a lossy guess at.
   */
  row.append(name, level, ...card.types.map(monTypeChip), abilityChip(card.ability, card.abilityId));
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

  /*
   * **The region's line is gone from the face. Milestone M5.3.**
   *
   * Section 4 budgets this card at **0** and names what survives: *"Locale name
   * plus four type chips."* The line — "Canopy and something moving in it" —
   * is six of them, and it is a sentence at rest on a card, which R2 forbids
   * outright.
   *
   * **Nothing decision-bearing leaves with it, and that is why it is cut
   * rather than re-encoded.** What a region decides is which wild Pokemon
   * appear, and the four type chips beside the name are that fact in the
   * encoding section 2 gives it. The line is atmosphere over the top of it. C2
   * binds facts that change a decision, and this one changes none — the
   * distinction D33 turns on for the event hints, in a case where it is
   * unambiguous.
   *
   * **And it gets no tip, which is a decision rather than an omission.** The
   * first cut put a `locale:` panel behind the card's name, and
   * `test/tutorial-browser.test.ts` could not click a region afterwards: the
   * panel opens on hover as well as on long press, and it landed over the card
   * that opened it — *"`<div class="tip">` intercepts pointer events"*, sixty
   * times in thirty seconds. Making the panel pointer-transparent was tried
   * and backed out: `styles.css` documents `pointer-events: auto` there as
   * deliberate, so the type wheel can be read without the tap-outside handler
   * closing it.
   *
   * **A hover-opening panel does not belong on the face of a control**, and
   * nothing is lost by leaving it off: the line changes no decision, which is
   * why it could be cut in the first place. It stays in `data/locales.ts`,
   * unread, for whatever wants it next.
   */

  /*
   * The palette swatch. Stage V1. Three blocks, deep, mid and glow, drawn
   * from the card's own locale tokens (`theme/locales.css` declares each
   * palette on the card class as well as on the page). A fact about the
   * region, the same size on every card, and no more of one than a type chip.
   */
  const swatch = el('span', 'locale__swatch');
  swatch.setAttribute('aria-hidden', 'true');
  for (const tone of ['deep', 'mid', 'glow']) swatch.append(el('span', `locale__swatch-${tone}`));

  card.append(name, types, swatch);
  card.addEventListener('click', onPick);
  return card;
}
