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
import { describeMove, describeSpecCard } from '../../core/battle/driver';
import { archetypeChip } from '../archetype-chip';
import { FAINTED_REVIVES, hpState } from '../../core/hpCopy';
import { hpFraction, replacementNeeded } from '../../core/party';
import type { TargetedReward } from '../../core/rewards';
import { describeReward } from '../../core/rewards';
import type { PokemonState } from '../../core/types';
import type { Tuning } from '../../data/tuning';
import { moveCardData } from '../move-detail';
import { el, moveCard } from '../scene';
import { setProse, type Prose } from '../dom';
import { TARGET_COPY, TARGET_EFFECT } from '../copy/screens';
import { typeChip } from './starter-select';

export interface ItemTargetScreen {
  root: HTMLElement;
  render(
    reward: TargetedReward,
    party: readonly PokemonState[],
    onTarget: (slot: number) => void,
    /** For `tuning.maxMoveTagsOnFace`. See `ui/move-detail.ts`. */
    tuning: Tuning,
  ): void;
}

export function createItemTargetScreen(): ItemTargetScreen {
  const root = el('section', 'screen screen--target');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  const offer = el('div', 'target__move');
  const list = el('div', 'party party--target');

  root.append(title, blurb, offer, list);

  return {
    root,
    render(reward, party, onTarget, tuning) {
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
  // The species. 4.8.0.1: the recipient is picked by what it is, and the
  // nickname is state this screen does not show.
  name.textContent = detail.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${detail.level}`;
  header.append(name, level, archetypeChip(detail.baseStats), ...detail.types.map(typeChip));

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  hp.textContent = member.fainted ? FAINTED_REVIVES : hpState(member.hp, member.maxHp);
  meta.append(hp);

  const effect = el('span', 'target__effect');
  setProse(effect, effectOn(reward, member));

  button.append(header, track, meta, effect);
  button.addEventListener('click', () => onTarget(index));
  return button;
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
