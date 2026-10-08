/**
 * The card battle's randomness: one stream per battle, drawn in sequence.
 *
 * The stream is `createRng(state.seed)` under `cardBattleKey`, so it is a
 * function of the sandbox battle's own seed and touches no run seed and no
 * stream key a run opens (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 * The state carries the count of values drawn, and every use rebuilds the
 * stream and steps past them. That keeps `step` a pure function of the state
 * it is handed: stepping one state twice draws the same values twice, which a
 * memoized stream shared across calls would not.
 *
 * Drawn in exactly three places: the opening shuffle, each reshuffle, and each
 * enemy's starting step.
 */
import { createRng, type RngStream } from '../rng';
import { cardBattleKey } from '../streamKeys';
import type { BattleState } from './state';

function streamAt(state: BattleState): RngStream {
  const stream = createRng(state.seed).battle.at(cardBattleKey(state.encounterId));
  for (let i = 0; i < state.rngDraws; i++) stream.nextUint32();
  return stream;
}

/** Draw with a positioned stream, then record what was drawn on `draft`. */
export function withStream<T>(draft: BattleState, use: (stream: RngStream) => T): T {
  const stream = streamAt(draft);
  const result = use(stream);
  draft.rngDraws = stream.draws;
  return result;
}

/** Fisher-Yates, in place on a copy. */
export function shuffled<T>(stream: RngStream, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = stream.nextInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
