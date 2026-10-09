/**
 * The guard bot's weights and search width. **Tuned values**: written by
 * `npm run cards:train -- --write`, which plays every scenario on a training
 * seed set, keeps the weights that score best, and checks them on a held-out
 * set. Every figure below carries the seed prefix and count it was measured
 * on; read down a prefix, never across.
 *
 * Trained 2026-10-09: 12 generations of 6 on GT0..GT19 in each of
 * skirmish, test, staggered; train fitness 1.5646 -> 1.5738.
 * Held out, GE0..GE59 in each scenario:
 *   the weights it started from, fitness 1.5507
 *     skirmish   won 60/60, units kept on a win 2.83, rounds to win 9.1
 *     test       won 60/60, units kept on a win 2.87, rounds to win 9.1
 *     staggered  won 60/60, units kept on a win 2.95, rounds to win 8.7
 *   these weights, as written (rounded to three places), fitness 1.5591
 *     skirmish   won 60/60, units kept on a win 2.88, rounds to win 8.4
 *     test       won 60/60, units kept on a win 2.88, rounds to win 8.3
 *     staggered  won 60/60, units kept on a win 2.98, rounds to win 7.6
 *   (The unrounded weights scored 1.5608, test 2.92 kept and 8.5 rounds: rounding
 *   shifts a few close calls. The trainer now checks the rounded weights.)
 *
 * A second run the same day, 30 generations of 6 at a wider step from these
 * weights on the same GT seeds, plateaued (train 1.5734 -> 1.5738) and scored
 * 1.5557 held out on GE0..GE59, below these; it was not written.
 *
 * Fitness is `core/cards/bench.ts`: a win is 1, plus up to 0.5 for the units
 * kept, plus up to 0.1 for winning sooner; a loss up to 0.25 for the damage it did.
 */
import type { GuardSearch, GuardWeights } from '../core/cards/defs';

export const GUARD_WEIGHTS: GuardWeights = {
  win: 956.46,
  unit: { A: 112.666, B: 60.245, C: 103.348 },
  hp: 15.23,
  baseShield: 3.889,
  mp: 1.67,
  enemyHp: 12.032,
  enemyAlive: 17.878,
  threat: 22.187,
  lethal: 0.784,
  reach: 6.101,
  urgency: 0.101,
  forward: 0.856,
  round: 2,
};

export const GUARD_SEARCH: GuardSearch = {
  beam: 4,
  maxPlays: 6,
  deployShortlist: 6,
};
