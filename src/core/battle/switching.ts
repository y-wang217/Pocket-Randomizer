/**
 * Switch legality, and what a switch costs.
 *
 * Stage 4's one rule, stated once: **legality is read off the request the sim
 * hands us, never off our own model of the battle.** Everything in this file is
 * a query over a `BattleView`, and every field of that view that this file
 * reads was copied out of `side.activeRequest` by the adapter. Nothing here
 * infers that a switch is legal from HP, from a bench count, or from whose turn
 * it is.
 *
 * That is not defensive style, it is the fix for a bug this stage actually had.
 * The first cut asked the request for `active[0].trapped` and offered the switch
 * whenever it was absent — and an opponent with Arena Trap reports
 * `maybeTrapped` instead, because the ability has not been revealed. The view
 * said the switch was fine, the sim rejected it, and with `strictChoices` the
 * rejection is a throw in the middle of a battle. See `SwitchBlock` below for
 * how the two are told apart now.
 *
 * ## What a switch costs
 *
 * The standard cost, and nothing invented on top of it: the switch **consumes
 * the turn**, and the incoming member takes the opponent's attack. Showdown has
 * implemented that for twenty years, so there is no cost model in this file —
 * the work of Stage 4 is passing the choice through, not re-deriving what
 * happens when it lands. `test/switching.test.ts` asserts it against the raw
 * protocol rather than against anything written here, which is the only way to
 * be sure we did not quietly model it ourselves.
 */
import type { BattleView, Choice, SwitchView } from '../types';
import { switchChoice } from '../types';

/**
 * Why the sim will not accept a switch to this member.
 *
 * Four cases, and they are separate values rather than one boolean because the
 * battle screen has to say *which* — the spec's rule is that an illegal switch
 * is shown disabled with a reason and never hidden, and "disabled" with no
 * reason is a button the player learns to stop reading.
 *
 * `trapped` and `maybe-trapped` are the same outcome from the sim's point of
 * view and different facts about the player's. The sim reports `trapped` when
 * the thing doing the trapping is public — a move like Mean Look, an ability
 * already revealed — and `maybeTrapped` when it is not, which is the honest
 * state of an unrevealed Arena Trap: *something* is holding you and you have
 * not been told what.
 *
 * Both block the choice here. A real Showdown client would offer the switch on
 * `maybeTrapped` and let the server reject it, which is how a human discovers
 * the trap; this driver runs with `strictChoices` and a rejected choice is a
 * thrown error mid-battle, so offering it would trade a small information leak
 * for a crash. The leak is written down rather than hidden: the player learns
 * they are trapped without learning by what.
 */
export type SwitchBlock = 'fainted' | 'active' | 'trapped' | 'maybe-trapped';

/** Bench members the sim would accept a switch to right now. */
export function usableSwitches(view: BattleView): SwitchView[] {
  return view.switches.filter((member) => member.usable);
}

/**
 * True when this side may switch at all this turn.
 *
 * Distinct from "has a bench": a party of three whose other two have fainted
 * cannot switch, and neither can one held by Arena Trap. Both answer false
 * here, which is what the battle screen needs to decide whether to grey the
 * whole panel or only some rows of it.
 */
export function canSwitch(view: BattleView): boolean {
  return usableSwitches(view).length > 0;
}

/**
 * True when the sim wants a switch and will accept nothing else.
 *
 * A thin alias for the view's own flag, and it exists so that policy code reads
 * as a question about the battle rather than a field access — every policy must
 * branch on this *before* it reads `moves`, which is empty on these turns.
 */
export function isForcedSwitch(view: BattleView): boolean {
  return view.forceSwitch;
}

/**
 * True when the sim is not asking this side anything.
 *
 * **The single most likely bug in Stage 4, named so it can be tested.** While
 * one side resolves a forced switch, the other side's request is a `wait` — not
 * a turn, not an empty move list, a request that must be answered with silence.
 * Submitting a choice against it desyncs the battle, and the symptom is not an
 * error but a turn resolving with the wrong action in it.
 *
 * `runBattle` never asks a policy that is waiting, and `BattleView.awaitingChoice`
 * is false throughout. This is the reading of that for anything that has a view
 * in its hand and no loop around it — the UI, mostly, which has to know the
 * difference between "no buttons because it is not your turn" and "no buttons
 * because the battle ended".
 */
