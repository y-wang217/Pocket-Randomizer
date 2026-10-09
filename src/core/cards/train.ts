/**
 * Training the guard bot: a (1+λ) evolution strategy over its weights.
 *
 * Each generation mutates the best weights so far into `children` candidates,
 * plays every scenario on the same training seeds with each (common seeds, so
 * a difference is the weights and not the luck of the draw), and keeps a child
 * only when it scores strictly better. The step size grows after a generation
 * that improved and shrinks after one that did not. The result is then
 * checked on a held-out seed set it never trained on.
 *
 * The mutations draw from the trainer's own stream (`cardTrainKey`); the
 * battles draw from their own seeds and the bot draws nothing, so a training
 * run is a pure function of its options.
 */
import { createRng, type RngStream } from '../rng';
import { cardTrainKey } from '../streamKeys';
import { meanFitness, runSuite, type BattleResult } from './bench';
import type { GuardSearch, GuardWeights, UnitDefId } from './defs';
import { guardBot } from './guard';

export interface TrainOptions {
  /** Seeds the mutations. */
  seed: string;
  /** Training battles are seeds `${trainPrefix}0` up, `perScenario` of them in every scenario. */
  trainPrefix: string;
  perScenario: number;
  generations: number;
  children: number;
  /** Starting step size, as a log-scale spread. */
  sigma: number;
  scenarios?: readonly string[];
  search: GuardSearch;
  onGeneration?: (generation: number, best: number, improved: boolean) => void;
}

export interface TrainResult {
  weights: GuardWeights;
  startFitness: number;
  fitness: number;
  /** Generations that found a better child. */
  improvements: number;
  battlesPlayed: number;
}

const UNITS: readonly UnitDefId[] = ['A', 'B', 'C'];

/** A normal draw from the sum of four uniforms: plenty for a mutation. */
function gauss(stream: RngStream): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += stream.nextFloat();
  return (sum - 2) * Math.sqrt(3);
}

/** A child of `w`: each weight moved with probability one half. */
export function mutate(w: GuardWeights, stream: RngStream, sigma: number): GuardWeights {
  const scale = (v: number): number => (stream.nextFloat() < 0.5 ? v * Math.exp(sigma * gauss(stream)) : v);
  const unit = Object.fromEntries(UNITS.map((id) => [id, scale(w.unit[id])])) as Record<UnitDefId, number>;
  return {
    win: scale(w.win),
    unit,
    hp: scale(w.hp),
    baseShield: scale(w.baseShield),
    mp: scale(w.mp),
    enemyHp: scale(w.enemyHp),
    enemyAlive: scale(w.enemyAlive),
    threat: scale(w.threat),
    lethal: Math.min(1, scale(w.lethal)),
    reach: scale(w.reach),
    urgency: scale(w.urgency),
    // The one weight that may change sign: an additive step, scaled to a unit's worth.
    forward: stream.nextFloat() < 0.5 ? w.forward + sigma * 20 * gauss(stream) : w.forward,
    round: scale(w.round),
  };
}

export function play(w: GuardWeights, search: GuardSearch, prefix: string, perScenario: number, scenarios?: readonly string[]): BattleResult[] {
  return runSuite(() => guardBot(w, search), prefix, perScenario, scenarios);
}

export function train(start: GuardWeights, options: TrainOptions): TrainResult {
  const stream = createRng(options.seed).policy.at(cardTrainKey());
  let battlesPlayed = 0;
  const score = (w: GuardWeights): number => {
    const results = play(w, options.search, options.trainPrefix, options.perScenario, options.scenarios);
    battlesPlayed += results.length;
    return meanFitness(results);
  };
  let best = start;
  let bestScore = score(start);
  const startFitness = bestScore;
  let sigma = options.sigma;
  let improvements = 0;
  for (let generation = 1; generation <= options.generations; generation++) {
    let improved = false;
    for (let i = 0; i < options.children; i++) {
      const child = mutate(best, stream, sigma);
      const childScore = score(child);
      if (childScore > bestScore) {
        best = child;
        bestScore = childScore;
        improved = true;
      }
    }
    if (improved) improvements++;
    sigma = improved ? Math.min(1, sigma * 1.3) : Math.max(0.05, sigma * 0.8);
    options.onGeneration?.(generation, bestScore, improved);
  }
  return { weights: best, startFitness, fitness: bestScore, improvements, battlesPlayed };
}
