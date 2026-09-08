/**
 * Who gets it: the target screen for an item, a TM or a tutor.
 *
 * A second question after the reward screen, and only for the cards that land
 * on one member. Currency and heals are party-wide and never reach here; a
 * Pokemon on offer is a different question again (`acquisition.ts`).
 *
 * **Each card says what the reward would do to *that* member**, which is the
 * only reason this screen is worth a click rather than defaulting to the lead.
 * A type-boosting item is dead weight off type, and a TM is worth nothing to a
 * member that already has something stronger — both of those are facts about
 * the pairing, not about the card, and the reward screen structurally cannot
 * show them because it does not know who is getting it yet.
 */
import { describeSpecCard } from '../../core/battle/driver';
import { heldItem, itemSuitsTypes } from '../../core/items';
import { hpFraction } from '../../core/party';
import type { TargetedReward } from '../../core/rewards';
import { describeReward } from '../../core/rewards';
import type { PokemonState } from '../../core/types';
import { itemById } from '../../data/items';
import { DAMAGING_MOVES } from '../../data/movePools';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface ItemTargetScreen {
  root: HTMLElement;
  render(
    reward: TargetedReward,
    party: readonly PokemonState[],
    onTarget: (slot: number) => void,
  ): void;
}

export function createItemTargetScreen(): ItemTargetScreen {
  const root = el('section', 'screen screen--target');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  const list = el('div', 'party party--target');

  root.append(title, blurb, list);

  return {
    root,
    render(reward, party, onTarget) {
      title.textContent = describeReward(reward);
      blurb.textContent =
        reward.kind === 'item'
          ? 'Who holds it? Whatever they are holding now is destroyed.'
          : 'Who learns it? It replaces their weakest attack.';

      list.replaceChildren(...party.map((member, index) => renderTarget(reward, member, index, onTarget)));
    },
  };
}

function renderTarget(
  reward: TargetedReward,
  member: PokemonState,
  index: number,
  onTarget: (slot: number) => void,
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'party__member party__member--target';
  // A fainted member is a legal target — it revives at the next node and keeps
  // whatever it was given — so this is never disabled. The label says so
  // instead, because a button that looks broken teaches worse than one that
  // explains itself.
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
  hp.textContent = member.fainted ? 'Fainted — revives at the next node' : `${member.hp} / ${member.maxHp} HP`;
  meta.append(hp);

  const effect = el('span', 'target__effect');
  effect.textContent = effectOn(reward, member, detail);
  if (effect.textContent.startsWith('No use')) effect.classList.add('target__effect--dud');

  button.append(header, track, meta, effect);
  button.addEventListener('click', () => onTarget(index));
  return button;
}

/**
 * What this card would actually do to this member, in one line.
 *
 * The honest version, including when the answer is "nothing". A near-dud that
 * announces itself is a legible choice; one that hides is a lottery the player
 * loses four fights later — the same rule the reward screen already follows,
 * applied to the pairing rather than to the card.
 */
function effectOn(
  reward: TargetedReward,
  member: PokemonState,
  detail: ReturnType<typeof describeSpecCard>,
): string {
  if (reward.kind === 'item') {
    const entry = itemById(reward.item);
    if (!entry) return '';
    const held = heldItem(member);
    const replacing = held ? ` Destroys their ${held.name}.` : '';
    if (entry.boostsType && !itemSuitsTypes(entry, detail.types)) {
      return `No use — ${detail.species} has no ${entry.boostsType} moves to boost.${replacing}`;
    }
    return `${entry.blurb}${replacing}`;
  }

  const incoming = DAMAGING_MOVES.find((move) => move.name === reward.move)?.basePower ?? 0;
  const attacks = detail.moves.filter((move) => move.category !== 'Status');
  if (detail.moves.some((move) => move.name === reward.move)) {
    return `Already knows ${reward.move} — restores its PP instead.`;
  }
  if (detail.moves.length < 4) return `Learns ${reward.move} in a free slot.`;

  const weakest = attacks.length > 0 ? Math.min(...attacks.map((move) => move.basePower)) : 0;
  const strongest = attacks.length > 0 ? Math.max(...attacks.map((move) => move.basePower)) : 0;
  if (incoming <= weakest) {
    const status = detail.moves.find((move) => move.category === 'Status');
    return status
      ? `Weaker than everything they have — replaces ${status.name} for the coverage.`
      : `No use — weaker than every attack ${detail.species} already has.`;
  }
  return incoming > strongest
    ? `Their new best attack (${incoming} BP, up from ${strongest}).`
    : `Coverage: ${incoming} BP, replacing their ${weakest} BP attack.`;
}
