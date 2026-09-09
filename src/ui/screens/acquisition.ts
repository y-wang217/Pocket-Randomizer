/**
 * The acquisition screen: a Pokemon on offer, against the party you have.
 *
 * **The offer and the party are shown side by side, and that is the whole
 * design.** "Do you want a Tyranitar?" is not a decision; "do you want a
 * Tyranitar instead of your Blissey" is. So the offered member is rendered in
 * exactly the same card shape as the party, at the same size, with the same
 * numbers on it — anything else would make the comparison a matter of squinting.
 *
 * Two states, decided by whether the party is full:
 *
 *   - **Room to spare.** Take it or decline. Declining is always legal and is a
 *     real button, not a corner X: an offer you can only accept is not an offer.
 *   - **Full.** Taking it requires choosing who goes, so every party card grows
 *     a release button and the plain "Take it" disappears. There is no way to
 *     end up over `PARTY_SIZE` from this screen, because there is no control
 *     that would do it.
 *
 * Release is permanent for the run — no box, see `core/acquisition.ts` — so the
 * button confirms before it commits.
 */
import { describeOffer, type AcquisitionDecision, type AcquisitionOffer } from '../../core/acquisition';
import { describeSpecCard } from '../../core/battle/driver';
import { heldItem } from '../../core/items';
import { hpFraction } from '../../core/party';
import type { PokemonSpec, PokemonState } from '../../core/types';
import { PARTY_SIZE } from '../../data/partyTuning';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface AcquisitionScreen {
  root: HTMLElement;
  render(
    offer: AcquisitionOffer,
    party: readonly PokemonState[],
    onDecide: (decision: AcquisitionDecision) => void,
  ): void;
}

const SOURCE_BLURB: Record<AcquisitionOffer['source'], string> = {
  encounter: 'It followed you. You can take it with you.',
  reward: 'Offered as your reward for the fight.',
};

export function createAcquisitionScreen(): AcquisitionScreen {
  const root = el('section', 'screen screen--acquisition');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');

  const offered = el('div', 'acquire__offer');
  const compare = el('h3', 'acquire__heading');
  const list = el('div', 'party party--compare');
  const actions = el('div', 'acquire__actions');

  root.append(title, blurb, offered, compare, list, actions);

  return {
    root,
    render(offer, party, onDecide) {
      const full = party.length >= PARTY_SIZE;
      title.textContent = describeOffer(offer);
      blurb.textContent = full
        ? `${SOURCE_BLURB[offer.source]} Your party is full — someone has to go.`
        : SOURCE_BLURB[offer.source];

      offered.replaceChildren(renderOffered(offer.spec));
      compare.textContent = full
        ? `Your party (${party.length} of ${PARTY_SIZE}) — choose who to release`
        : `Your party (${party.length} of ${PARTY_SIZE})`;

      list.replaceChildren(
        ...party.map((member, index) => renderExisting(member, index, full, onDecide)),
      );

      const decline = document.createElement('button');
      decline.type = 'button';
      decline.className = 'button';
      decline.textContent = full ? 'Keep my party as it is' : 'Leave it';
      decline.addEventListener('click', () => onDecide({ kind: 'decline' }));

      if (full) {
        // No "take it" button at a full party: the only way to accept is to name
        // who leaves, and the release buttons on the cards are that choice.
        actions.replaceChildren(decline);
        return;
      }

      const take = document.createElement('button');
      take.type = 'button';
      take.className = 'button button--primary';
      take.textContent = 'Take it';
      take.addEventListener('click', () => onDecide({ kind: 'accept' }));
      actions.replaceChildren(take, decline);
    },
  };
}

/** The offered Pokemon, in the same card shape the party uses. */
function renderOffered(spec: PokemonSpec): HTMLElement {
  const card = el('div', 'party__member party__member--offered');
  const detail = describeSpecCard(spec);

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = detail.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${detail.level}`;
  header.append(name, level, ...detail.types.map(typeChip));

  const ability = el('span', 'party__ability');
  ability.textContent = detail.ability;
  header.append(ability);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  // Full HP, and worth saying out loud: an acquired member arrives healthy but
  // *below* the segment's level curve, which is the price of it.
  hp.textContent = `${detail.maxHp} / ${detail.maxHp} HP · joins at full health`;
  meta.append(hp);

  const moves = el('ul', 'party__moves');
  moves.replaceChildren(
    ...detail.moves.map((move) => {
      const row = el('li', 'party__move');
      const label = el('span', '');
      label.textContent = move.name;
      const power = el('span', 'move__pp');
      power.textContent = move.category === 'Status' ? '—' : `${move.basePower} BP`;
      row.append(label, power);
      return row;
    }),
  );

  card.append(header, meta, moves);
  return card;
}

/** One current member, with a release button when the party is full. */
function renderExisting(
  member: PokemonState,
  index: number,
  full: boolean,
  onDecide: (decision: AcquisitionDecision) => void,
): HTMLElement {
  const card = el('div', 'party__member');
  const detail = describeSpecCard(member.spec);

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = detail.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${detail.level}`;
  header.append(name, level, ...detail.types.map(typeChip));

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  hp.textContent = `${member.hp} / ${member.maxHp} HP`;
  meta.append(hp);

  const item = heldItem(member);
  if (item) {
    const chip = el('span', 'badge badge--item');
    // Stage 4.5.1: the item is *not* part of the price. Releasing is still
    // permanent — there is no box and no retrieval — but what they were
    // holding goes back to the bag, because an item is destroyed only by an
    // explicit discard and letting a Pokemon go is not one.
    chip.textContent = `${item.name} (returns to your bag)`;
    meta.append(chip);
  }

  card.append(header, track, meta);

  if (full) {
    const release = document.createElement('button');
    release.type = 'button';
    release.className = 'button button--small button--danger';
    release.textContent = `Release ${detail.species}`;
    release.addEventListener('click', () => {
      if (release.dataset['confirm'] === 'true') {
        onDecide({ kind: 'release', slot: index });
        return;
      }
      release.dataset['confirm'] = 'true';
      release.textContent = 'Release for good?';
    });
    const actions = el('div', 'party__actions');
    actions.append(release);
    card.append(actions);
  }
  return card;
}
