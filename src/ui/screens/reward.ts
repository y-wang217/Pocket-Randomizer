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
 * every turn" means something immediately.
 *
 * ## Part 4: the cards present attributes, never verdicts
 *
 * Stage 4.5.1 rewrote most of this file, and the reason is a rule rather than a
 * feature: **the UI never renders a recommendation, a score, a "best" marker,
 * or an ordering that implies one.** The player should be able to work out that
 * a move is good; the screen should not tell them.
 *
 * Four notes were removed outright, and each is worth naming because each read
 * as helpful:
 *
 *   - *"Every attack you have is stronger. This only restores PP."* — a verdict
 *     on the card, and precisely the thing Part 4 names: a move card must not
 *     indicate which of the player's current moves it would improve on.
 *   - *"Replaces {move}."* — pre-empted a decision that is now the player's, and
 *     was a prediction rather than a fact once `chooseMoveToReplace` existed.
 *   - *"You are at full health. This is nearly wasted."* — a verdict on a heal.
 *     The card states what it restores; whether that is worth a pick is the
 *     pick.
 *   - *"Replaces {item}, which is lost."* and *"Replaces your Pokemon
 *     entirely."* — both simply false after this stage. Items go to the
 *     backpack and nothing is destroyed; a species card is an addition that
 *     costs a slot, or a swap the player chooses.
 *
 * What survives is the type-match line on an item, and it survives because it
 * is an attribute rather than a judgement: a Charcoal boosts Fire moves, and
 * saying which type it boosts is the same class of fact as saying it is 1.2x.
 * It no longer names a party member, because the item is no longer going to
 * one.
 */
import { describeMove } from '../../core/battle/driver';
import type { Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { itemById } from '../../data/items';
import { bandOfMove } from '../../data/moveOverrides';
import { bandChip, tierChip } from '../chip';
import { el, moveCard } from '../scene';
import { typeChip } from './starter-select';

/**
 * The band chip: which of four base-power brackets a move sits in.
 *
 * Exported alongside `tierBadge` and styled the same way, because the two are
 * the same kind of thing — a one-word attribute the player learns to read at a
 * glance. Neither says whether the thing it labels is good.
 */
export function bandBadge(band: number): HTMLElement {
  return bandChip(band);
}

/** The tier chip, shared with the map so the two screens agree at a glance. */
export function tierBadge(tier: string): HTMLElement {
  return tierChip(tier);
}

/**
 * One reward card. **Exported, because the screen that holds them moved.**
 *
 * Through Stage 4.5.1 this file owned both the cards and the screen around
 * them, and that screen was doing double duty as the result screen — so a win
 * with no cards had nowhere to land. Item D inverts it: `screens/result.ts` is
 * the screen, and the cards are a section inside it. What is left here is what
 * a card *is*, which was always this file's real subject.
 */
export function renderRewardCard(reward: Reward, state: RunState, onPick: () => void): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `reward reward--${reward.kind}`;

  const kind = el('span', 'reward__kind');
  kind.textContent = KIND_LABELS[reward.kind];

  const name = el('span', 'reward__name');
  const detail = el('span', 'reward__detail');
  const note = el('span', 'reward__note');

  switch (reward.kind) {
    case 'item': {
      const entry = itemById(reward.item);
      name.textContent = entry?.name ?? reward.item;
      // The plain-language effect line Part 5 asks for, from the item's own
      // metadata rather than written here — `blurb` has been that field since
      // Stage 3, so no `playerDescription` was added alongside it.
      detail.textContent = entry?.blurb ?? '';
      note.textContent = 'Goes to your backpack. Assign it on the party screen.';
      break;
    }

    case 'currency':
      name.textContent = `${reward.amount} coins`;
      detail.textContent = 'Spend it at a shop, on items, healing or a move.';
      note.textContent = `You are carrying ${state.currency}.`;
      break;

    case 'heal':
      name.textContent =
        reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
      detail.textContent = 'Heals HP and PP, and clears status, for the whole party.';
      break;

    case 'tm':
    case 'tutor': {
      name.textContent = reward.move;
      detail.textContent =
        reward.kind === 'tutor'
          ? 'A strong move. You choose who learns it, and what it replaces.'
          : 'A new move. You choose who learns it, and what it replaces.';
      /*
       * The band, next to the name. **Stage 4.6b, and it is an attribute.**
       *
       * "Band 3" says which of four power brackets the move sits in, and Part 4
       * governs it exactly as it governs everything else on this card: a band
       * is a fact about the move, the same kind of fact as its type or its base
       * power, and the card does not say whether it is better than what the
       * player is holding. There is no comparison, no arrow, and no colour that
       * implies a direction.
       *
       * It is worth printing *because* base power is already here and does not
       * answer the question the ramp poses. A player who has learned that this
       * segment pays band 2 can read one badge and know whether the risky node
       * beside them is offering something they cannot get for free — which is
       * the whole decision Stage 4.6b added, and it is unreadable from `95 BP`
       * alone.
       */
      const band = bandOfMove(reward.move);
      if (band !== null) name.append(document.createTextNode(' '), bandBadge(band));
      // Type, base power, PP and category, through the same component the
      // battle screen uses. No comparison against anything the player owns.
      const facts = describeMove(reward.move);
      if (facts) card.append(moveCard(facts));
      break;
    }

  }

  card.prepend(kind, name, detail);
  if (note.textContent) card.append(note);
  if (reward.kind === 'item') {
    const entry = itemById(reward.item);
    if (entry?.boostsType) card.append(typeChip(entry.boostsType));
  }
  card.addEventListener('click', onPick);
  return card;
}

/*
 * `coverageLine` lived here, on the species card, and went with it in Stage
 * 4.6b. The reading it produced did not: `screens/acquisition.ts` prints the
 * same sentence from the same pure function on the capture card, which is where
 * "what would this change about my party" belongs now that capture is the only
 * way a party member arrives.
 */

const KIND_LABELS: Record<Reward['kind'], string> = {
  item: 'Held item',
  currency: 'Coins',
  heal: 'Restore',
  tm: 'TM',
  tutor: 'Move tutor',
  relic: 'Relic',
};
