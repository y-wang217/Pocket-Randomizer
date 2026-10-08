/**
 * The reducer: the only function that changes battle state. Synchronous, JSON
 * state in, JSON state out, and it never throws on any action. An illegal or
 * malformed action returns a typed rejection and the very state object it was
 * handed.
 *
 * It takes no RNG argument: the battle's stream is rebuilt from the state's
 * own seed and draw count (`random.ts`), so a step is a pure function of the
 * state and the action.
 */
import { select, type StepResult, unselect } from './plan';
import { commit } from './resolve';
import type { Action, BattleState } from './state';

export type { StepResult };

export function step(state: BattleState, action: Action | unknown): StepResult {
  const type = typeof action === 'object' && action !== null ? (action as { type?: unknown }).type : undefined;
  switch (type) {
    case 'select':
      return select(state, action);
    case 'unselect':
      return unselect(state, action);
    case 'commit':
      return commit(state);
    default:
      return { ok: false, state, reason: 'malformed' };
  }
}
