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
import { describeMove } from '../../core/battle/driver';
import { replacementNeeded } from '../../core/party';
import type { TargetedReward } from '../../core/rewards';
import { describeReward } from '../../core/rewards';

/**
 * What this screen submits when the player backs out of a teach.
 *
 * **A UI constant now, where `rewards.DECLINED_MOVE` was a core one.** The old
 * sentinel was a legal value in the run log: a gym's move could be handed back
 * and the log recorded that refusal as a `target` entry carrying -1. No move is
 * taught at a node any more, so nothing records a recipient and this never
 * leaves the screen — it travels from here to whoever opened it and no further.
 *
 * Still -1, and still for the reason the old one gave: it must not be a number
 * a party could grow into, and a negative index never is.
 */
export const TEACH_CANCELLED = -1;
import type { PokemonState } from '../../core/types';
import type { Tuning } from '../../data/tuning';
import { openBand } from '../band';
import { memberCardContents } from '../member-card';
import { moveCardData } from '../move-detail';
import { el, moveCard } from '../scene';
import { setProse, type Prose } from '../dom';
import { TARGET_COPY, TARGET_EFFECT } from '../copy/screens';

export interface ItemTargetScreen {
  root: HTMLElement;
  render(
    reward: TargetedReward,
    party: readonly PokemonState[],
    onTarget: (slot: number) => void,
    /** For `tuning.maxMoveTagsOnFace`. See `ui/move-detail.ts`. */
    tuning: Tuning,
    /**
     * Whether this move may be handed back, from `RunPolicy.chooseMoveRecipient`.
     *
     * True at the gym's guaranteed move and nowhere else. The screen renders a
     * decline control when it is set and must not when it is not — a control
     * that submitted `DECLINED_MOVE` to a question with no decline in it would
     * put a value in the run log that `askMoveQuestions` refuses, and the run
     * would throw rather than skip.
     */
    allowSkip?: boolean,
  ): void;
}

export function createItemTargetScreen(): ItemTargetScreen {
  const root = el('section', 'screen screen--target');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  const offer = el('div', 'target__move');
  const list = el('div', 'party party--target');
  const decline = el('div', 'target__decline-row');

  root.append(title, blurb, offer, list, decline);

  return {
    root,
    render(reward, party, onTarget, tuning, allowSkip = false) {
      title.textContent = describeReward(reward);
      // Items no longer reach this screen — they go to the backpack and are
      // assigned on the party screen, where the choice is free and reversible.
      // What is left is the two cards that teach a move, and that choice is
      // neither. See `rewards.isTargeted`.
      setProse(blurb, TARGET_COPY.blurb);

      /*
       * The move itself, as the same card the reward screen draws. **Patch
       * 4.8.0.2.** Stage 4.8 made the gym's move a grant rather than an offer,
       * so it skips the reward screen — the one surface that described a
       * tutor — and the first thing a player saw of it was this title. A
       * player choosing between a physical attacker and a special one needs
       * the category, the type and the power in front of them, and the card's
       * `Explain` panel carries what each category reads off.
       *
       * **No holder is passed, and that is the STAB rule** (`ui/move-detail.ts`):
       * nobody has been picked yet. The card is drawn outside the member
       * buttons, so its expander cannot reach one — `moveExplanation` stops the
       * event regardless, and `test/visual-move-cards.test.ts` counts this as
       * the seventh surface.
       */
      const facts = describeMove(reward.move);
      offer.replaceChildren(...(facts ? [moveCard(moveCardData(facts, tuning))] : []));

      list.replaceChildren(...party.map((member, index) => renderTarget(reward, member, index, tuning, onTarget)));

      /*
       * The decline, **after** the members and never among them.
       *
       * Below rather than beside, because it is a different kind of answer: the
       * six buttons above are "this one", and this one is "none". A seventh
       * card in the grid would read as a seventh Pokemon, and on a phone it
       * would be the one under the thumb.
       *
       * It carries no marker of any kind and sits in no order that implies one.
       * Whether handing a move back is the right call is exactly the judgement
       * the copy rule reserves for the player.
       */
      decline.replaceChildren();
      if (allowSkip) {
        const button = document.createElement('button');
        button.type = 'button';
        /*
         * **`decline` is the shared kind; `target__decline` is this screen's
         * shape. Milestone M5.5.**
         *
         * A *flow decline* answers the screen's question with "none" and moves
         * the run on. A *band cancel* backs out of the confirm and changes
         * nothing. The item's last line asks for the two to be visually
         * distinct, and they are on screen together exactly once: while the
         * band this control opens is up. `styles.css` carries the rule under
         * `body[data-band-open]`; the class is what lets one rule cover both
         * screens that have one of these rather than two rules naming two
         * blocks.
         *
         * **No `button` class, deliberately.** `.button` is defined after
         * `.target__decline` in `styles.css` and carries its own background
         * and border at equal specificity, so adding it here would silently
         * take this control's card shape away by source order alone. The
         * shape is what makes it read as one of the answers above it.
         */
        button.className = 'decline target__decline';
        const label = el('span', 'target__decline-label');
        setProse(label, TARGET_COPY.decline);
        button.append(label);
        /*
         * The confirm, through the one band. **Milestone M3.3.**
         *
         * The note under this control used to spell out what declining costs —
         * *"Nobody learns this move. It is not offered again."* — at rest, on
         * every render, for a control most runs never press. The record moves
         * that to a confirm: *"Decline copy: 'Forfeit this reward?' with the
         * two cards."*
         *
         * `ui/band.ts` is that component and M2.3 gave it the `content` slot
         * this uses, so the card being forfeited is in front of the player
         * when the question is asked rather than remembered from the screen
         * behind it. One card, not two: a replace trades a move for a move
         * and a decline gives one up for nothing, and drawing a second card
         * would be inventing a thing on the other side of the trade.
         *
         * `onCancel` does nothing on purpose. Backing out of a confirm returns
         * to the screen, and the screen is unchanged — `openBand` closes
         * itself and nothing here has committed.
         */
        button.addEventListener('click', () => {
          const forfeited = describeMove(reward.move);
          openBand({
            title: TARGET_COPY.forfeitTitle.short,
            confirm: TARGET_COPY.forfeitConfirm.short,
            cancel: TARGET_COPY.forfeitCancel.short,
            ...(forfeited ? { content: moveCard(moveCardData(forfeited, tuning)) } : {}),
            onConfirm: () => onTarget(TEACH_CANCELLED),
          });
        });
        decline.append(button);
      }
    },
  };
}

