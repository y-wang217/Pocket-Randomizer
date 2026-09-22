/**
 * The result screen: how the fight went, what it cost, and what it paid.
 *
 * **Item D of the Stage 4.5.2 playtest round, and it is a routing change before
 * it is a screen.** Every battle used to end one of two ways. A win that
 * carried cards went to the reward screen; a win that carried none — a gym,
 * before this stage, or any fight the player lost — went straight back to the
 * map with nothing on screen to say the node had happened. The reward screen
 * was doing double duty as the result screen, so a rewardless win read as the
 * game skipping a beat, which is exactly what the playtest reported.
 *
 * So the result is now the screen and **the cards are a section inside it**,
 * not a screen that replaces it. That inversion is the whole item. A player who
 * won a fight and got nothing still gets told they won, still sees what the
 * fight cost their party, and still has to press something to leave — which is
 * the confirmation that was missing.
 *
 * ## What it shows, and what it deliberately does not
 *
 * Outcome, the party's HP and PP as the sim left them, currency earned if any,
 * the cards if any, and one way out. The party rows are the *post-battle* state
 * rather than the post-boundary one: `resolveNode` has not run yet when this is
 * rendered, so the HP shown is the HP the fight left, before the node boundary
 * heals status or revives anyone. That is the honest number here — "this is
 * what the fight did to you" — and the map's party panel, one click later, is
 * where "this is what you are walking into the next node with" belongs.
 *
 * No verdict on the outcome. "Won" and "Defeated" are facts; "close one!" or a
 * grade would be the screen commentating on a fight the player just watched.
 *
 * ## Stage 4.6a: the capture lands here too
 *
 * A won wild encounter offers its Pokemon, and that offer is a **block inside
 * this screen** rather than a screen after it. The spec's words are "do not add
 * a second path by which a node completes", and the reason bites: the capture
 * used to arrive after the result had been dismissed, so the player judged
 * whether a Pokemon was worth a party slot with the fight it came from off
 * screen. Outcome, party, cards and offer are one view now.
 *
 * `playRun` still asks two questions in sequence — take a card, then take the
 * Pokemon — so this screen renders twice for such a node. The second render
 * carries the same review and no cards, because they have already been taken.
 */
import type { AcquisitionDecision, AcquisitionOffer } from '../../core/acquisition';
import {
  CARDS_ONLY_BLURB,
  CARDS_ONLY_TITLE,
  currencyLine,
  FAINTED,
  faintedLine,
  hpStateBare,
  outcomeTitle,
  RUN_ENDS,
  TAKE_ONE,
} from '../../core/hpCopy';
import { statusChip } from '../chip';
import { ppTotals } from '../../core/party';
import type { RewardOffer } from '../../core/rewards';
import { partyCapacity, type BattleReview, type RunState } from '../../core/run';
import type { BattleMemberState, PokemonState } from '../../core/types';
import { el } from '../scene';
import { renderSlots } from '../slots';
import { renderCaptureOffer } from './acquisition';
import { renderEvolutionBlock, type EvolutionPrompt } from './evolution';
import { offerBadge, renderRewardCard } from './reward';

/**
 * A Pokemon on the table, and the party it is being weighed against.
 *
 * Carries the party rather than reading it off `state`, because the two are not
 * the same at the moment this is asked: `playRun` hands `chooseAcquisition` the
 * party as it stands *before* the node resolves, which is the party the player
 * is looking at on this screen.
 */
export interface CapturePrompt {
  offer: AcquisitionOffer;
  party: readonly PokemonState[];
  onDecide: (decision: AcquisitionDecision) => void;
}

export interface ResultScreen {
  root: HTMLElement;
  /**
   * Draw a battle result.
   *
   * `review` is null in the one case that is not a battle result: `app.ts`'s
   * `chooseReward` fallback, which exists because `RunPolicy` requires that
   * method even though `playRun` routes battles through `reviewBattle`. Then
   * the screen is the cards alone — the shape it had before this stage.
   *
   * `capture` is the Stage 4.6a block. When it is present the reward cards are
   * gone, because by then they have been taken.
   */
  render(
    review: BattleReview | null,
    offer: RewardOffer | null,
    state: RunState,
    onDone: (index: number | null) => void,
    capture?: CapturePrompt | null,
    /**
     * The evolutions a gym clear applies, and the fork if one is open. Stage
     * 4.9. Between the party and the cards: the party as the fight left it,
     * then what the clear does to it, then what the clear pays.
     */
    evolution?: EvolutionPrompt | null,
  ): void;
}

