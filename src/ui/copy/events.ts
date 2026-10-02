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
 * The most recent event as one line, and **since M4.3 it spends no words on
 * it**. Row D25.
 *
 * ## What it said, and why the verb had to go
 *
 * `Opposing Snorlax used Body Slam`. Three facts and two words — `Opposing`
 * and `used` — on the one screen R11 says carries *"the turn header, the
 * panels, the flags and nothing written"*. The names were always free under the
 * counting rule: a species and a move are proper nouns.
 *
 * Both words are re-encoded rather than dropped, which is C2's requirement and
 * the reason this function still exists at all:
 *
 *   - **`Opposing`** is the side, and the side is already drawn.
 *     `.flags__event[data-side]` has marked it since V5 *"in the same mark the
 *     chips wear one line over"*, which the strip's own rule set calls the
 *     player's side in the heavier neutral and the opponent's left dim. The
 *     word was the second channel for a fact that already had one — R3.
 *   - **`used`** is the relation between an actor and a move, and on a line
 *     that holds exactly one actor and one move there is no other relation it
 *     could be. The separator carries it, the way the header's `·` carries the
 *     one between an opponent and its tier.
 *
 * ## The switch line lost a fact, and that is recorded rather than hidden
 *
 * `came in for Golem` named the body that left. The board does not redraw the
 * old body — it is gone from the panel by the time this line is read — so on
 * the strip the name is now the arriving body alone. The pairing is in the log
 * sheet, one tap away, which is where every line this screen no longer writes
 * has gone.
 */
export function eventLine(action: TurnAction): string {
  if (action.kind === 'move') return `${action.actor} · ${action.move}`;
  // A replacement after a faint, and the opening switch-ins. The protocol does
  // not always say who was replaced, and inventing one would be the strip
  // claiming a withdrawal that never happened — so the arriving body is the
  // whole line in both cases, and the sheet has the pairing where there is one.
  return action.actor;
}
