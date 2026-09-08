/**
 * The policy seam.
 *
 * A policy is a function from "what I can see" to "what I do". That is all it
 * is, and keeping it that small is what makes the human player, the AI, and a
 * scripted balance-sweep bot interchangeable:
 *
 *   - the human is a policy whose promise resolves when a button is clicked
 *   - the AI (ai.ts) is a policy that computes an answer synchronously
 *   - `firstUsableMovePolicy` is a policy that always picks slot 1
 *
 * `runBattle` takes two of them and does not care which is which. Nothing in
 * this file may touch the DOM: the human policy is driven by *events*, and it
 * is `ui/` that decides those events come from a click.
 */
import type { BattleView, Choice } from '../types';
import { moveChoice } from '../types';
import { forcedSwitchFallback, usableSwitches } from './switching';

export type Policy = (view: BattleView) => Promise<Choice>;

/*
 * `usableSwitches` and `forcedSwitchFallback` moved to `battle/switching.ts` in
 * Stage 4 and are re-exported here.
 *
 * They were never really policy helpers — they are legality questions, and
 * Stage 4 gave legality enough surface (voluntary switches, trapping, the
 * `wait` request, a reason per blocked bench slot) to be its own file. Every
 * caller kept working, which is the point of re-exporting rather than
 * rewriting the imports: a policy asks the same two questions it always did.
 */
export { forcedSwitchFallback, usableSwitches };

/** Moves the policy is allowed to pick this turn. */
export function usableMoves(view: BattleView): BattleView['moves'] {
  const usable = view.moves.filter((move) => move.usable);
  // When everything is disabled or out of PP the sim substitutes Struggle,
  // which arrives as the only entry and must still be pickable.
  return usable.length > 0 ? usable : view.moves;
}

/**
 * Never switches voluntarily; answers a forced switch and nothing else.
 *
 * **The control arm of Stage 4's headline comparison.** Wrapping a policy in
 * this rather than writing a second one is what makes `switch-aware` versus
 * `no-switch` a fair test: the two share their battle AI exactly, and the only
 * difference between the runs they produce is whether a voluntary switch was
 * ever available. A hand-written no-switch bot would differ in a dozen small
 * ways nobody chose, and the gap in completion rate would be a measurement of
 * those instead of of switching.
 *
 * It works by *hiding* the switches rather than by discarding a switch the
 * inner policy returned. A policy handed a view it cannot act on would score
 * choices it is not allowed to take and then be overruled, which is a different
 * bot again — one that sometimes plays its second-best move for reasons it
 * cannot see. Blanking the bench makes the inner policy's view honest: as far
 * as it knows, there is nothing to switch to.
 */
export function withoutSwitching(inner: Policy): Policy {
  return async (view) => {
    // A forced switch is not a choice, so it passes through untouched: refusing
    // it would not be a no-switch policy, it would be a policy that cannot play.
    if (view.forceSwitch) return inner(view);
    return inner({
      ...view,
      trapped: true,
      switches: view.switches.map((member) => ({
        ...member,
        usable: false,
        // Reported as trapping rather than as a fourth reason, because that is
        // what it is from the policy's side: something outside it is refusing
        // the switch. The UI never sees this wrapper.
        block: member.block ?? 'trapped',
      })),
    });
  };
}

/** Always picks the first usable move. Deterministic; the baseline for tests. */
export const firstUsableMovePolicy: Policy = async (view) => {
  const forced = forcedSwitchFallback(view);
  if (forced) return forced;

  const moves = usableMoves(view);
  const first = moves[0];
  if (!first) throw new Error('No move available to choose');
  return moveChoice(first.slot);
};

export interface HumanPolicy {
  /** Hand this to `runBattle`. */
  policy: Policy;
  /**
   * Resolve the turn currently awaiting input.
   * Returns false if nothing is waiting, so a stray click is a no-op rather
   * than a queued decision that fires on the following turn.
   */
  submit(choice: Choice): boolean;
  /** Reject any pending decision, e.g. when the player abandons the battle. */
  cancel(reason?: string): void;
  /** True while the policy is waiting on input. */
  isWaiting(): boolean;
}

/**
 * A policy driven from outside — by UI events in the app, by a test harness in
 * a spec. It parks on a promise until `submit` is called.
 */
export function createHumanPolicy(): HumanPolicy {
  let resolve: ((choice: Choice) => void) | null = null;
  let reject: ((error: Error) => void) | null = null;

  return {
    policy: () =>
      new Promise<Choice>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
    submit(choice) {
      if (!resolve) return false;
      const settle = resolve;
      resolve = null;
      reject = null;
      settle(choice);
      return true;
    },
    cancel(reason = 'Battle abandoned') {
      if (!reject) return;
      const settle = reject;
      resolve = null;
      reject = null;
      settle(new Error(reason));
    },
    isWaiting: () => resolve !== null,
  };
}
