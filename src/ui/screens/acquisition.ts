/**
 * The capture offer: a Pokemon on the table, against the party you have.
 *
 * **The offer and the party are shown side by side, and that is the whole
 * design.** "Do you want a Tyranitar?" is not a decision; "do you want a
 * Tyranitar instead of your Blissey" is. So the offered member is rendered in
 * exactly the same card shape as the party, at the same size, with the same
 * numbers on it — anything else would make the comparison a matter of
 * squinting.
 *
 * Two states, decided by whether the party is full:
 *
 *   - **Room to spare.** Take it or decline. Declining is always legal and is a
 *     real button, not a corner X: an offer you can only accept is not an offer.
 *   - **Full.** Taking it requires choosing who goes, so every party card grows
 *     a release button and the plain "Take it" disappears. There is no way to
 *     end up over capacity from here, because there is no control that would
 *     do it.
 *
 * Release is permanent for the run — no box, see `core/acquisition.ts` — so the
 * button confirms before it commits.
 *
 * ## Stage 4.6a: a section, not a screen
 *
 * This was a screen of its own, routed to after the result screen. It is now a
 * block *inside* the result, and the change is the spec's: "the capture offer
 * renders on the existing post-battle result screen. Do not add a second path
 * by which a node completes."
 *
 * That matters more than it sounds. A fight that offered a card and a capture
 * used to end on two screens in sequence, and the second one arrived after the
 * first had already been dismissed — so the player was deciding whether a
 * Pokemon was worth a party slot with the fight it came from off screen. Now
 * the outcome, the party as the fight left it, and the offer are one view.
 *
 * Every acquisition reaches here, from either route: `playRun` only ever asks
 * after a battle it won, so a `species` reward card lands in the same place a
 * wild capture does. Two screens for one decision is how the two drift.
 */
import { describeOffer, type AcquisitionDecision, type AcquisitionOffer } from '../../core/acquisition';
import { describeSpecCard } from '../../core/battle/driver';
import { archetypeChip } from '../archetype-chip';
import { coverageAfterSwap, coverageDelta, offensiveCoverage } from '../../core/coverage';
import { hpState } from '../../core/hpCopy';
import { heldItem } from '../../core/items';
import { createPartyMember, hpFraction } from '../../core/party';
import type { PokemonSpec, PokemonState } from '../../core/types';

import { el } from '../scene';
import { statLine, typeChip } from './starter-select';
import { openBand } from '../band';
import { neutralChip } from '../chip';

/** What the offer's source says about where it came from. Never what it is worth. */
const SOURCE_BLURB: Record<AcquisitionOffer['source'], string> = {
  encounter: 'You beat it. You can take it with you.',
  reward: 'Offered as your reward for the fight.',
  event: 'It is here, and it will come with you.',
};

/**
 * Build the capture block for the result screen.
 *
 * Returns an element rather than owning a screen, so the result screen decides
 * where it sits and nothing here knows about the router.
 */
export function renderCaptureOffer(
  offer: AcquisitionOffer,
  party: readonly PokemonState[],
  onDecide: (decision: AcquisitionDecision) => void,
  /**
   * The party slots the run has right now, from `core/run.partyCapacity`.
   *
   * **The card the slot schedule has to reach, or item 1 is a lie on screen.**
   * This is what decides whether the player is asked to release someone, and a
   * fixed number here would tell a player with a new fourth slot that their
   * party of three is full. The same number is what `decisionRefusal` checks the
   * answer against, so the screen and the rule cannot disagree.
   */
  capacity: number,
): HTMLElement {
  const section = el('div', 'acquire');
  const full = party.length >= capacity;

  const title = el('h3', 'result__heading');
  title.textContent = describeOffer(offer);

  const blurb = el('p', 'acquire__blurb');
  blurb.textContent = full
    ? `${SOURCE_BLURB[offer.source]} Your party is full — someone has to go.`
    : SOURCE_BLURB[offer.source];

  const offered = el('div', 'acquire__offer');
  offered.replaceChildren(renderOffered(offer.spec));

  /*
   * The coverage line, before and after, exactly as the species reward card
   * prints it. Part 4 in full: "adds Dragon, Steel. Loses Ghost." is a readout
   * the player judges; "improves your coverage" is the UI judging for them, and
   * `core/coverage.ts` deliberately exposes no number to dress up as one.
   *
   * At a full party the after-set is computed against slot 0 and the line says
   * so, because which member goes is a choice the player has not made yet at
   * the moment they are reading this.
   */
  const coverage = el('p', 'acquire__coverage');
  coverage.textContent = captureCoverageLine(offer, party, capacity);

  const compare = el('h4', 'acquire__heading');
  compare.textContent = full
    ? `Your party (${party.length} of ${capacity}) — choose who to release`
    : `Your party (${party.length} of ${capacity})`;

  const list = el('div', 'party party--compare');
  list.replaceChildren(...party.map((member, index) => renderExisting(member, index, full, onDecide)));

  const actions = el('div', 'acquire__actions');
  const decline = document.createElement('button');
  decline.type = 'button';
  decline.className = 'button';
  decline.textContent = full ? 'Keep my party as it is' : 'Leave it';
  decline.addEventListener('click', () => onDecide({ kind: 'decline' }));

  if (full) {
    // No "take it" button at a full party: the only way to accept is to name
    // who leaves, and the release buttons on the cards are that choice.
    actions.replaceChildren(decline);
  } else {
    const take = document.createElement('button');
    take.type = 'button';
    take.className = 'button primary-action';
    take.textContent = 'Take it';
    take.addEventListener('click', () => onDecide({ kind: 'accept' }));
    actions.replaceChildren(take, decline);
  }

  section.append(title, blurb, offered, coverage, compare, list, actions);
  return section;
}