/**
 * One recipient, as the party row plus the control that picks it.
 * **Milestone M3.3.**
 *
 * The record asks for the party row *unchanged* — section 5 canonises it and
 * lists the teach target among its call sites — and this screen had been
 * hand-rolling its own card since Stage 4.5.1: its own header, its own level,
 * its own archetype chip, its own HP line. That is the defect section 5 closes
 * with, and mounting the component takes `Lv`, the label and the archetype off
 * this surface for free, because M3.2 already took them off the component.
 *
 * **A wrapper and a sibling button, not a card inside a `<button>`.** The card
 * was a `<button>` and the party row is full of focusable things — the fold
 * toggle, six stat labels with `role="button"`, four move cards that are
 * inspect triggers since M2.1 — and nesting those inside a button is invalid
 * and takes the keyboard path to every one of them. `screens/pre-gym.ts` had
 * the shape already: a slot wrapper, the component, and a control beside it.
 * That is what this uses, so the two screens that ask "which member" ask it
 * the same way.
 */
function renderTarget(
  reward: TargetedReward,
  member: PokemonState,
  index: number,
  tuning: Tuning,
  onTarget: (slot: number) => void,
): HTMLElement {
  const wrapper = el('div', 'target__slot');

  const card = memberCardContents(member, {
    holding: member.item ?? null,
    tuning,
    index,
  });
  card.classList.add('party__member--target');

  /*
   * The pairing line, **beside the card rather than inside it**, and that is
   * what let M3.3 keep it.
   *
   * The done-when asks for 0 words on the *target card*. This line is not a
   * fact about the member — it is a fact about this member **and this reward
   * together**, which is why the screen exists at all and why a hand-rolled
   * card was carrying it. Mounting the component puts it where it belongs: the
   * card is the party row at 0, and the pairing is the screen's.
   *
   * **It could not have been dropped.** The plan was to delete it and let the
   * four move cards say the same thing — four means "you will choose a
   * replacement", three means "free slot". Measured at 390x844: a party card
   * folds to 92.9px in Pocket and opens to 514.0px, of which the four move
   * cards are 376.2px. Six of them unfolded is about 1542px against an 844
   * viewport, and the first card plus the pinned move already passes the fold.
   * So the moves cannot be at rest here, the fact would have gone behind a tap
   * on the screen whose only question it answers, and that is C2.
   */
  const effect = el('span', 'target__effect');
  setProse(effect, effectOn(reward, member));

  const choose = document.createElement('button');
  choose.type = 'button';
  choose.className = 'button button--small target__choose';
  /*
   * A fainted member is a legal target — it revives at the next node and keeps
   * whatever it was given — so this is never disabled, and the card's own HP
   * line is where "fainted" is said. A button that looks broken teaches worse
   * than one that explains itself, and a second word for it here would be the
   * same fact twice on one card.
   */
  setProse(choose, TARGET_COPY.choose);
  choose.addEventListener('click', () => onTarget(index));

  wrapper.append(card, effect, choose);
  return wrapper;
}

/**
 * What this card would do to this member, in one line. **Facts only.**
 *
 * Rewritten in Stage 4.5.1, and most of what came out was a verdict rather
 * than a fact. The old version compared the incoming move's base power against
 * the member's weakest and strongest attacks and said things like "their new
 * best attack (95 BP, up from 60)" and "no use — weaker than every attack
 * Snorlax already has". Part 4 forbids exactly that: **a move card must not
 * indicate which of the player's current moves it would improve on.** The base
 * powers of all five moves are on the next screen, side by side, in the same
 * component; the player does the comparison.
 *
 * What is left is the one thing that is genuinely a fact about the pairing and
 * not a judgement of it — whether this member will be asked a second question
 * at all. `replacementNeeded` is the same function `playRun` gates the prompt
 * on, so the line and the flow cannot disagree.
 */
function effectOn(reward: TargetedReward, member: PokemonState): Prose {
  const need = replacementNeeded(member, reward.move);
  if (need === 'known') return TARGET_EFFECT.known(reward.move);
  if (need === 'free') return TARGET_EFFECT.free(reward.move);
  return TARGET_EFFECT.choose(reward.move);
}