export function createResultScreen(): ResultScreen {
  const root = el('section', 'screen screen--result');

  /*
   * One line of header. Stage V4: the outcome word, the cost line and the
   * coins earned as a chip sit on one row, so the cards and the capture
   * offer, which are the decisions on this screen, start higher and stay
   * above the fold on a phone.
   */
  const header = el('div', 'result__header');
  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  header.append(title, blurb);

  /*
   * **The party heading is gone, element and all. M5.4.**
   *
   * *"Your party"*, and after a battle *"Your party after the battle"* — two
   * to five words labelling a row of party cards that are unmistakably the
   * party. R2 deletes field labels, and a heading over the only thing it could
   * be describing is one.
   *
   * **Removed rather than hidden**, which M5.3 learned the expensive way one
   * item ago: `hidden` is a UA style and any author `display` rule beats it,
   * so an element hidden that way still lays out. `test/visual-inline-box.test.ts`
   * exists for that trap and `ui/overlay.ts` documents it three times.
   */
  // The party as the fight left it, as the V2 slot row: one slot a member,
  // HP and PP as the slot's detail line. Stage V4.
  const party = el('div', 'result__party');

  const evolution = el('div', 'result__evolution');
  evolution.dataset['tutorial'] = 'evolution';

  const cardsHeading = el('h3', 'result__heading');
  const cards = el('div', 'rewards');
  cards.dataset['tutorial'] = 'rewards';

  const capture = el('div', 'result__capture');
  capture.dataset['tutorial'] = 'capture';
  const actions = el('div', 'result__actions');

  root.append(header, party, evolution, cardsHeading, cards, capture, actions);

  return {
    root,
    render(review, offer, state, onDone, capturePrompt, evolutionPrompt) {
      const won = review?.won ?? true;

      if (review) {
        title.textContent = outcomeTitle(won);
        title.dataset['outcome'] = won ? 'win' : 'loss';
        blurb.textContent = describeCost(review, state);
      } else {
        title.textContent = CARDS_ONLY_TITLE;
        delete title.dataset['outcome'];
        blurb.textContent = CARDS_ONLY_BLURB;
      }

      // The party as the fight left it. Hidden on the cards-only path, where
      // there is no fight to report the cost of.
      party.hidden = !review;
      party.replaceChildren(
        renderSlots(
          'party',
          (review?.party ?? []).map((member) => ({
            label: member.spec.species,
            item: member.item ?? null,
            detail: memberReading(member),
          })),
          review?.party.length ?? 0,
        ),
      );
      for (const [index, member] of (review?.party ?? []).entries()) {
        const slot = party.querySelectorAll<HTMLElement>('.slot')[index];
        if (slot && member.status) slot.append(statusChip(member.status));
        if (slot && member.fainted) slot.dataset['fainted'] = 'true';
      }

      /*
       * The evolution block, Stage 4.9. Present on a gym clear that levels the
       * party, with the records the clear has decided and the fork if one is
       * open. Cleared rather than hidden for the same reason the cards are.
       */
      const showEvolution = Boolean(evolutionPrompt && (evolutionPrompt.records.length > 0 || evolutionPrompt.question));
      evolution.hidden = !showEvolution;
      if (showEvolution && evolutionPrompt) {
        evolution.replaceChildren(renderEvolutionBlock(evolutionPrompt));
      } else {
        evolution.replaceChildren();
      }

      cardsHeading.hidden = !offer;
      cards.hidden = !offer;
      if (offer) {
        cardsHeading.replaceChildren(document.createTextNode(TAKE_ONE), offerBadge(offer.badge));
        cards.replaceChildren(
          ...offer.options.map((option, index) =>
            renderRewardCard(option, state, () => onDone(index)),
          ),
        );
      } else {
        // Cleared, not just hidden. `hidden` is a UA style that any `display`
        // rule overrides — see the note in styles.css — and a stale card left
        // in the DOM is a button that answers a question already asked.
        cardsHeading.replaceChildren();
        cards.replaceChildren();
      }

      /*
       * The capture block, below the cards and above the actions.
       *
       * Below, because the cards are the payout for the fight and the capture
       * is a separate question about the party — and because on the second
       * render, which is the one that carries this, there are no cards at all.
       */
      capture.hidden = !capturePrompt;
      if (capturePrompt) {
        capture.replaceChildren(
          renderCaptureOffer(
            capturePrompt.offer,
            capturePrompt.party,
            capturePrompt.onDecide,
            // The slots the run has now, not a constant: a capture resolving in
            // the same segment a gym unlocked a slot must see the new one.
            partyCapacity(state),
          ),
        );
      } else {
        capture.replaceChildren();
      }

      /*
       * The continue action exists only when there is nothing to pick.
       *
       * With an offer, taking a card *is* the continue — and a screen with
       * three cards and a "Continue" button beside them would read as though
       * skipping were allowed, which it is not. Without one, this button is the
       * whole point of the screen: the confirmation a rewardless win never got.
       */
      if (offer || capturePrompt || evolutionPrompt?.question) {
        // With a capture on screen, "Take it" and "Leave it" are the continue,
        // exactly as taking a card is when the cards are up, and as choosing a
        // branch is when a fork is open. A third button beside them would read
        // as though the offer could be postponed.
        actions.replaceChildren();
      } else {
        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button primary-action';
        carry.textContent = won ? 'Carry on' : 'See how it ended';
        carry.addEventListener('click', () => onDone(null));
        actions.replaceChildren(carry);
        carry.focus();
      }
    },
  };
}

