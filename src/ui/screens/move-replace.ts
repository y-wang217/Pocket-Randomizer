/**
 * What it costs you: the move-replacement screen.
 *
 * The second half of a move reward, and until now the half the player never
 * got to make. `core/run.ts` has asked `chooseMoveToReplace` since Stage
 * 4.5.1 and the run log has carried the answer, but `ui/app.ts` auto-answered
 * it with `defaultMoveReplacement` — the reference heuristic the scripted
 * baseline uses — so the reward screen's "you choose what it replaces next"
 * was a promise the app did not keep. This screen keeps it.
 *
 * **Five moves in one component, and no verdict anywhere.** Part 4's rule is
 * that a move card must not indicate which of the player's current moves it
 * would improve on, so this screen ranks nothing, sorts nothing, and colours
 * nothing by quality. It puts the incoming move and the four it could displace
 * side by side in the same card shape — name, type, category, base power, PP —
 * and the comparison is the player's to make. That is the whole decision, and
 * decorating it with an arrow would be the UI making it instead.
 *
 * **There is no decline**, which is why there is no cancel button. The place
 * to skip a move reward is the reward screen, where it was already chosen over
 * two alternatives; `core/party.ts`'s `teachMove` throws rather than quietly
 * doing nothing if it is handed a full moveset with no slot, and that is the
 * contract this screen exists to satisfy.
 *
 * **And no heading that reads like one.** Until patch 4.8.0.2 the label over
 * the four current moves said `Give up` — a section heading, styled like every
 * other, and the first thing a playtester tapped, expecting it to be the
 * decline this screen does not have. A heading over a row of buttons must
 * describe the row, not issue an instruction the row does not carry; the four
 * cards are the control, and each says `Replace <move>` to a screen reader.
 *
 * Reached only when `party.replacementNeeded` says `'choose'`. A member with a
 * free slot or one that already knows the move never gets here — `playRun`
 * gates the question on the same function the target screen's one-liner reads,
 * so the flow and the copy cannot disagree.
 */
import { describeSpecCard } from '../../core/battle/driver';
import type { MoveSpec, MoveView, PokemonState } from '../../core/types';
import { el, genderMark, moveCard, moveFacts } from '../scene';
import { moveCardData } from '../move-detail';
import type { Tuning } from '../../data/tuning';
import { typeChip } from './starter-select';

export interface MoveReplaceScreen {
  root: HTMLElement;
  render(
    member: PokemonState,
    incoming: MoveSpec,
    onReplace: (slot: number) => void,
    /** For `tuning.maxMoveTagsOnFace`. See `ui/move-detail.ts`. */
    tuning: Tuning,
  ): void;
}

export function createMoveReplaceScreen(): MoveReplaceScreen {
  const root = el('section', 'screen screen--replace');

  const title = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');

  const incomingHeading = el('h3', 'replace__heading');
  incomingHeading.textContent = 'Learning';
  const incomingSlot = el('div', 'replace__incoming');

  const owner = el('div', 'replace__owner');

  const currentHeading = el('h3', 'replace__heading');
  currentHeading.textContent = 'Currently knows — tap one to replace';
  const current = el('div', 'replace__moves');

  root.append(title, blurb, incomingHeading, incomingSlot, owner, currentHeading, current);

  return {
    root,
    render(member, incoming, onReplace, tuning) {
      const detail = describeSpecCard(member.spec);

      title.textContent = `${detail.name} learns ${incoming.name}`;
      blurb.textContent = 'Four moves already. Pick the one it replaces — this cannot be undone.';

      /*
       * The incoming move, with its tags, **and now with STAB** — because on
       * this screen the recipient has been chosen. That is the whole of Part
       * 6b's contextual rule: the same card carries no STAB tag on the reward
       * screen one click earlier, where nobody had been picked yet.
       */
      incomingSlot.replaceChildren(moveCard(moveCardData(incoming, tuning, { types: detail.types })));

      // The recipient, named on the screen that decides what happens to it. The
      // target screen is one click behind and a player who picked the wrong
      // member should find that out here rather than two nodes later.
      const name = el('span', 'panel__name');
      name.textContent = detail.name;
      const level = el('span', 'panel__level');
      level.textContent = `Lv${detail.level}${genderMark(detail.gender)}`;
      owner.replaceChildren(name, level, ...detail.types.map(typeChip));

      /*
       * Slot order, never sorted.
       *
       * A list ordered by base power would be a ranking, and a ranking is the
       * verdict Part 4 forbids — it would answer the question the screen is
       * asking. Slot order is also the order the battle screen's 2x2 grid uses,
       * so the button the player is about to give up is in the position they
       * already know it by.
       */
      current.replaceChildren(
        ...detail.moves.map((move, slot) =>
          renderVictim(move, member.moves[slot]?.pp ?? move.maxPp, slot, onReplace, tuning, detail.types),
        ),
      );
    },
  };
}

/**
 * One move the incoming one could displace.
 *
 * Built from `moveFacts` rather than from `moveCard` for one reason: this is
 * the one place off the battle screen where *remaining* PP is a real fact
 * about the thing being given up. `moveCard` deliberately shows `maxPp` alone,
 * because a move nobody knows yet has no remaining PP — but these four are
 * known, they have been spent, and a move at 2/15 is a different loss from the
 * same move at 15/15.
 */
function renderVictim(
  move: MoveView,
  pp: number,
  slot: number,
  onReplace: (slot: number) => void,
  tuning: Tuning,
  holderTypes: readonly string[],
): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `move move--victim move--${move.type.toLowerCase()}`;
  button.dataset['category'] = move.category.toLowerCase();

  // The holder is known here — these are the member's own four moves — so STAB
  // renders, unlike on the reward card one screen back.
  const facts = moveFacts(moveCardData(move, tuning, { types: holderTypes }));
  facts.pp.textContent = `PP ${pp}/${move.maxPp}`;
  if (move.maxPp > 0 && pp / move.maxPp <= 0.25) facts.pp.classList.add('move__pp--low');

  button.append(facts.name, facts.meta, ...(facts.tags ? [facts.tags] : []), facts.pp);
  button.setAttribute('aria-label', `Replace ${move.name}`);
  button.addEventListener('click', () => onReplace(slot));
  return button;
}