export function isWaiting(view: BattleView): boolean {
  return !view.ended && !view.awaitingChoice;
}

/**
 * Every choice the sim would accept from this side right now.
 *
 * **The list an AI scores.** Stage 0's AI maximised over moves and answered
 * forced switches with a separate branch, which was fine while a switch was
 * only ever a forced one. Once switching is voluntary a move and a switch are
 * two answers to the same question, and an AI that ranks them on two scales
 * cannot compare them — so the choice *set* is built in one place, here, and
 * `ai.ts` scores whatever it is handed.
 *
 * Empty when the side is waiting or the battle is over, which is a legitimate
 * answer and not an error: the caller checks `awaitingChoice` first.
 */
export function legalChoices(view: BattleView): Choice[] {
  if (!view.awaitingChoice) return [];

  const switches = usableSwitches(view).map((member) => switchChoice(member.slot));
  if (view.forceSwitch) return switches;

  // Usable moves, plus Struggle when everything is disabled or out of PP: the
  // sim substitutes it as the only entry and it must still be pickable.
  const usable = view.moves.filter((move) => move.usable);
  const moves = (usable.length > 0 ? usable : view.moves).map((move) => ({
    kind: 'move' as const,
    slot: move.slot,
  }));
  return [...moves, ...switches];
}

/**
 * Check a choice against the view before the sim sees it.
 *
 * Returns the reason it would be rejected, or null when it would be accepted.
 * The driver calls this on the way in so that an illegal choice fails with a
 * sentence naming the choice and the state that refused it, rather than with
 * the sim's own `[Unavailable choice]` several frames deeper.
 *
 * This is a *guard*, not a second legality model: every branch below reads a
 * field the adapter copied out of the request. If this and the sim ever
 * disagree, this one is wrong.
 */
export function rejectionReason(view: BattleView, choice: Choice): string | null {
  if (view.ended) return 'the battle has ended';
  if (!view.awaitingChoice) return 'the sim is not asking this side for a choice (wait)';

  if (choice.kind === 'switch') {
    const member = view.switches.find((entry) => entry.slot === choice.slot);
    if (!member) return `there is no party slot ${choice.slot}`;
    if (member.usable) return null;
    return `${member.name} cannot be switched to (${member.block ?? 'not available'})`;
  }

  if (view.forceSwitch) return 'the sim wants a switch and will not accept a move';
  const move = view.moves.find((entry) => entry.slot === choice.slot);
  if (!move) return `there is no move in slot ${choice.slot}`;
  // Struggle arrives as the only entry with everything else unusable; a lone
  // unusable move is therefore still the legal answer.
  if (!move.usable && view.moves.some((entry) => entry.usable)) return `${move.name} is not usable this turn`;
  return null;
}

/**
 * The one legal answer to a forced switch, when there is nothing to think about.
 *
 * Returns null when the view is not a forced switch, so a policy can use it as
 * a guard clause. Ties break toward the lower slot: an unspecified tie-break
 * would make the choice depend on array order and a seed would stop reproducing
 * the same battle.
 *
 * Throws when a forced switch has no legal answer. That is not a defensive
 * check — it is unreachable by construction, because the sim ends the battle
 * rather than asking for a switch it knows cannot be made. If it ever fires,
 * the wipe condition below has stopped agreeing with the engine.
 */
export function forcedSwitchFallback(view: BattleView): Choice | null {
  if (!view.forceSwitch) return null;
  const first = usableSwitches(view)[0];
  if (!first) throw new Error('Forced to switch with nothing to switch to');
  return switchChoice(first.slot);
}

/**
 * Whether this side has anything left to send out.
 *
 * The battle-level half of the run's wipe rule. `party.isWiped` is the run-level
 * half and reads `PokemonState.fainted` between nodes; this reads the live view
 * mid-battle. They are deliberately two functions over two representations
 * rather than one shared one — the sim owns the truth during a fight and the
 * party owns it between fights, and a single function would have to be handed
 * whichever is currently authoritative, which is the sort of parameter that
 * eventually gets passed the wrong one.
 */
export function hasReserves(view: BattleView): boolean {
  return view.switches.some((member) => !member.fainted && !member.block);
}
