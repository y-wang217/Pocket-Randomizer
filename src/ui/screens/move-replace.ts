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
import { el, levelAria, levelText, moveCard, moveChip } from '../scene';
import { moveCardData } from '../move-detail';
import { setProse } from '../dom';
import { REPLACE_COPY } from '../copy/screens';
import type { Tuning } from '../../data/tuning';
import { abilityChip, monTypeChip } from '../chip';
import { archetypeChip } from '../archetype-chip';
import { spriteFigure } from '../sprites';
import { openBand } from '../band';

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
  setProse(currentHeading, REPLACE_COPY.current);
  const current = el('div', 'replace__moves');

  root.append(title, blurb, incomingHeading, incomingSlot, owner, currentHeading, current);

  return {
    root,
    render(member, incoming, onReplace, tuning) {
      const detail = describeSpecCard(member.spec);

      title.textContent = `${detail.species} learns ${incoming.name}`;
      setProse(blurb, REPLACE_COPY.blurb);

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
      name.textContent = detail.species;
      const level = el('span', 'panel__level');
      level.textContent = levelText(detail.level, detail.gender);
      level.setAttribute('aria-label', levelAria(detail.level, detail.gender));
      // And its body, at the line's right. Idle-sprites patch.
      /*
       * **The archetype chip and the ability, added by the chip-audit patch.**
       *
       * This line was the audit's one unambiguous finding, and it was a hole
       * rather than a judgement call: every other Pokemon surface carried the
       * label or carried the six stat bars that 4.8.0.3 replaced it with, and
       * this one carried neither. The screen that decides which of four moves a
       * Pokemon keeps was the screen that said least about the Pokemon.
       *
       * The ability is here for the same reason it is on the acquire panel: a
       * move's worth to a holder is an ability question about as often as it is
       * a stat question — a Levitate holder has no use for the Ground move that
       * would otherwise be its best button.
       */
      owner.replaceChildren(
        name,
        level,
        archetypeChip(detail.baseStats),
        ...detail.types.map(monTypeChip),
        abilityChip(detail.ability, detail.abilityId),
        spriteFigure(detail.species),
      );

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
          renderVictim(move, member.moves[slot]?.pp ?? move.maxPp, slot, onReplace, tuning, detail.types, incoming),
        ),
      );
    },
  };
}

/**
 * One move the incoming one could displace, as a chip. **Milestone M2.3.**
 *
 * **Five full cards became one card and four chips**, which is the item in a
 * sentence. The screen drew the incoming move and all four of its possible
 * victims in the same full face — a shape chosen deliberately, because Part
 * 4's rule is that the comparison is the player's to make and five identical
 * cards is the least opinionated way to lay one out.
 *
 * What that missed is the fold. Five full cards do not fit a 390x844 phone, so
 * the player scrolled to see the options they were choosing between — and a
 * comparison you cannot see at once is not a comparison. The chip carries the
 * four fields that differ between a member's own moves (name, type, category,
 * base power) and the confirm carries the full pair.
 *
 * **Nothing is ranked, sorted or coloured**, exactly as before. Slot order,
 * which is also the order the battle grid uses, so the move about to be given
 * up sits where the player already knows it.
 *
 * A tap opens the confirm rather than committing. That is new, and it is what
 * makes the chip honest: the decision is still made against two full faces,
 * one of which the chip has just shrunk.
 */
function renderVictim(
  move: MoveView,
  pp: number,
  slot: number,
  onReplace: (slot: number) => void,
  tuning: Tuning,
  holderTypes: readonly string[],
  incoming: MoveSpec,
): HTMLElement {
  const chip = moveChip(move);
  chip.classList.add('move--victim');
  chip.setAttribute('aria-label', `Replace ${move.name}`);
  chip.addEventListener('click', () => {
    /*
     * **Both full cards, side by side, in the shared band.**
     *
     * `openBand`'s content slot is M2.3's addition and `test/band.test.ts`
     * holds the rule it exists for: no screen builds its own confirm. The
     * cards are the same `moveCard` every other surface mounts, so the face
     * the player confirms against is the face they have been reading all run.
     *
     * The victim carries its *remaining* PP, which is the one fact a chip
     * cannot show and the one the full card is here for: a move at 2/15 is a
     * different loss from the same move at 15/15.
     */
    const pair = el('div', 'replace__pair');
    pair.append(
      moveCard(moveCardData(incoming, tuning, { types: holderTypes })),
      moveCard({ ...moveCardData(move, tuning, { types: holderTypes }), pp }),
    );
    openBand({
      title: `Replace ${move.name} with ${incoming.name}?`,
      confirm: 'Replace',
      cancel: 'Keep',
      content: pair,
      onConfirm: () => onReplace(slot),
    });
  });
  return chip;
}
