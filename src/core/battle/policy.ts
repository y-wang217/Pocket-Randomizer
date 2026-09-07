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

export type Policy = (view: BattleView) => Promise<Choice>;

/** Moves the policy is allowed to pick this turn. */
export function usableMoves(view: BattleView): BattleView['moves'] {
  const usable = view.moves.filter((move) => move.usable);
  // When everything is disabled or out of PP the sim substitutes Struggle,
  // which arrives as the only entry and must still be pickable.
  return usable.length > 0 ? usable : view.moves;
}

/** Always picks the first usable move. Deterministic; the baseline for tests. */
export const firstUsableMovePolicy: Policy = async (view) => {
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
