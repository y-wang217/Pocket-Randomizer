/**
 * Defender Mode v0's benchmark. **Step 6 of the prompt.**
 *
 *   npm run sim:defender -- [--seeds 200] [--prefix DEFENDER] [--write]
 *
 * One row per gym type: the same seeds, the same bot, the type the only
 * difference. Metric: mean bosses beaten. Every row is stamped with the seed
 * prefix, the seed count and `AI_VERSION`, beside `RANDOMIZER_VERSION`,
 * `RUN_LOG_VERSION` and `contentHash`. `--write` commits the report to
 * `sim-reports/benchmarks/`.
 *
 * **This bot does not read the Psychic reveal and does not hold a Fire
 * streak, so both rows understate their badge.** It never presses Flying's
 * fifth move on purpose either. The test of this mode is by hand.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AI_VERSION } from '../src/core/battle/ai';
import { CONTENT_HASH } from '../src/core/contentHash';
import { defenderBenchPolicy } from '../src/core/defender/bench';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { gymsCleared, playRun, RUN_LOG_VERSION } from '../src/core/run';
import { DEFENDER_GYM_TYPES, DEFENDER_RANKS } from '../src/data/defender';
import { DEFAULT_TUNING } from '../src/data/tuning';

const HEADER =
  'This bot does not read the Psychic reveal and does not hold a Fire streak, so both rows understate their badge. ' +
  'It never presses the Flying fifth move on purpose either. The test of this mode is by hand.';

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback;
}

const seeds = Number(arg('seeds', '200'));
const prefix = arg('prefix', 'DEFENDER');
const write = process.argv.includes('--write');

interface Row {
  gymType: string;
  seedPrefix: string;
  seedCount: number;
  aiVersion: string;
  meanBossesBeaten: number;
  completion: number;
  /** Runs that beat exactly n bosses, n = 0..8. */
  bossesBeaten: number[];
  /** Of the runs that reached boss n, the share that beat it. */
  bossClearRate: (number | null)[];
  meanRecruits: number;
  meanConsumablesUsed: number;
}

const rows: Row[] = [];
for (const [index, gymType] of DEFENDER_GYM_TYPES.entries()) {
  const beaten = Array<number>(DEFENDER_RANKS + 1).fill(0);
  const reached = Array<number>(DEFENDER_RANKS).fill(0);
  let recruits = 0;
  let consumed = 0;
  for (let i = 0; i < seeds; i++) {
    const run = await playRun(`${prefix}-${i}`, defenderBenchPolicy(index), DEFAULT_TUNING, { mode: 'defender' });
    const count = gymsCleared(run.state);
    beaten[count]!++;
    const bossesFaced = run.state.history.filter((visit) => visit.node.kind === 'gym').length;
    for (let boss = 0; boss < bossesFaced; boss++) reached[boss]!++;
    recruits += run.log.decisions.filter((d) => d.kind === 'recruit').length;
    consumed += run.log.decisions.filter((d) => d.kind === 'party' && d.edit.kind === 'consume').length;
  }
  const total = beaten.reduce((sum, n, k) => sum + n * k, 0);
  rows.push({
    gymType,
    seedPrefix: prefix,
    seedCount: seeds,
    aiVersion: AI_VERSION,
    meanBossesBeaten: Number((total / seeds).toFixed(3)),
    completion: Number(((beaten[DEFENDER_RANKS]! / seeds) * 100).toFixed(2)),
    bossesBeaten: beaten,
    bossClearRate: reached.map((n, boss) => {
      const cleared = beaten.slice(boss + 1).reduce((sum, k) => sum + k, 0);
      return n === 0 ? null : Number(((cleared / n) * 100).toFixed(1));
    }),
    meanRecruits: Number((recruits / seeds).toFixed(3)),
    meanConsumablesUsed: Number((consumed / seeds).toFixed(3)),
  });
  console.log(`${gymType}: mean bosses ${rows[rows.length - 1]!.meanBossesBeaten}`);
}

const report = {
  mode: 'defender',
  note: HEADER,
  randomizerVersion: RANDOMIZER_VERSION,
  runLogVersion: RUN_LOG_VERSION,
  contentHash: CONTENT_HASH,
  aiVersion: AI_VERSION,
  policy: 'defenderBenchPolicy: greedy battles, first door, never trades, consumable under half HP',
  rows,
};

console.log(HEADER);
console.log(JSON.stringify(rows.map(({ gymType, meanBossesBeaten, completion, bossClearRate, meanRecruits, meanConsumablesUsed }) => ({ gymType, meanBossesBeaten, completion, bossClearRate, meanRecruits, meanConsumablesUsed })), null, 1));
if (write) {
  const dir = join(process.cwd(), 'sim-reports', 'benchmarks');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(dir, `${stamp}-defender-v0-${RANDOMIZER_VERSION}-${seeds}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path}`);
}
