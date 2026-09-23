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
import type { OfferBadge, Reward } from '../../core/rewards';
import type { RunState } from '../../core/run';
import { itemById } from '../../data/items';
import { relicById } from '../../data/relics';
import { tierChip } from '../chip';
import { el, moveCard } from '../scene';
import { itemIcon } from '../slots';
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

/**
 * The chip beside `TAKE ONE`, shared with the map so the two screens agree at
 * a glance.
 *
 * **Was `tierBadge`, and takes an `OfferBadge` rather than a `string` now.**
 * A gym's reward page prints `GYM`, which is not a tier, and a parameter typed
 * `string` is what let it print `ELITE` for as long as it did without anything
 * objecting. `tierChip` underneath is still generic and still unchanged: it
 * draws `.tier--<value>`, and Stage V0's rule that no tier carries a colour
 * means the fourth value needs no stylesheet entry to look right.
 */
export function offerBadge(badge: OfferBadge): HTMLElement {
  return tierChip(badge);
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
export interface RewardCardOptions {
  /**
   * The shop's price, in coins. **Milestone M5.1, discrepancy D29.**
   *
   * Section 4: *"Shop stock card | 8 | Follows the reward card, plus price
   * number."* "Follows" was not true — `screens/shop.ts` built its own
   * `.shop__item` from scratch, with its own kind label, name, detail line and
   * its own `itemById`, `relicById` and `describeMove` reads, while
   * `renderRewardCard` had exactly one call site. Two components doing one job
   * is the defect section 5 closes with, and D29 ruled the unification.
   *
   * A number and not a label: section 4's counting rule excludes bare numbers,
   * so the price costs nothing against the budget, and R2 is why it is not
   * `Price: 150`.
   */
  price?: number;
}

export function renderRewardCard(
  reward: Reward,
  state: RunState,
  onPick: () => void,
  options: RewardCardOptions = {},
): HTMLButtonElement {
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
    /*
     * **The item and berry face is the sprite, and nothing else. Milestone
     * M5.1, discrepancy D36.**
     *
     * Section 3, the bible's *"single source of truth for how each attribute
     * renders at rest"*: `Held item | Item sprite in a fixed slot | Empty slot
     * renders nothing | Name, one effect line`. The name and the line are the
     * **last** column — what a press opens — not the first.
     *
     * The card used to carry four text nodes: a kind label (`Held item`), the
     * name, the effect line and a note (`your backpack`). Section 4's budget
     * row reads *"One effect line"* under *words that survive*, and M5.1 wrote
     * its item text against that column. D36 is the two sections disagreeing,
     * and CLAUDE.md settles it — the bible wins over a prompt, and section 3 is
     * the section that claims the at-rest question.
     *
     * `itemIcon` is the same cell of the same Showdown sheet the party slots,
     * the battle panel and the party row draw (M3.1, M3.2, both built against
     * this row), so an item looks the same wherever it appears. The `item:` tip
     * is the same one the party row's held-item slot carries, so the press
     * opens the same panel from the same table.
     */
    case 'item': {
      const slot = el('span', 'reward__sprite');
      slot.append(itemIcon(reward.item));
      slot.dataset['tip'] = `item:${reward.item}`;
      card.append(slot);
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

    /*
     * **The relic card. Added by the R19 rulings; it rendered blank until now.**
     *
     * This switch had no `case 'relic'` at all, so a relic card carried its
     * `KIND_LABELS` chip and nothing else — no name, no effect — which is what
     * the playtest screenshot shows. It was not a resolution bug: a relic card
     * reaching this function has already survived `resolveOffer`, so it is a
     * relic the run does not hold and the player can genuinely take.
     *
     * The ruling asks for more than the name: "relics should show you what they
     * are. On the card." So the detail line is the relic's own
     * `playerDescription`, read from the table the same way an item's card
     * reads `blurb` — one field, written once, rendered wherever the object
     * appears. Part 4 holds: that field is already written as an attribute and
     * is already on screen for the rest of the run once taken.
     *
     * The id fallback mirrors `describeReward` and `screens/shop.ts`: a relic
     * missing from the table shows its id rather than an empty card, because a
     * blank card is exactly the failure this case exists to end.
     */
    /*
     * **The relic face is its name, and that is a recorded deviation from
     * section 3. Milestone M5.1, discrepancy D36.**
     *
     * Section 3's Relic row asks for a *"relic sprite in the relic row"*.
     * **There is no relic sprite in the tree** — relics are this game's own
     * objects, not Showdown's, so `ui/slots.ts` has no cell to draw and no
     * asset exists to add one from. Section 3 cannot be honoured literally
     * here, and inventing a glyph for it would be a tenth family, which
     * section 2 and section 10.3 reserve for an amendment with an observed
     * disconfirmer behind it.
     *
     * So the name is the encoding, and the budget is untouched by it: a relic
     * name is a proper noun, which section 4's counting rule excludes, and the
     * census lexicon already carries every one of them from `RELICS`. The card
     * reads **0 words** either way.
     *
     * Everything else goes where section 3 puts it. *"Name, capability it
     * satisfies"* is the inspect column, and the `relic:` tip — the same one
     * the party screen's relic list and the drawer's chips carry — opens the
     * name, the capability and `RELIC_COPY`'s two sentences from one panel.
     * The capability chip that used to sit on this card is gone with the rest:
     * it cost a word at rest for a fact a press already gives.
     */
    case 'relic': {
      const entry = relicById(reward.relic);
      name.textContent = entry?.name ?? reward.relic;
      name.dataset['tip'] = `relic:${reward.relic}`;
      card.append(name);
      break;
    }

    /*
     * **`technique` joins the two move kinds here, and was missing for the
     * same reason `relic` was.** It is the third kind that carries a `move`,
     * `isMoveRow` in `screens/shop.ts` has always treated all three together,
     * and this switch did not — so every Technique card in the game has been
     * blank since `generation.md` section 31 made status moves reachable.
     *
     * It shares the branch rather than getting one of its own because what a
     * card does with a move is identical for all three: print the name, print
     * the copy, and append the shared move card. Only the copy differs, and
     * `MOVE_COPY` is that difference — a lookup keyed by the kind rather than a
     * chain of conditionals, so the fourth move kind adds a row instead of
     * another branch.
     */
    case 'tm':
    case 'tutor':
    case 'technique': {
      name.textContent = reward.move;
      setProse(detail, MOVE_COPY[reward.kind]);
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

  /*
   * **Currency and heal keep their words, and it is a scope line rather than
   * an oversight.** M5.1 names *"item, berry and relic cards"* and *"TM cards
   * mount the move card"*. A coins card and a restore card are neither, and
   * section 4 has no budget row for either of them — the same gap D28 found on
   * the battle header and D32 found on the locale screen, in a third place.
   * They are recorded here and in `docs/generation.md` §66 as an input to
   * M7.2, which is the item that measures every surface against a row.
   */
  if (reward.kind === 'currency' || reward.kind === 'heal') card.prepend(kind, name, detail);
  if (note.hasChildNodes()) card.append(note);
  /*
   * The boosted type stays, and it is the one thing on an item card besides
   * the sprite. It is a type chip — section 2's first glyph family, zero words
   * — and it answers the question a sprite cannot: *which* type this item is
   * for. R3 is satisfied because nothing else on the card renders the type.
   */
  if (reward.kind === 'item') {
    const entry = itemById(reward.item);
    if (entry?.boostsType) card.append(typeChip(entry.boostsType));
  }
  if (options.price !== undefined) {
    const price = el('span', 'reward__price');
    price.textContent = String(options.price);
    card.append(price);
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

/** The line under a move card's name, by which of the three move kinds it is. */
const MOVE_COPY = {
  tm: REWARD_COPY.tm,
  tutor: REWARD_COPY.tutor,
  technique: REWARD_COPY.technique,
} as const satisfies Record<Extract<Reward, { move: string }>['kind'], unknown>;

const KIND_LABELS: Record<Reward['kind'], string> = {
  item: 'Held item',
  currency: 'Coins',
  heal: 'Restore',
  tm: 'TM',
  tutor: 'Move tutor',
  technique: 'Technique',
  relic: 'Relic',
};
