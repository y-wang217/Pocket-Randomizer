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
import { FAINTED, hpState, ppState } from '../../core/hpCopy';
import { hpFraction, ppTotals } from '../../core/party';
import type { RewardOffer } from '../../core/rewards';
import type { BattleReview, RunState } from '../../core/run';
import type { PokemonState } from '../../core/types';
import { el } from '../scene';
import { renderCaptureOffer } from './acquisition';
import { renderRewardCard, tierBadge } from './reward';

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
  ): void;
}

export function createResultScreen(): ResultScreen {
  const root = el('section', 'screen screen--result');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');

  const partyHeading = el('h3', 'result__heading');
  partyHeading.textContent = 'Your party';
  const party = el('div', 'result__party');

  const cardsHeading = el('h3', 'result__heading');
  const cards = el('div', 'rewards');

  const capture = el('div', 'result__capture');
  const actions = el('div', 'result__actions');

  root.append(title, blurb, partyHeading, party, cardsHeading, cards, capture, actions);

  return {
    root,
    render(review, offer, state, onDone, capturePrompt) {
      const won = review?.won ?? true;

      if (review) {
        title.textContent = won ? 'Victory' : 'Defeated';
        title.dataset['outcome'] = won ? 'win' : 'loss';
        blurb.textContent = describeCost(review);
      } else {
        title.textContent = 'Choose a reward';
        delete title.dataset['outcome'];
        blurb.textContent = 'One of the three. There is no skip.';
      }

      // The party as the fight left it. Hidden on the cards-only path, where
      // there is no fight to report the cost of.
      partyHeading.hidden = !review;
      party.hidden = !review;
      party.replaceChildren(...(review?.party ?? []).map((member) => renderMemberRow(member)));

      cardsHeading.hidden = !offer;
      cards.hidden = !offer;
      if (offer) {
        cardsHeading.replaceChildren(document.createTextNode('Take one '), tierBadge(offer.tier));
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
          renderCaptureOffer(capturePrompt.offer, capturePrompt.party, capturePrompt.onDecide),
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
      if (offer || capturePrompt) {
        // With a capture on screen, "Take it" and "Leave it" are the continue,
        // exactly as taking a card is when the cards are up. A third button
        // beside them would read as though the offer could be postponed.
        actions.replaceChildren();
      } else {
        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button button--primary';
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
function describeCost(review: BattleReview): string {
  const parts: string[] = [];
  if (review.currencyEarned > 0) parts.push(`+${review.currencyEarned} coins`);

  const down = review.party.filter((member) => member.fainted).length;
  if (down > 0) parts.push(`${down} fainted — they revive at the next node`);

  if (!review.won) return parts.length > 0 ? parts.join(' · ') : 'The run ends here.';
  return parts.length > 0 ? parts.join(' · ') : 'No coins, and nobody went down.';
}

/**
 * A party member as the fight left it: HP as a bar and a number, and PP.
 *
 * The same card shape as the map's party panel rather than a lighter one, so
 * the player is comparing like with like across the two screens. PP is here
 * because it is the resource a run spends that nothing else on this screen
 * would show — HP is visible on the battle screen up to the last turn, and PP
 * is the one that quietly runs out four fights later.
 */
function renderMemberRow(member: PokemonState): HTMLElement {
  const row = el('div', 'party__member');

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = member.spec.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${member.spec.level}`;
  header.append(name, level);

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const text = el('span', 'panel__hp-text');
  const pp = ppTotals(member);
  text.textContent = member.fainted
    ? `${FAINTED} · ${ppState(pp.pp, pp.maxPp)}`
    : `${hpState(member.hp, member.maxHp)} · ${ppState(pp.pp, pp.maxPp)}`;
  meta.append(text);

  if (member.status) {
    const status = el('span', 'badge badge--status');
    status.dataset['status'] = member.status;
    status.textContent = member.status.toUpperCase();
    meta.append(status);
  }

  row.append(header, track, meta);
  return row;
}
