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
import { describeMove, describeSpecCard } from '../../core/battle/driver';
import { coverageAfterSwap, coverageDelta, offensiveCoverage } from '../../core/coverage';
import { createPartyMember } from '../../core/party';
import type { Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { itemById } from '../../data/items';
import { PARTY_SIZE } from '../../data/partyTuning';
import { el, genderMark, moveCard } from '../scene';
import { statLine, typeChip } from './starter-select';

/** The tier chip, shared with the map so the two screens agree at a glance. */
export function tierBadge(tier: string): HTMLElement {
  const badge = el('span', `tier tier--${tier}`);
  badge.textContent = tier.toUpperCase();
  return badge;
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
      // Type, base power, PP and category, through the same component the
      // battle screen uses. No comparison against anything the player owns.
      const facts = describeMove(reward.move);
      if (facts) card.append(moveCard(facts));
      break;
    }

    case 'species': {
      /*
       * **Item F, part 4: a species card is a pick screen and was showing a
       * name.**
       *
       * It said the species, the level, the ability and a comma-joined list of
       * move *names* — no types, no base stats, no base power, no PP. The
       * starter select has shown all of that since Stage 2, and this card
       * offers the same decision mid-run against a party you already know.
       * Choosing between "a Pokemon" and two other cards on a name is the coin
       * flip the spec says this game should not have.
       *
       * Built from the same probe the starter card uses, so the two agree by
       * construction rather than by being kept in step.
       */
      const card_ = describeSpecCard({
        species: reward.species,
        ability: reward.ability,
        moves: reward.moves,
        level: reward.level,
        gender: reward.gender,
      });

      name.textContent = `${card_.species} · Lv${card_.level}${genderMark(reward.gender)}`;
      detail.textContent = card_.ability;
      note.textContent = coverageLine(reward, state);

      const types = el('span', 'panel__types');
      types.replaceChildren(...card_.types.map(typeChip));
      card.append(types, statLine(card_.baseStatsAtLevel, card_.maxHp));
      for (const move of card_.moves) card.append(moveCard(move));
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

/**
 * The coverage one-liner: what the party's offensive typing gains and loses.
 *
 * **A factual readout, and Part 4 applies to it in full.** "Adds Dragon, Steel.
 * Loses Ghost." is correct; "improves your coverage" is not, and neither is a
 * count, an arrow, or a colour that implies which direction is better. The
 * function that computes it (`core/coverage.ts`) deliberately exposes no number
 * for this line to dress up as one.
 *
 * Two readings, because the card means two different things depending on the
 * party:
 *
 *   - **A slot free** — the newcomer is added, so the line is a pure gain and
 *     can never show a loss.
 *   - **Full** — taking it costs a member, and which member is a choice the
 *     player has not made yet at this point. The card cannot know the answer,
 *     so it reports against slot 0 and says so. The acquisition screen, where
 *     the target actually gets highlighted, is where the line updates per
 *     member — `coverageAfterSwap` takes the highlighted slot for exactly that.
 */
function coverageLine(
  reward: Extract<Reward, { kind: 'species' }>,
  state: RunState,
): string {
  if (state.party.length === 0) return '';
  const incoming = createPartyMember({
    species: reward.species,
    level: reward.level,
    ability: reward.ability,
    moves: [...reward.moves],
    gender: reward.gender,
  });

  const before = offensiveCoverage(state.party);
  const full = state.party.length >= PARTY_SIZE;
  const after = coverageAfterSwap(state.party, incoming, full ? 0 : -1);
  const delta = coverageDelta(before, after);

  const parts: string[] = [];
  if (delta.added.length > 0) parts.push(`adds ${delta.added.join(', ')}`);
  if (delta.lost.length > 0) parts.push(`loses ${delta.lost.join(', ')}`);
  const body = parts.length > 0 ? parts.join('. ') : 'unchanged';
  const scope = full ? ' if it replaces your first member' : '';
  return `Coverage${scope}: ${body}.`;
}

const KIND_LABELS: Record<Reward['kind'], string> = {
  item: 'Held item',
  currency: 'Coins',
  heal: 'Restore',
  tm: 'TM',
  tutor: 'Move tutor',
  species: 'New Pokemon',
};