/**
 * What taking it would change about the party's offensive typing, in one
 * factual sentence.
 *
 * The same reading `screens/reward.ts` prints on a species card, computed the
 * same way from the same pure function — a second implementation would be a
 * second answer to "what does this cost me", and the first divergence between
 * them would be invisible.
 */
function captureCoverageLine(
  offer: AcquisitionOffer,
  party: readonly PokemonState[],
  capacity: number,
): string {
  if (party.length === 0) return '';
  const incoming = createPartyMember(offer.spec);
  const before = offensiveCoverage(party);
  const full = party.length >= capacity;
  const delta = coverageDelta(before, coverageAfterSwap(party, incoming, full ? 0 : -1));

  const parts: string[] = [];
  if (delta.added.length > 0) parts.push(`adds ${delta.added.join(', ')}`);
  if (delta.lost.length > 0) parts.push(`loses ${delta.lost.join(', ')}`);
  const body = parts.length > 0 ? parts.join('. ') : 'unchanged';
  const scope = full ? ' if it replaces your first member' : '';
  return `Coverage${scope}: ${body}.`;
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
  header.append(name, level, archetypeChip(detail.baseStats), ...detail.types.map(typeChip));

  const ability = el('span', 'party__ability');
  ability.textContent = detail.ability;
  header.append(ability);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  /*
   * Full HP, and from 4.6a at the level it was fought at rather than below the
   * curve. The discount was the price of a free Pokemon; the price is the step
   * the encounter occupied and the slot it takes.
   */
  hp.textContent = `${hpState(detail.maxHp, detail.maxHp)} · joins at full health`;
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

  // The same six-stat row a starter card and a species reward card carry, so a
  // Pokemon looks identical everywhere the player is asked to judge one.
  card.append(header, meta, statLine(detail.baseStatsAtLevel, detail.maxHp), moves);
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
  header.append(name, level, archetypeChip(detail.baseStats), ...detail.types.map(typeChip));

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  hp.textContent = hpState(member.hp, member.maxHp);
  meta.append(hp);

  const item = heldItem(member);
  if (item) {
    // Stage 4.5.1: the item is *not* part of the price. Releasing is still
    // permanent — there is no box and no retrieval — but what they were
    // holding goes back to the bag, because an item is destroyed only by an
    // explicit discard and letting a Pokemon go is not one.
    meta.append(neutralChip(`${item.name} (returns to your bag)`, 'item'));
  }

  card.append(header, track, meta);

  if (full) {
    const release = document.createElement('button');
    release.type = 'button';
    release.className = 'button button--small button--danger';
    release.textContent = `Release ${detail.species}`;
    // The shared band confirms it (ui/band.ts). Stage V2.
    release.addEventListener('click', () =>
      openBand({
        title: `Release ${detail.species}?`,
        detail: 'For good, to make room. Anything held goes back to the bag.',
        confirm: 'Release',
        cancel: 'Keep',
        onConfirm: () => onDecide({ kind: 'release', slot: index }),
      }),
    );
    const actions = el('div', 'party__actions');
    actions.append(release);
    card.append(actions);
  }
  return card;
}
