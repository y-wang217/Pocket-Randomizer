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
import { moveCardData } from '../move-detail';
import type { Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { itemById } from '../../data/items';
import { tierChip } from '../chip';
import { el, moveCard } from '../scene';
import { setProse } from '../dom';
import { carryingLine, REWARD_COPY } from '../copy/screens';
import { typeChip } from './starter-select';

/*
 * `bandBadge` lived here and is gone. **R12.**
 *
 * It was this file's own wrapper around `bandChip`, fed by this file's own
 * `bandOfMove` call, appended to this file's own `.reward__name` — three ways
 * in which a band was a property of the reward screen rather than of a move.
 * The badge now comes with the card: `moveBandChip` in `ui/scene.ts` draws it
 * for every surface, and the number arrives on `MoveCardData.band` from the
 * one `bandOfMove` read in the adapter.
 *
 * Nothing was lost in the move. The chip is the same chip, the tooltip is the
 * same tooltip, and the badge is still on this screen — one region lower, in
 * the move card, beside the base power it can disagree with.
 */

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
  const tuning = state.tuning;
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
      setProse(note, REWARD_COPY.itemNote);
      break;
    }

    case 'currency':
      name.textContent = `${reward.amount} coins`;
      setProse(detail, REWARD_COPY.coins);
      setProse(note, carryingLine(state.currency));
      break;

    case 'heal':
      name.textContent =
        reward.fraction >= 1 ? 'Full restore' : `Restore ${Math.round(reward.fraction * 100)}%`;
      setProse(detail, REWARD_COPY.heal);
      break;

    case 'tm':
    case 'tutor': {
      name.textContent = reward.move;
      setProse(detail, reward.kind === 'tutor' ? REWARD_COPY.tutor : REWARD_COPY.tm);
      /*
       * The band. **Stage 4.6b's badge, on R12's insertion point.**
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
       *
       * **R12 moved where it renders, not whether.** It used to be appended
       * here, to the reward's name. It now arrives inside the move card below,
       * from `moveCardData`, which is what makes the same badge appear on the
       * four moves the player is comparing this one against. That comparison
       * was the point of the badge and it was the half that was missing.
       */
      // Type, base power, band, PP and category, through the same component
      // the battle screen uses. No comparison against anything the player owns.
      /*
       * The card, with tags. **Stage 4.7, Part 6b.**
       *
       * **No holder is passed, and that is the STAB rule.** A reward card is
       * unassigned until `chooseMoveRecipient` answers, so a STAB tag here
       * would be claiming something not yet true. It appears on the recipient
       * screen and on the party card the move lands on, both of which know who
       * is holding it.
       */
      const facts = describeMove(reward.move);
      if (facts) card.append(moveCard(moveCardData(facts, tuning)));
      break;
    }

  }

  card.prepend(kind, name, detail);
  if (note.hasChildNodes()) card.append(note);
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
