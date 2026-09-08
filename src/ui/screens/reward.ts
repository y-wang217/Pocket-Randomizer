/**
 * The reward screen: three cards, one pick, no skip and no reroll.
 *
 * The absence of a skip button is the design, not an omission. A reward you can
 * decline is a reward with no cost, and the moment one exists the interesting
 * question — *which of these three is worth the most to this run* — collapses
 * into "take the obviously good one, skip otherwise". Three cards and a forced
 * choice is what makes a normal node's payout feel like a normal node's payout.
 *
 * Every card says what it *does*, not what it is called. "Leftovers" means
 * nothing to a player who has not held one; "Restores 1/16 max HP at the end of
 * every turn" means something immediately. And a type-boosting item that does
 * not match the party's typing says so out loud — see `itemSuitsTypes`. A
 * near-dud that announces itself is a legibly weak reward; one that hides is a
 * lottery, and the player finds out four fights later.
 */
import { describeSpecCard } from '../../core/battle/driver';
import { itemSuitsTypes } from '../../core/items';
import { teachMove } from '../../core/party';
import type { Reward, RewardOffer } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { itemById } from '../../data/items';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface RewardScreen {
  root: HTMLElement;
  render(offer: RewardOffer, state: RunState, onPick: (index: number) => void): void;
}

const TIER_BLURB: Record<string, string> = {
  normal: 'A normal fight. A normal payout.',
  hard: 'You took the harder road. This is what it pays.',
  elite: 'You took the worst odds in the step. Take something worth it.',
};

export function createRewardScreen(): RewardScreen {
  const root = el('section', 'screen screen--reward');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  const cards = el('div', 'rewards');

  root.append(title, blurb, cards);

  return {
    root,
    render(offer, state, onPick) {
      title.replaceChildren(document.createTextNode('Choose a reward '), tierBadge(offer.tier));
      blurb.textContent = `${TIER_BLURB[offer.tier] ?? ''} One of the three. There is no skip.`;
      cards.replaceChildren(
        ...offer.options.map((option, index) => renderCard(option, state, () => onPick(index))),
      );
    },
  };
}

/** The tier chip, shared with the map so the two screens agree at a glance. */
export function tierBadge(tier: string): HTMLElement {
  const badge = el('span', `tier tier--${tier}`);
  badge.textContent = tier.toUpperCase();
  return badge;
}

function renderCard(reward: Reward, state: RunState, onPick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `reward reward--${reward.kind}`;

  const kind = el('span', 'reward__kind');
  kind.textContent = KIND_LABELS[reward.kind];

  const name = el('span', 'reward__name');
  const detail = el('span', 'reward__detail');
  const note = el('span', 'reward__note');

  const lead = state.party[0];

  switch (reward.kind) {
    case 'item': {
      const entry = itemById(reward.item);
      name.textContent = entry?.name ?? reward.item;
      detail.textContent = entry?.blurb ?? '';
      if (entry && lead) {
        const types = describeSpecCard(lead.spec).types;
        if (!itemSuitsTypes(entry, types)) {
          // The honest version of a weak card: say it is weak *for you*.
          note.textContent = `Does nothing for a ${types.join('/')} Pokemon.`;
          note.classList.add('reward__note--warn');
        }
        if (lead.item) {
          const held = itemById(lead.item)?.name ?? lead.item;
          note.textContent = `${note.textContent} Replaces ${held}, which is lost.`.trim();
        }
      }
      break;
    }

    case 'currency':
      name.textContent = `${reward.amount} coins`;
      detail.textContent = 'Spend it at a shop, on items, healing or a move.';
      note.textContent = `You are carrying ${state.currency}.`;
      break;

    case 'heal':
      name.textContent = reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
      detail.textContent = 'Heals HP and PP, and clears status.';
      if (lead) {
        const missing = lead.maxHp > 0 ? 1 - lead.hp / lead.maxHp : 0;
        note.textContent =
          missing < 0.05
            ? 'You are at full health. This is nearly wasted.'
            : `You are down ${Math.round(missing * 100)}%.`;
        if (missing < 0.05) note.classList.add('reward__note--warn');
      }
      break;

    case 'tm':
    case 'tutor':
      name.textContent = reward.move;
      detail.textContent =
        reward.kind === 'tutor'
          ? 'A strong move, taught in place of your weakest attack.'
          : 'A new move, taught in place of your weakest attack.';
      if (lead) {
        // Naming what goes is the whole decision: a move reward is a trade, and
        // a trade you cannot see the other half of is a coin flip. `teachMove`
        // is asked rather than guessed at, so the card cannot promise one thing
        // and the transition do another.
        const after = teachMove(lead, reward.move);
        const before = new Set(lead.spec.moves);
        const dropped = lead.spec.moves.find((move) => !after.spec.moves.includes(move));
        const learned = after.spec.moves.some((move) => !before.has(move));

        if (!learned) {
          note.textContent = 'Every attack you have is stronger. This only restores PP.';
          note.classList.add('reward__note--warn');
        } else if (dropped) {
          note.textContent = `Replaces ${dropped}.`;
        } else {
          note.textContent = 'Fills an empty move slot.';
        }
      }
      break;

    case 'species':
      name.textContent = `${reward.species} · Lv${reward.level}`;
      detail.textContent = `${reward.ability}. ${reward.moves.join(', ')}.`;
      note.textContent = 'Replaces your Pokemon entirely. Everything it knows is gone.';
      note.classList.add('reward__note--warn');
      break;
  }

  card.append(kind, name, detail);
  if (note.textContent) card.append(note);
  if (reward.kind === 'item') {
    const entry = itemById(reward.item);
    if (entry?.boostsType) card.append(typeChip(entry.boostsType));
  }
  card.addEventListener('click', onPick);
  return card;
}

const KIND_LABELS: Record<Reward['kind'], string> = {
  item: 'Held item',
  currency: 'Coins',
  heal: 'Restore',
  tm: 'TM',
  tutor: 'Move tutor',
  species: 'New Pokemon',
};
