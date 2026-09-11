/**
 * The visual identity baseline: what a seeded run produces before any visual
 * stage touched the tree, written to `docs/visual/baseline/` once and diffed by
 * every stage after it.
 *
 * Presentation stages are allowed to change pixels and nothing else. The way
 * that rule is checked is not by reading the diff, it is by replaying a fixed
 * set of seeds headless and comparing the bytes: the decision log, the outcome,
 * every node visited, every casualty, the battle protocol of the determinism
 * seed, and a digest of every file under `src/data/`. If any of those move, a
 * "CSS only" change was not CSS only.
 *
 *   npx vite-node scripts/visual/baseline.ts --write    # write the baseline
 *   npx vite-node scripts/visual/baseline.ts --check    # diff against it
 *
 * `test/visual-baseline.test.ts` runs the check under `npm test`, so the gate
 * cannot be skipped by forgetting to run this.
 *
 * The seeds: SMOKE24 is the browser smoke seed and the one the overnight
 * prompts name. GYMRUN01, SEED-A and SEED-B are the determinism suite's. The
 * RESULT seeds are the result-screen suite's, kept because they are short.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { AI_VERSION, greedyAiPolicy } from '../../src/core/battle/ai';
import { ENGINE_VERSION, runBattle, stripNondeterministic } from '../../src/core/battle/driver';
import { CONTENT_HASH } from '../../src/core/contentHash';
import { RANDOMIZER_VERSION } from '../../src/core/randomizer';
import { causeOfDeath, gymsCleared, playRun, RUN_LOG_VERSION, scriptedRunPolicy } from '../../src/core/run';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../../src/data/mons';
import { DEFAULT_TUNING } from '../../src/data/tuning';

const ROOT = process.cwd();
export const BASELINE_DIR = join(ROOT, 'docs/visual/baseline');

export const RUN_SEEDS = ['SMOKE24', 'GYMRUN01', 'SEED-A', 'SEED-B', 'RESULT-0', 'RESULT-1'] as const;
export const BATTLE_SEED = 'GYMRUN01';

/** Every file the baseline is made of, relative to `docs/visual/baseline/`. */
export interface Baseline {
  files: Record<string, string>;
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

/**
 * A digest over `src/data/`. **Not `contentHash`.** That is its own release
 * (docs/generation.md section 9) and is not to be built as a side effect of
 * anything else. This is a plain sha256 over the source bytes of the data
 * tables, so a stage can assert it did not touch them, and nothing reads it
 * but this script.
 */
export function dataDigest(): string {
  const hash = createHash('sha256');
  for (const file of walk(join(ROOT, 'src/data'))) {
    hash.update(relative(ROOT, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function recordRun(seed: string): Promise<string> {
  const result = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, {
    opponent: greedyAiPolicy,
  });
  const state = result.state;
  const record = {
    seed,
    versions: { runLog: RUN_LOG_VERSION, contentHash: CONTENT_HASH, randomizer: RANDOMIZER_VERSION, ai: AI_VERSION, engine: ENGINE_VERSION },
    outcome: result.outcome,
    gymsCleared: gymsCleared(state),
    causeOfDeath: causeOfDeath(state),
    currency: state.currency,
    backpack: state.backpack,
    relics: state.relics,
    party: state.party.map((member) => ({
      species: member.spec.species,
      level: member.spec.level,
      ability: member.spec.ability,
      moves: member.moves.map((move) => `${move.name} ${move.pp}/${move.maxPp}`),
      item: member.item ?? null,
      hp: `${member.hp}/${member.maxHp}`,
      fainted: member.fainted,
    })),
    history: state.history.map((visit) => ({
      segment: visit.segment,
      kind: visit.node.kind,
      label: visit.node.label,
      tier: visit.node.tier ?? null,
      opponent: visit.node.encounter?.opponent ?? null,
      turns: visit.result?.turns ?? null,
      winner: visit.result?.winner ?? null,
      hpAfter: visit.hpAfter,
      casualties: visit.casualties,
    })),
    log: result.log,
  };
  return `${JSON.stringify(record, null, 2)}\n`;
}

async function recordBattle(seed: string): Promise<string> {
  const battle = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, seed, greedyAiPolicy, greedyAiPolicy);
  return `${JSON.stringify(
    {
      seed,
      simSeed: battle.session.simSeed,
      result: battle.result,
      decisions: battle.battleLog.decisions,
      protocol: stripNondeterministic(battle.protocol),
    },
    null,
    2,
  )}\n`;
}

export async function buildBaseline(): Promise<Baseline> {
  const files: Record<string, string> = {};
  for (const seed of RUN_SEEDS) files[`runs/${seed}.json`] = await recordRun(seed);
  files[`battles/${BATTLE_SEED}.json`] = await recordBattle(BATTLE_SEED);
  files['data-digest.txt'] = `${dataDigest()}\n`;
  return { files };
}

export function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_DIR)) return null;
  const files: Record<string, string> = {};
  for (const file of walk(BASELINE_DIR)) {
    const name = relative(BASELINE_DIR, file);
    if (name.endsWith('.json') || name.endsWith('.txt')) files[name] = readFileSync(file, 'utf8');
  }
  return { files };
}

/** Which baseline files differ from a fresh recording. Empty means byte identical. */
export function diffBaseline(recorded: Baseline, fresh: Baseline): string[] {
  const names = new Set([...Object.keys(recorded.files), ...Object.keys(fresh.files)]);
  return [...names].filter((name) => {
    // Files only this script writes are compared; anything else in the
    // directory (heights, the README) is another tool's.
    if (!(name in fresh.files)) return false;
    return recorded.files[name] !== fresh.files[name];
  });
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const fresh = await buildBaseline();

  if (check) {
    const recorded = readBaseline();
    if (!recorded) {
      console.error('no baseline at docs/visual/baseline/. Run with --write first, on main.');
      process.exit(2);
    }
    const differing = diffBaseline(recorded, fresh);
    if (differing.length > 0) {
      console.error(`baseline differs in ${differing.length} file(s):`);
      for (const name of differing) console.error(`  - ${name}`);
      process.exit(1);
    }
    console.log(`baseline byte identical across ${Object.keys(fresh.files).length} files`);
    return;
  }

  for (const [name, body] of Object.entries(fresh.files)) {
    const target = join(BASELINE_DIR, name);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, body);
    console.log(`wrote ${relative(ROOT, target)} (${body.length} bytes)`);
  }
}

// vite-node drops the script path from argv, so the mode flag is what says
// this was run as a script; the test imports the functions and passes neither.
if (process.argv.includes('--write') || process.argv.includes('--check')) {
  await main();
}
