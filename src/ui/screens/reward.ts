/**
 * The reward screen: three cards, one pick, no skip and no reroll.
 *
 * The absence of a skip button is the design, not an omission. A reward you can
 * decline is a reward with no cost, and the moment one exists the interesting
 * question — *which of these three is worth the most to this run* — collapses
 * into "take the obviously good one, skip otherwise". Three cards and a forced
 * choice is what makes a normal node's payout feel like a normal node's payout.
 *
 * **Since Stage 5.0/3 (D66) a card's face is its mark**: the sprite, the
 * relic's icon, the move card, `+N` beside a coin. What a card is called and
 * what it does are one long press away, and nowhere else. The claim is a tap
 * and then the band's commit (D69), in `renderOfferCards` below.
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
import { CAPABILITY_LABELS } from '../../data/eventCopy';
import { assetIcon } from '../assets/manifest';
import { openBand } from '../band';
import { createBar } from '../bar';
import { capabilityGlyph, coinAmount, tierChip } from '../chip';
import { CLAIM_COPY } from '../copy/screens';
import { el, moveCard } from '../scene';
import { itemIcon } from '../slots';
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
   * The coins held, when the caller knows a balance `state` does not yet.
   * **The opening playtest QA, QA-003.**
   *
   * The result screen is shown before `resolveNode` folds the node's payout
   * in, so `state.currency` there is the balance the fight was entered with:
   * the header read `+13 · 13` and the coins card beside it `Carrying 0`. The
   * screen passes the balance its own header prints. The shop omits it,
   * because a shop's state is already the live one.
   */
  carrying?: number;
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
  /**
   * Draw the card as content rather than a control: a `div` with no click.
   * The claim band's copy of the selected card (Stage 5.0/3, D69).
   */
  inert?: boolean;
}

export function renderRewardCard(
  reward: Reward,
  state: RunState,
  onPick: () => void,
  options: RewardCardOptions = {},
): HTMLElement {
  const tuning = state.tuning;
  /*
   * A button on a screen, a `div` inside the claim band. The band's copy is
   * the content being traded, not a second control for it (Stage 5.0/3, D69).
   */
  const card = document.createElement(options.inert ? 'div' : 'button');
  if (card instanceof HTMLButtonElement) card.type = 'button';
  card.className = `reward reward--${reward.kind}`;
  card.dataset['kind'] = reward.kind;

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
     * `itemIcon` is the same cell of the same Showdown sheet the party slots,
     * the battle panel and the party row draw (M3.1, M3.2), so an item looks
     * the same wherever it appears. The `item:` tip is the same one the party
     * row's held-item slot carries, so the press opens the same panel from the
     * same table.
     */
    case 'item': {
      const slot = el('span', 'reward__sprite');
      slot.append(itemIcon(reward.item));
      slot.dataset['tip'] = `item:${reward.item}`;
      card.append(slot);
      /*
       * The boosted type is the one thing on an item card besides the sprite.
       * It is a type chip, section 2's first family and zero words, and it
       * answers the question a sprite cannot: *which* type this item is for.
       */
      const entry = itemById(reward.item);
      if (entry?.boostsType) card.append(typeChip(entry.boostsType));
      break;
    }

    /*
     * **Coins and restore are a mark and a bare number. Stage 5.0/3, D66.**
     *
     * They were the two kinds with no section 4 row, and kept a kind label, a
     * title, a line and a note (M5.1 left them, §66). Rev 17 gives each a row
     * at 0: `+N` beside the currency glyph, `+N%` beside a bar filled to it.
     * The word *coins*, the balance (QA-003) and what a restore restores are
     * the long press, from the same copy the face used to print.
     */
    case 'currency': {
      const face = coinAmount(`+${reward.amount}`, 'reward__amount');
      card.dataset['tip'] = `coins:${reward.amount}`;
      card.dataset['detail'] = String(options.carrying ?? state.currency);
      card.append(face);
      break;
    }

    case 'heal': {
      const percent = Math.round(reward.fraction * 100);
      const bar = createBar({ variant: 'neutral' });
      bar.set(Math.min(1, reward.fraction), { chunk: false });
      const amount = el('span', 'reward__amount');
      amount.textContent = `+${percent}%`;
      card.dataset['tip'] = `restore:${percent}`;
      card.append(bar.root, amount);
      break;
    }

    /*
     * **The relic face is its icon and the capability it satisfies. Stage
     * 5.0/3, D65 and D66.**
     *
     * Until Rev 17 the name was the encoding, a recorded deviation (D36),
     * because no relic art existed. The asset manifest carries a relic icon
     * for every relic now, placeholder or drawing, so section 3's *"relic
     * sprite"* is literal and the name joins the effect on the long press.
     *
     * The capability glyph is the map node's own (`capabilityGlyph`), without
     * the band chevron: the chevron is where the *run* stands against a
     * capability, and a card is not the run. D65: a glyph costs no word, so
     * the reason the capability chip left this card does not reach it.
     */
    case 'relic': {
      const entry = relicById(reward.relic);
      const icon = el('span', 'reward__sprite reward__relic');
      icon.append(assetIcon(`relic:${reward.relic}`));
      icon.dataset['tip'] = `relic:${reward.relic}`;
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', entry?.name ?? reward.relic);
      card.append(icon);
      if (entry?.grants) card.append(capabilityGlyph(entry.grants, CAPABILITY_LABELS[entry.grants]));
      break;
    }

    /*
     * **The three move kinds mount the move card, and nothing else. Stage
     * 5.0/3, D67 and D71.**
     *
     * The move card is the face: name, type chip, category, base power, PP,
     * band pips, accuracy, priority and the fact strip, through the component
     * the battle screen uses. No TM disc (D71): the chip already says the
     * type, and a type-coloured disc would say it twice (R3).
     *
     * **No holder is passed, and that is the STAB rule.** A reward card is
     * unassigned until `chooseMoveRecipient` answers, so a STAB tag here would
     * be claiming something not yet true.
     */
    case 'tm':
    case 'tutor':
    case 'technique': {
      const facts = describeMove(reward.move);
      if (facts) card.append(moveCard(moveCardData(facts, tuning)));
      break;
    }
  }

  /*
   * The shop's price, beside the currency glyph (D54). A bare number, which
   * section 4's counting rule excludes.
   */
  if (options.price !== undefined) card.append(coinAmount(String(options.price), 'reward__price'));

  if (!options.inert) card.addEventListener('click', onPick);
  return card;
}

