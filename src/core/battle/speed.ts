/**
 * Who acts first this turn, as far as a policy may know.
 *
 * **An approximation, and documented as one.** The number here is the Speed
 * stat at level, after stat stages, halved by paralysis, and nothing else.
 * Items (Choice Scarf), abilities (Swift Swim, Chlorophyll, Quick Feet,
 * Unburden, Slow Start), field effects (Tailwind, Trick Room) and every other
 * modifier the generation has are resolved by the sim when the turn runs and
 * are not modelled here. The sim's own answer is the truth; this is the
 * policy's forecast of it from public information, the same three layers the
 * battle screen recomputes for a foe whose ability is hidden
 * (`view.ts`, `visibleSpeed`).
 *
 * Two things follow. The forecast can be wrong, and when it is, the turn-order
 * jiggle on the battle screen (Release C, which reads the protocol) disagrees
 * with what the AI expected — that is a limit of this helper, never a bug in
 * the jiggle. And the helper **never guesses a tie**: equal effective Speeds
 * are a coin flip in the engine, so they are reported as `unknown`, and the AI
 * treats `unknown` as "assume I act second", which is the safe reading for a
 * rule about escaping a knockout.
 *
 * Nothing here draws or changes what the sim resolves. Views for the policy,
 * not inputs to the battle.
 */
import { applyParalysis, applyStage } from './stats';
import type { ActiveView, BattleView, SpeedView } from '../types';

/** The three answers to "do I act before the foe this turn?". */
export type TurnOrder = 'first' | 'second' | 'unknown';

/** Speed after stages, then paralysis, in that order — the engine's order too. */
export function effectiveSpeed(active: ActiveView): number {
  const staged = applyStage(active.baseSpeed, active.statStages.spe);
  return active.status === 'par' ? applyParalysis(staged) : staged;
}

/** Both sides, for `BattleView.speed`. */
export function speedView(me: ActiveView, foe: ActiveView): SpeedView {
  return { me: effectiveSpeed(me), foe: effectiveSpeed(foe) };
}

/** Which side the forecast says acts first, ignoring move priority. A tie is `unknown`. */
export function orderOf(speed: SpeedView): TurnOrder {
  if (speed.me === speed.foe) return 'unknown';
  return speed.me > speed.foe ? 'first' : 'second';
}

/** The same question asked of a whole view. */
export function turnOrderOf(view: Pick<BattleView, 'speed'>): TurnOrder {
  return orderOf(view.speed);
}
