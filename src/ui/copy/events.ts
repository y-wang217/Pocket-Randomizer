/**
 * The one-line event, in words. Stage V5.
 *
 * **Under `ui/`, not `data/`.** The same rule `copy/summary.ts` states and for
 * the same reason: `contentHash` is computed over `data/`, and a word changed
 * here must not move a seed. Release C's flag vocabulary sits in
 * `data/flagWords.ts` and moved `data-digest.txt` when it landed — a wart that
 * report writes up for the `contentHash` release — and V5 does not add a second
 * instance of it.
 *
 * ## What this is, and what it is not
 *
 * The strip says two things about the turn that just resolved: **what was
 * done**, which is this file, and **what was true about it**, which is
 * `data/flagWords.ts`. They are separate because they answer separate
 * questions and because only one of them existed before V5.
 *
 * The log's sentences are @pkmn/view's `LogFormatter` output and stay that
 * way — nothing here is a second rendering of the protocol. This reads the
 * `TurnAction` the screen already had: the actor and the move it used, or the
 * body that came in and the one it replaced. There is no branch here that a
 * protocol line has to be re-parsed to take.
 *
 * ## Part 4 applies to every word here
 *
 * "used Body Slam" is what the protocol said. "landed a big one" is not.
 * There is no wording in this file that says whether what happened was good,
 * and no field that could carry an emphasis: the strip's one visual axis is
 * whose Pokemon a fact is about, and that is set from `action.side` rather
 * than from anything written here.
 */
import type { TurnAction } from '../../core/battle/turnOrder';

/**
 * How the opponent's Pokemon is named, in the log's own vocabulary.
 *
 * The log formatter prints "The opposing Blastoise"; the strip has one line
 * and drops the article. Both sides could have a Snorlax out, and a bare name
 * on a one-line strip would be the one place on the board that could not say
 * which of the two just acted.
 */
function actorName(side: TurnAction['side'], name: string): string {
  return side === 'p2' ? `Opposing ${name}` : name;
}

/**
 * The most recent event as one line.
 *
 * Never truncated here. The strip's rule is that overflow truncates and the
 * history sheet has the full text, and truncation is a property of the box it
 * is drawn in rather than of the sentence — a wording cut to fit 390 would be
 * cut on every viewport.
 */
export function eventLine(action: TurnAction): string {
  const actor = actorName(action.side, action.actor);
  if (action.kind === 'move') return `${actor} used ${action.move}`;
  // A replacement after a faint, and the opening switch-ins, name nobody they
  // came in for: the protocol did not say, and inventing one would be the
  // strip claiming a withdrawal that never happened.
  return action.from ? `${actor} came in for ${action.from}` : `${actor} came in`;
}