/**
 * Three cards and one claim. **Stage 5.0/3, D69.**
 *
 * The prompt asked for *"selection cursor on the picked card, confirm to
 * claim"*, and D69 ruled how that stays an attribute rather than a verdict:
 *
 * - **No card is selected at rest.** A cursor resting on one of three cards
 *   before any input is emphasis, which C1 forbids. `aria-pressed` is false
 *   on all three until the player taps one.
 * - **A tap selects and opens the band**, with the selected card as its
 *   content, because the dim covers the row. The band's commit is the claim.
 * - **The band's cancel returns to the three cards** and clears the
 *   selection. It never leaves the offer: CLAUDE.md allows no skip at the
 *   card, so there is no decline here to confuse it with.
 * - **The selection never reaches the run.** `onClaim` is called once, on the
 *   commit, so the run log records the same single reward decision it always
 *   has and a reload between the tap and the commit asks the question again.
 */
export function renderOfferCards(
  options: readonly Reward[],
  state: RunState,
  onClaim: (index: number) => void,
  cardOptions: RewardCardOptions = {},
): HTMLElement[] {
  let claimed = false;
  const cards: HTMLElement[] = [];
  const select = (index: number | null): void => {
    for (const [i, card] of cards.entries()) {
      card.setAttribute('aria-pressed', String(i === index));
      if (i === index) card.dataset['selected'] = 'true';
      else delete card.dataset['selected'];
    }
  };
  for (const [index, reward] of options.entries()) {
    const card = renderRewardCard(
      reward,
      state,
      () => {
        if (claimed) return;
        select(index);
        openBand({
          title: CLAIM_COPY.title,
          content: renderRewardCard(reward, state, () => undefined, { ...cardOptions, inert: true }),
          confirm: CLAIM_COPY.confirm,
          cancel: CLAIM_COPY.cancel,
          onConfirm: () => {
            if (claimed) return;
            claimed = true;
            onClaim(index);
          },
          onCancel: () => {
            select(null);
            card.focus();
          },
        });
      },
      cardOptions,
    );
    card.setAttribute('aria-pressed', 'false');
    cards.push(card);
  }
  return cards;
}

/*
 * `coverageLine` lived here, on the species card, and went with it in Stage
 * 4.6b. The reading it produced did not: `screens/acquisition.ts` prints the
 * same sentence from the same pure function on the capture card, which is where
 * "what would this change about my party" belongs now that capture is the only
 * way a party member arrives.
 */