/**
 * One line on what the node did to the run.
 *
 * Currency and casualties, both facts. A node that paid nothing and cost
 * nothing says so rather than rendering an empty line — "nothing happened" is
 * information, and a blank space is the bug it would look like.
 */
/**
 * What a completed node says, in order. **Stage 4.7, Part 4.**
 *
 * The brief's order, and every line is stated rather than implied:
 *
 *   1. The outcome — that is the title, above.
 *   2. **Currency earned at this node and the new total.** The total is the
 *      addition: it is the number the next shop decision is made on, and a
 *      player adding two figures in their head is doing arithmetic instead of
 *      deciding.
 *   3. Party HP and PP per member — the block below this line.
 *   4. Then the three cards, inside this screen rather than replacing it.
 *
 * `state.currency` is the balance *before* `resolveNode` folds the payout in —
 * the screen is shown first, deliberately, so "you earned 40" is a fact about
 * the node and the total beside it is what the run will hold when it lands.
 *
 * Every string comes from `core/hpCopy.ts`, which is the copy module the round
 * 2 patch established, and none is inlined here.
 */
function describeCost(review: BattleReview, state: RunState): string {
  const fainted = review.party.filter((member) => member.fainted).length;
  const parts: string[] = [currencyLine(review.currencyEarned, state.currency + review.currencyEarned)];
  /*
   * **`Nobody went down.` is gone, and R4 is the whole argument. M5.4.**
   *
   * R4 is exception-based display: *"show a value only when it departs from
   * the default."* Nobody fainting is the default, and three words announcing
   * it fired on the majority of result screens in the game. What replaces it
   * is nothing, which is what R4 means by a default rendering nothing.
   *
   * **The non-zero case stays**, because that one is the exception and it
   * carries the revive rule with it. It is also a case the census fixture
   * cannot produce — `SMOKE24`'s reviewed battle loses nobody — so the number
   * below is measured without it, and this comment is the record of that
   * rather than a claim the screen is at 6 in every state.
   */
  if (fainted > 0) parts.push(faintedLine(fainted));
  if (!review.won) parts.push(RUN_ENDS);
  return parts.join(' · ');
}

/**
 * HP and PP as the fight left them, for a slot's detail line.
 *
 * **Bare, since M5.4.** This read `12 / 30 HP (40%) · PP 18/24` — and `HP` and
 * `PP` are two of the six field labels **R2 names by name** in its forbids
 * list, drawn once per member, so six party slots spent twelve words on a
 * screen budgeted at 6.
 *
 * `hpStateBare` already existed for exactly this, described in `core/hpCopy.ts`
 * as *"the same without the unit, for a panel that already says HP in its
 * heading"*. The heading is gone too now, and what says HP is position: R1's
 * fixed slot, the same one on every member, in the same order every time.
 *
 * PP keeps its unit as the **glyph**, which is section 3's encoding — *"PP |
 * Number beside PP glyph"* — so the one place the two numbers could be
 * confused for each other is the one place a mark is spent.
 */
function memberReading(member: BattleMemberState): string {
  const pp = ppTotals(member);
  return member.fainted
    ? `${FAINTED} · ${pp.pp}/${pp.maxPp}`
    : `${hpStateBare(member.hp, member.maxHp)} · ${pp.pp}/${pp.maxPp}`;
}
