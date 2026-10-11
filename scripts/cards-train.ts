/**
 * Train the guard bot's weights and, with `--write`, ship them.
 *
 *   npm run cards:train -- [--generations 12] [--children 6] [--seeds 20] [--eval 60] [--sigma 0.35] [--write]
 *
 * Trains on seeds `GT0..` in every scenario, then checks the start weights and
 * the trained ones on held-out seeds `GE0..`. With `--write`, and only when
 * the trained weights do at least as well on the held-out seeds, it rewrites
 * `src/cardData/guardWeights.ts` with them and every figure stamped with its
 * seed prefix and count.
 */
import { writeFileSync } from 'node:fs';

import { BENCH_IDS } from '../src/cardData/encounters';
import { GUARD_SEARCH, GUARD_WEIGHTS } from '../src/cardData/guardWeights';
import { meanFitness, summarize } from '../src/core/cards/bench';
import type { GuardWeights } from '../src/core/cards/defs';
import { play, train } from '../src/core/cards/train';

const args = process.argv.slice(2).filter((a) => a !== '--');
const num = (name: string, fallback: number): number => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? Number(args[at + 1]) : fallback;
};
const generations = num('generations', 12);
const children = num('children', 6);
const perScenario = num('seeds', 20);
const evalSeeds = num('eval', 60);
const sigma = num('sigma', 0.35);
const TRAIN = 'GT';
const EVAL = 'GE';
const scenarios = BENCH_IDS;

console.log(`training on ${TRAIN}0..${TRAIN}${perScenario - 1} in ${scenarios.length} scenarios, ${generations} generations of ${children}`);
const t = performance.now();
const result = train(GUARD_WEIGHTS, {
  seed: 'GUARD-TRAIN',
  trainPrefix: TRAIN,
  perScenario,
  generations,
  children,
  sigma,
  search: GUARD_SEARCH,
  onGeneration: (g, best, improved) => console.log(`  generation ${String(g).padStart(2)}  best ${best.toFixed(4)}${improved ? '  improved' : ''}`),
});
console.log(`trained in ${((performance.now() - t) / 1000).toFixed(0)}s, ${result.battlesPlayed} battles; train fitness ${result.startFitness.toFixed(4)} -> ${result.fitness.toFixed(4)}`);

// Held out, the trained weights as they would be written: rounded to three places.
const shipped = round(result.weights);
const before = play(GUARD_WEIGHTS, GUARD_SEARCH, EVAL, evalSeeds);
const after = play(shipped, GUARD_SEARCH, EVAL, evalSeeds);
const line = (name: string, rs: typeof before): string =>
  `${name}: ` + summarize(rs).map((s) => `${s.encounterId} ${s.wins}/${s.battles} kept ${s.aliveOnWin.toFixed(2)} rounds ${s.roundsToWin.toFixed(1)}`).join('; ') + `; fitness ${meanFitness(rs).toFixed(4)}`;
console.log(`held out, ${EVAL}0..${EVAL}${evalSeeds - 1} per scenario:`);
console.log(`  ${line('start  ', before)}`);
console.log(`  ${line('trained', after)}`);
console.log(JSON.stringify(shipped, null, 2));

if (args.includes('--write')) {
  if (meanFitness(after) < meanFitness(before)) {
    console.log('not written: the trained weights do worse on the held-out seeds');
    process.exit(0);
  }
  writeFileSync('src/cardData/guardWeights.ts', source(shipped, before, after));
  console.log('written: src/cardData/guardWeights.ts');
}

function round(w: GuardWeights): GuardWeights {
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return { ...Object.fromEntries(Object.entries(w).map(([k, v]) => [k, typeof v === 'number' ? r(v) : v])), unit: { A: r(w.unit.A), B: r(w.unit.B), C: r(w.unit.C) } } as GuardWeights;
}

function source(w: GuardWeights, beforeRs: typeof before, afterRs: typeof after): string {
  const x = round(w);
  const date = new Date().toISOString().slice(0, 10);
  const rows = (rs: typeof before): string =>
    summarize(rs)
      .map((s) => ` *     ${s.encounterId.padEnd(10)} won ${s.wins}/${s.battles}, units kept on a win ${s.aliveOnWin.toFixed(2)}, rounds to win ${s.roundsToWin.toFixed(1)}`)
      .join('\n');
  return `/**
 * The guard bot's weights and search width. **Tuned values**: written by
 * \`npm run cards:train -- --write\`, which plays every scenario on a training
 * seed set, keeps the weights that score best, and checks them on a held-out
 * set. Every figure below carries the seed prefix and count it was measured
 * on; read down a prefix, never across.
 *
 * Trained ${date}: ${generations} generations of ${children} on ${TRAIN}0..${TRAIN}${perScenario - 1} in each of
 * ${scenarios.join(', ')}; train fitness ${result.startFitness.toFixed(4)} -> ${result.fitness.toFixed(4)}.
 * Held out, ${EVAL}0..${EVAL}${evalSeeds - 1} in each scenario:
 *   the weights it started from, fitness ${meanFitness(beforeRs).toFixed(4)}
${rows(beforeRs)}
 *   these weights, fitness ${meanFitness(afterRs).toFixed(4)}
${rows(afterRs)}
 *
 * Fitness is \`core/cards/bench.ts\`: a win is 1, plus up to 0.5 for the units
 * kept, plus up to 0.1 for winning sooner; a loss up to 0.25 for the damage it did.
 */
import type { GuardSearch, GuardWeights } from '../core/cards/defs';

export const GUARD_WEIGHTS: GuardWeights = {
  win: ${x.win},
  unit: { A: ${x.unit.A}, B: ${x.unit.B}, C: ${x.unit.C} },
  hp: ${x.hp},
  baseShield: ${x.baseShield},
  mp: ${x.mp},
  enemyHp: ${x.enemyHp},
  enemyAlive: ${x.enemyAlive},
  threat: ${x.threat},
  lethal: ${x.lethal},
  reach: ${x.reach},
  urgency: ${x.urgency},
  forward: ${x.forward},
  round: ${x.round},
};

export const GUARD_SEARCH: GuardSearch = {
  beam: ${GUARD_SEARCH.beam},
  maxPlays: ${GUARD_SEARCH.maxPlays},
  deployShortlist: ${GUARD_SEARCH.deployShortlist},
};
`;
}
