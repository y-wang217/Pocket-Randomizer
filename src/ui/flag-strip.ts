/**
 * The flag strip: what the turn that just resolved actually did.
 *
 * ## What it is for
 *
 * The log has always carried this. It carries it as prose, several sentences
 * per turn, in a panel that has to be read — and the round 2 playtest's whole
 * complaint was that a mechanic you have to read a paragraph to notice is,
 * from where the player sits, a mechanic that does not exist. The strip is the
 * same truths as a row of words at the top of the board: what landed, whether
 * it was resisted, whether a berry fired, why the slow one went first.
 *
 * **Attributes, never verdicts, and here that is a visual rule as much as a
 * copy one.** Every chip is the same chip — same size, same weight, same
 * neutral surface, no hue. `SUPER EFFECTIVE` and `NOT VERY EFFECTIVE` are the
 * same kind of fact about a multiplier that already applied, and drawing one
 * heavier than the other would turn a reading into a recommendation. Order is
 * the protocol's, which is the one ordering that is a fact.
 *
 * ## Why it is a strip and not a line in the log
 *
 * V5 replaces the multi-line log with a one-line event strip and reuses this
 * for its content. Rendering through the V2 chip component now means that swap
 * is a change of container, not a restyle — `.flags` moves, the chips inside it
 * do not change at all.
 *
 * ## It reads nothing
 *
 * The flags arrive already read, from the screen's single `readFlags` over the
 * protocol batch — the same object the log renders from and the same object the
 * jiggle takes its order from. This file chooses which group to show and which
 * word each kind wears, and that is the whole of it. The words are
 * `data/flagWords.ts`'s; nothing here is prose.
 */
import type { Flag, FlaggedTurn } from '../core/battle/flags';
import { flagWord } from '../data/flagWords';
import { flagChip } from './chip';
import { el } from './dom';

export interface FlagStrip {
  root: HTMLElement;
  /** Show the latest turn in a batch the screen has already read. */
  show(turns: readonly FlaggedTurn[]): void;
  clear(): void;
}

export function createFlagStrip(): FlagStrip {
  const root = el('div', 'flags');
  /*
   * A live region, because the strip is the one place a turn's outcome is
   * stated as words rather than narrated. A screen reader that only had the
   * log would get the same facts; one that has both should not be told twice,
   * so this is `polite` and the log is not a live region at all.
   */
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  return {
    root,
    show(turns) {
      const flags = latest(turns);
      root.replaceChildren(
        ...flags.map((flag) => {
          const chip = flagChip(flag.kind, flagWord(flag.kind, flag.detail), { tip: `flag:${flag.kind}` });
          /*
           * Whose Pokemon the flag is about, in the vocabulary the log already
           * taught: "the ordinal says when; the colour says who."
           *
           * Without it a turn where both sides used a same-type move prints
           * `STAB` twice with nothing saying which is which, and the strip
           * stops answering the question it exists for. The `subject` is on
           * the flag for the same reason and rides along on the label a screen
           * reader gets.
           *
           * **This is not the weight axis.** Every kind looks identical to
           * every other kind, which is the rule; a side marker is a different
           * fact, it is the one the log already marks, and it says nothing
           * about whether what happened was good.
           */
          chip.dataset['side'] = flag.side;
          chip.setAttribute('aria-label', `${flag.subject}: ${flagWord(flag.kind, flag.detail)}`);
          return chip;
        }),
      );
      // Empty rather than hidden: the strip holds its height so the board does
      // not jump between a turn that had something to say and one that did not.
      root.dataset['empty'] = flags.length === 0 ? 'true' : 'false';
    },
    clear() {
      root.replaceChildren();
      root.dataset['empty'] = 'true';
    },
  };
}

/**
 * The flags of the last group in the batch that has any.
 *
 * The same rule the jiggle uses, and it must stay the same rule: an
 * incremental update arrives as the actions that just resolved followed by the
 * `|turn|` that opens the *next* one, so the group carrying the turn number is
 * the empty one. Selecting by turn number here would show the previous turn's
 * words beside the current turn's nudge.
 *
 * Actions first in resolution order, then the turn's residual — a berry that
 * fired at end of turn belongs after the moves that led to it, which is also
 * when it happened.
 */
function latest(turns: readonly FlaggedTurn[]): Flag[] {
  const group = [...turns]
    .reverse()
    .find((turn) => turn.actions.some((each) => each.flags.length > 0) || turn.residual.length > 0);
  if (!group) return [];
  return [...group.actions.flatMap((each) => [...each.flags]), ...group.residual];
}
