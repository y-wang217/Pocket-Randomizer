/**
 * The event strip: what the turn that just resolved did, and what was true
 * about it, on one line.
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
 * **Since M4.1 it shows one of them per side, not all of them.** R9 allows one
 * flag on a target and D23 adds one non-outcome beside it; `shown()` at the
 * bottom of this file is that rule and `data/flagPrecedence.ts` is its table.
 * What no longer fits is in the log sheet, which is one tap away and holds
 * every line.
 *
 * **Attributes, never verdicts, and here that is a visual rule as much as a
 * copy one.** Every chip is the same chip — same size, same weight, same
 * neutral surface, no hue. `SUPER EFFECTIVE` and `NOT VERY EFFECTIVE` are the
 * same kind of fact about a multiplier that already applied, and drawing one
 * heavier than the other would turn a reading into a recommendation. Order is
 * the protocol's, which is the one ordering that is a fact.
 *
 * ## V5: this is the strip, and there is only one of it
 *
 * Release C built this container and said so in its own comment: *"V5 replaces
 * the multi-line log with a one-line event strip and reuses this for its
 * content. Rendering through the V2 chip component now means that swap is a
 * change of container, not a restyle."* That is what V5 does. It does **not**
 * build a second strip beside this one, and the chips are byte-identical to
 * what Release C drew.
 *
 * Three children now, in reading order:
 *
 *   - `.flags__event` — the most recent action, in words. `ui/copy/events.ts`.
 *   - `.flags__words` — Release C's flag chips, unchanged.
 *   - `.flags__history` — the tap that opens the log. Wired by the screen.
 *
 * The row never wraps. Overflow truncates and the sheet has the full text,
 * which is the plan's rule and is why the event line and the word row each
 * carry their own `min-width: 0` in the stylesheet rather than relying on the
 * content being short.
 *
 * ## It reads nothing
 *
 * The flags arrive already read, from the screen's single reader over the
 * protocol batch — the same object the log renders from and the same object
 * the jiggle takes its order from. The event line comes off the same reading:
 * a `TurnAction` the group already carries, not a second parse. This file
 * chooses which group to show and which word each kind wears, and that is the
 * whole of it. The words are `data/flagWords.ts`'s and `ui/copy/events.ts`'s;
 * nothing here is prose.
 */
import type { Flag, FlaggedTurn } from '../core/battle/flags';
import type { ActorSide, TurnAction } from '../core/battle/turnOrder';
import { FLAG_CHANNEL, hitRank } from '../data/flagPrecedence';
import { flagWord } from '../data/flagWords';
import { flagChip } from './chip';
import { eventLine } from './copy/events';
import { el } from './dom';

export interface FlagStrip {
  root: HTMLElement;
  /**
   * The control that opens the history sheet.
   *
   * Exposed rather than wired here, for the reason `drawer.ts` exposes its
   * trigger: the strip does not own the sheet and must not be able to open one
   * on its own. `screens/battle.ts` connects the two, and that is the only
   * place a tap becomes an open.
   */
  history: HTMLButtonElement;
  /** Show the latest turn in a batch the screen has already read. */
  show(turns: readonly FlaggedTurn[]): void;
  clear(): void;
}

export function createFlagStrip(): FlagStrip {
  const root = el('div', 'flags');
  root.dataset['tutorial'] = 'flags';
  /*
   * A live region, because the strip is the one place a turn's outcome is
   * stated as words rather than narrated. A screen reader that only had the
   * log would get the same facts; one that has both should not be told twice,
   * so this is `polite` and the log is not a live region at all.
   */
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const event = el('span', 'flags__event');
  const words = el('span', 'flags__words');

  /*
   * The handle that opens the sheet. **M4.3, row D26.**
   *
   * It read `History` until M4.3, and a word here is word load on a screen
   * section 4 budgets at zero outside the strip's flags and the header. It is
   * drawn as a grab handle instead — two stacked bars, in the stylesheet, no
   * text node at all — and it keeps its accessible name, which is not rendered
   * and is not what the census counts.
   *
   * **A handle rather than a glyph on purpose.** Section 2's nine families are
   * attributes of a Pokemon or a move, and a control is neither, so a `history`
   * glyph would be a tenth family for a piece of furniture. What this draws is
   * the shape of the thing it opens: the sheet comes up from the bottom of the
   * screen, and a grab handle is where it comes from.
   */
  const history = document.createElement('button');
  history.type = 'button';
  history.className = 'flags__history';
  history.setAttribute('aria-label', 'Battle history');
  history.append(el('span', 'flags__grip'));
  /*
   * Out of the live region. The control is furniture, not an event, and a
   * `polite` region that announced it after every turn would be reading the
   * button out loud once a turn for the whole battle.
   */
  history.setAttribute('aria-live', 'off');

  root.append(event, words, history);

  const render = (turns: readonly FlaggedTurn[] | null): void => {
    const group = turns ? latest(turns) : null;
    const action = group ? lastAction(group) : null;
    event.textContent = action ? eventLine(action) : '';
    // Whose Pokemon acted, in the same mark the chips wear. Set from the
    // action's own side rather than from anything the wording carries.
    if (action) event.dataset['side'] = action.side;
    else delete event.dataset['side'];

    const flags = group ? shown(flagsOf(group)) : [];
    words.replaceChildren(
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
    /*
     * `data-empty` is about the **flag words**, not about the strip.
     *
     * It has meant "this turn had nothing to report" since Release C, where it
     * kept the band's height so the board did not jump between a turn with
     * three words and one with none. The event line does not change that
     * question: a Splash that did nothing worth a word still says what was
     * used, and the row still has to hold its height when the words are gone.
     */
    root.dataset['empty'] = flags.length === 0 ? 'true' : 'false';
  };

  return {
    root,
    history,
    show(turns) {
      render(turns);
    },
    clear() {
      render(null);
    },
  };
}

/**
 * The group the strip is reporting.
 *
 * The last group in the batch that has anything to say, and **not** the last
 * group with a turn number — those are different, and the difference is the
 * bug this comment exists to stop somebody reintroducing. An incremental
 * update arrives as the actions that just resolved followed by the `|turn|`
 * that opens the *next* one, so the group carrying the turn number is the
 * empty one. Selecting by turn number here would show the previous turn's
 * words beside the current turn's nudge.
 *
 * "Anything to say" grew one clause in V5. A group with flags or residual is
 * preferred, exactly as Release C chose it, so the words the strip prints are
 * the words it printed before this stage. The fallback — the last group with
 * any actions — exists for the turn where nothing was flagged at all: Release C
 * showed an empty strip there, and V5 has a sentence for it. It is the jiggle's
 * own rule, so on such a turn the panel that twitches and the name in the line
 * are the same side by construction.
 */
function latest(turns: readonly FlaggedTurn[]): FlaggedTurn | null {
  const reversed = [...turns].reverse();
  return (
    reversed.find((turn) => turn.actions.some((each) => each.flags.length > 0) || turn.residual.length > 0) ??
    reversed.find((turn) => turn.actions.length > 0) ??
    null
  );
}

/**
 * The turn's flags, in the order they happened.
 *
 * Actions first in resolution order, then the turn's residual — a berry that
 * fired at end of turn belongs after the moves that led to it, which is also
 * when it happened.
 */
function flagsOf(group: FlaggedTurn): Flag[] {
  return [...group.actions.flatMap((each) => [...each.flags]), ...group.residual];
}

/**
 * The flags this turn has room for. **Milestone M4.1, rule R9, row D23.**
 *
 * ## One per side, per channel
 *
 * R9: *"After resolution, at most one flag appears on a target, by fixed
 * precedence."* A target is a side, and in singles a side is hit once a turn,
 * so "one per side" and the budget's "one per hit" are the same sentence said
 * from the two ends. Reading it per side rather than per action is what makes
 * a berry that fired at end of turn compete with the hit that provoked it
 * rather than arriving as a third chip with nothing to compete against.
 *
 * The second channel is D23's: `priority`, `prevented`, `failed`, `ability`,
 * `volatile` and `field` are not outcomes on a target, R9 never ranked them,
 * and ranking them against `crit` would cost the flinch the only channel it
 * has. One per side there too, taken in protocol order, because the bound is
 * what keeps the row a budget rather than a hope.
 *
 * ## What it does not do
 *
 * It does not reorder. The survivors come back in the order `flagsOf` produced
 * them, which is the protocol's — *"the one ordering that is a fact rather
 * than an opinion"*. Precedence decides which flags survive; it never decides
 * which is drawn first, larger or louder, and there is no path from a rank to
 * a style.
 *
 * It also does not filter what anything else reads. `ui/abnormality.ts` takes
 * its beat from the full list and used to say *"the strip carries the rest"*;
 * since this item the strip carries one per side per channel, and the rest is
 * in the log sheet one tap away. That comment is corrected there rather than
 * here.
 */
function shown(flags: readonly Flag[]): Flag[] {
  const hit = new Map<ActorSide, Flag>();
  const second = new Map<ActorSide, Flag>();

  for (const flag of flags) {
    if (FLAG_CHANNEL[flag.kind] === 'second') {
      // First in protocol order, so `set` only when the side is still empty.
      if (!second.has(flag.side)) second.set(flag.side, flag);
      continue;
    }
    const standing = hit.get(flag.side);
    // Strictly better, so a tie — `super` against `resisted`, `boost` against
    // `unboost` — is decided by the protocol rather than by this comparison.
    if (!standing || hitRank(flag.kind) < hitRank(standing.kind)) hit.set(flag.side, flag);
  }

  const survivors = new Set<Flag>([...hit.values(), ...second.values()]);
  return flags.filter((flag) => survivors.has(flag));
}

/**
 * The last action of the group, which is the most recent thing that happened.
 *
 * Last rather than first: the strip reports the state the board is in now, and
 * on a two-action turn that is what the second one did. The log holds both, in
 * order, one tap away.
 */
function lastAction(group: FlaggedTurn): TurnAction | null {
  return group.actions.at(-1)?.action ?? null;
}
