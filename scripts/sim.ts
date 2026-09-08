/**
 * The headless balance simulator.
 *
 *   npm run sim -- --seeds 1000 --policy greedy
 *
 * This is the Stage 2 deliverable that matters most, and the reason is one
 * sentence: **you cannot balance a roguelike by playing it.** A designer can
 * play fifty runs in an afternoon and will remember the three that were
 * memorable. This plays a thousand in forty seconds and reports the
 * distribution, which is the only thing a difficulty curve is.
 *
 * It is deliberately a thin loop around `playRun`. Not a re-implementation of
 * the run loop with the UI parts removed — the *same* function the browser
 * calls, driven by a different `RunPolicy`. A simulator with its own run loop
 * measures its own run loop, and drifts out of agreement with the game at
 * exactly the moment the numbers start being used to make decisions.
 *
 * ## What it reports, and why each number is here
 *
 *   - **Clear rate per gym**, plus the drop from the previous gym. A curve is
 *     not "hard at the end", it is a slope, and the failure mode is a cliff:
 *     one gym that halves the population. The delta column is what finds it.
 *   - **Completion rate.** The headline, and the least informative number on
 *     its own.
 *   - **Cause of death**, split three ways: which gym, which opposing species,
 *     which move landed the kill. "Runs end at gym 4" is a hypothesis; "runs
 *     end at gym 4 to Sheer Force Boomburst off a Regigigas" is a fix.
 *   - **Turns per battle, per segment.** Stage 1's finding was that fights
 *     lasted 1.5 turns whatever the levels were, because a fully evolved
 *     Pokemon's best move one-shots another one. This is the number that says
 *     whether the move bands fixed it.
 *   - **Outlier seeds**, printed so they can be replayed in the browser. A
 *     distribution tells you there is a problem; a seed lets you watch it.
 *   - **Diversity.** The Stage 2 done condition is that each seed feels
 *     different, and win rate cannot measure that at all. If one species or one
 *     ability shows up in a disproportionate share of runs, the pools are too
 *     narrow — and a narrow pool that happens to be balanced would pass every
 *     other number in this report.
 *
 * ## The two policies
 *
 * `greedy` is the Stage 0 damage-maximising AI; `random` picks a legal move at
 * random from a seeded stream. **The gap between their win rates is the crude
 * measure of whether player skill matters.** If `random` clears gym 6, the game
 * has no depth and no amount of tuning the level curve will give it any.
 *
 * Both policies make the *same* node choices, so the gap measures move choice
 * and nothing else. `--nodes` compares node policies instead, which is the
 * other question and a different run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { ENGINE_VERSION } from '../src/core/battle/driver';
import { usableMoves, usableSwitches, type Policy } from '../src/core/battle/policy';
import type { NodeSpec } from '../src/core/encounters';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { createRng, type RngStream } from '../src/core/rng';
import {
  causeOfDeath,
  gymsCleared,
  playRun,
  RUN_LOG_VERSION,
  SEGMENTS_PER_RUN,
  type CauseOfDeath,
  type RunPolicy,
} from '../src/core/run';
import { describeSpecCard } from '../src/core/battle/driver';
import { moveChoice, switchChoice, type PokemonSpec } from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import { opponentTeamSize, PARTY_SIZE, SEGMENTS } from '../src/data/scaling';
import { DEFAULT_TUNING, type Tuning } from '../src/data/tuning';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

type PolicyName = 'greedy' | 'random';
type NodePolicyName = 'rest' | 'wild' | 'trainer' | 'first' | 'random';

interface Options {
  seeds: number;
  policies: PolicyName[];
  nodePolicies: NodePolicyName[];
  prefix: string;
  outDir: string;
  tuning: Tuning;
  quiet: boolean;
}

const ALL_POLICIES: PolicyName[] = ['greedy', 'random'];
const ALL_NODE_POLICIES: NodePolicyName[] = ['rest', 'wild', 'trainer', 'first'];

function parseArgs(argv: string[]): Options {
  const options: Options = {
    seeds: 200,
    policies: ALL_POLICIES,
    nodePolicies: ['rest'],
    prefix: 'SIM',
    outDir: 'sim-reports',
    tuning: structuredClone(DEFAULT_TUNING),
    quiet: false,
  };
  const overrides: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };

    switch (arg) {
      case '--seeds':
      case '-n':
        options.seeds = Number(value());
        break;
      case '--policy': {
        const name = value();
        options.policies = name === 'all' ? ALL_POLICIES : [assertPolicy(name)];
        break;
      }
      case '--nodes': {
        const name = value();
        options.nodePolicies = name === 'all' ? ALL_NODE_POLICIES : [assertNodePolicy(name)];
        break;
      }
      case '--prefix':
        options.prefix = value();
        break;
      case '--out':
        options.outDir = value();
        break;
      case '--set':
        overrides.push(value());
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        // A bare number is the seed count, so `npm run sim -- 500` works the
        // way the Stage 1 sweep did.
        if (/^\d+$/.test(arg)) options.seeds = Number(arg);
        else throw new Error(`Unknown argument "${arg}"\n${USAGE}`);
    }
  }

  if (!Number.isInteger(options.seeds) || options.seeds < 1) {
    throw new Error(`--seeds needs a positive integer, got ${options.seeds}`);
  }
  applyOverrides(options.tuning, overrides);
  return options;
}

function assertPolicy(name: string): PolicyName {
  if (name !== 'greedy' && name !== 'random') {
    throw new Error(`--policy must be greedy, random or all (got "${name}")`);
  }
  return name;
}

function assertNodePolicy(name: string): NodePolicyName {
  if (!ALL_NODE_POLICIES.includes(name as NodePolicyName) && name !== 'random') {
    throw new Error(`--nodes must be one of ${ALL_NODE_POLICIES.join(', ')}, random, or all`);
  }
  return name as NodePolicyName;
}

const USAGE = `
  npm run sim -- [options]

    --seeds N        how many seeds to play per policy (default 200)
    --policy NAME    greedy | random | all          (default all)
    --nodes NAME     rest | wild | trainer | first | random | all   (default rest)
    --prefix TEXT    seed prefix, so two sweeps can use different populations
    --out DIR        where the JSON report lands   (default sim-reports)
    --set path=value override a Tuning field, e.g. --set stepsPerSegment.min=4
    --quiet          JSON only, no table

  The balance levers themselves live in src/data/scaling.ts and are edited
  there; --set reaches the map-shape knobs in src/data/tuning.ts.
`;

/** `stepsPerSegment.min=4` -> that path replaced on the tuning object. */
function applyOverrides(tuning: Tuning, overrides: string[]): void {
  for (const override of overrides) {
    const [path, raw] = override.split('=');
    if (!path || raw === undefined) throw new Error(`Bad override "${override}", want path=value`);
    const keys = path.split('.');
    const leaf = keys.pop();
    if (!leaf) throw new Error(`Bad override "${override}"`);
    let cursor: Record<string, unknown> = tuning as unknown as Record<string, unknown>;
    for (const key of keys) {
      const child = cursor[key];
      if (typeof child !== 'object' || child === null) throw new Error(`Unknown tuning path "${path}"`);
      cursor = child as Record<string, unknown>;
    }
    if (!(leaf in cursor)) throw new Error(`Unknown tuning key "${path}"`);
    cursor[leaf] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  }
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/**
 * Picks a legal move at random, from a seeded stream.
 *
 * The stream is `policy`, which exists for exactly this (see core/rng.ts). A
 * scripted bot borrowing the `battle` stream would change the damage rolls of
 * the battle it is playing, and the random policy's win rate would then be
 * measured against a different game from the greedy policy's.
 */
function randomMovePolicy(stream: RngStream): Policy {
  return async (view) => {
    if (view.forceSwitch) {
      const available = usableSwitches(view);
      const chosen = stream.pick(available);
      return switchChoice(chosen.slot);
    }
    const moves = usableMoves(view);
    return moveChoice(stream.pick(moves).slot);
  };
}

/**
 * The starter a policy picks.
 *
 * `greedy` takes the highest base stat total, which is what a player does when
 * handed three Pokemon and no other information. `random` takes one at random.
 * Both are deterministic given the seed; ties break toward the lower index so
 * the choice never depends on iteration order.
 *
 * This matters more than it looks: with `PARTY_SIZE = 1` the starter is the
 * entire run, so a starter policy that picked badly would report a difficulty
 * curve that is mostly a measurement of itself.
 */
function bestStarter(options: PokemonSpec[]): number {
  let best = 0;
  let bestHp = -1;
  for (const [index, option] of options.entries()) {
    // Max HP at the starter's level is the one bulk number available without
    // reaching into the species pool, and it correlates with what survives.
    const hp = describeSpecCard(option).maxHp;
    if (hp > bestHp) {
      bestHp = hp;
      best = index;
    }
  }
  return best;
}

/** Prefers a node kind when a step offers it. `first` always takes index 0. */
function chooseNodeBy(kind: NodePolicyName, stream: RngStream) {
  return async (options: NodeSpec[]): Promise<number> => {
    if (kind === 'first') return 0;
    if (kind === 'random') return stream.nextInt(Math.max(1, options.length));
    const index = options.findIndex((option) => option.kind === kind);
    return index === -1 ? 0 : index;
  };
}

function buildPolicy(policy: PolicyName, nodes: NodePolicyName, seed: string): RunPolicy {
  const stream = createRng(seed).policy;
  return {
    chooseStarter: async (options) =>
      policy === 'greedy' ? bestStarter(options) : stream.nextInt(Math.max(1, options.length)),
    chooseNode: chooseNodeBy(nodes, stream),
    // Checkpoint 4 replaces these with policies worth measuring. What they do
    // now is keep the sweep running and keep currency from being dead: a
    // shopper that buys nothing makes every currency number in the report a
    // measurement of money nobody spent.
    chooseReward: async () => 0,
    chooseShopPurchases: async (stock, state) => {
      const basket: number[] = [];
      let left = state.currency;
      // Cheapest first, so a small balance still buys something rather than
      // being held for a shelf item it can never reach.
      const order = stock.items
        .map((item, index) => ({ index, price: item.price }))
        .sort((a, b) => a.price - b.price || a.index - b.index);
      for (const { index, price } of order) {
        if (price > left) continue;
        basket.push(index);
        left -= price;
      }
      return basket;
    },
    chooseEventOption: async () => 0,
    battle: policy === 'greedy' ? greedyAiPolicy : randomMovePolicy(stream),
  };
}

// ---------------------------------------------------------------------------
// Playing the sample
// ---------------------------------------------------------------------------

interface Encounter {
  species: string;
  ability: string;
}

interface RunRecord {
  seed: string;
  outcome: 'victory' | 'defeat';
  gymsCleared: number;
  /** The 1-based gym this run actually fought last, or 0 if it never got there. */
  deepestGymFought: number;
  nodes: number;
  totalTurns: number;
  /** Turns spent in each battle, tagged with the segment it happened in. */
  battles: { segment: number; kind: NodeSpec['kind']; turns: number }[];
  /** Every opposing Pokemon actually fought. Diversity is measured on these. */
  encounters: Encounter[];
  death: CauseOfDeath | null;
  starter: string;
}

async function playSample(
  policy: PolicyName,
  nodes: NodePolicyName,
  options: Options,
  onProgress: (done: number) => void,
): Promise<RunRecord[]> {
  const records: RunRecord[] = [];

  for (let index = 0; index < options.seeds; index++) {
    const seed = `${options.prefix}-${index}`;
    const run = await playRun(seed, buildPolicy(policy, nodes, seed), options.tuning);
    const { state } = run;

    const battles = state.history
      .filter((visit) => visit.result)
      .map((visit) => ({ segment: visit.segment, kind: visit.node.kind, turns: visit.result?.turns ?? 0 }));

    const encounters = state.history.flatMap((visit) =>
      (visit.node.encounter?.team ?? []).map((member) => ({
        species: member.species,
        ability: member.ability,
      })),
    );

    const gymFights = state.history.filter((visit) => visit.node.kind === 'gym');

    records.push({
      seed,
      outcome: run.outcome,
      gymsCleared: gymsCleared(state),
      deepestGymFought: gymFights.length === 0 ? 0 : (gymFights[gymFights.length - 1]?.segment ?? 0) + 1,
      nodes: state.history.length,
      totalTurns: battles.reduce((total, battle) => total + battle.turns, 0),
      battles,
      encounters,
      death: causeOfDeath(state),
      starter: state.party[0]?.spec.species ?? '',
    });
    onProgress(index + 1);
  }
  return records;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

interface GymRow {
  gym: number;
  leader: string;
  type: string;
  teamSize: number;
  reached: number;
  cleared: number;
  clearRate: number;
  /** Percentage points this gym's clear rate sits below the previous gym's. */
  dropFromPrevious: number;
}

interface Tally {
  label: string;
  count: number;
  share: number;
}

interface Sample {
  policy: PolicyName;
  nodes: NodePolicyName;
  runs: number;
  completionRate: number;
  meanGymsCleared: number;
  perGym: GymRow[];
  turnsBySegment: { segment: number; battles: number; meanTurns: number }[];
  deaths: {
    byGym: Tally[];
    bySpecies: Tally[];
    byMove: Tally[];
    indirect: Tally[];
  };
  outliers: {
    fastestWin: { seed: string; turns: number; nodes: number } | null;
    earliestLoss: { seed: string; gymsCleared: number; nodes: number; death: CauseOfDeath | null } | null;
  };
  diversity: {
    encounters: number;
    distinctSpecies: number;
    topSpecies: Tally[];
    distinctAbilities: number;
    topAbilities: Tally[];
    /** Share of *runs* the single most common species appears in. */
    topSpeciesRunShare: number;
    topAbilityRunShare: number;
    distinctStarters: number;
  };
  durationMs: number;
}

function tally(values: string[], top: number): Tally[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([label, count]) => ({ label, count, share: values.length === 0 ? 0 : count / values.length }));
}

/** How many runs contain at least one of `label`. Narrower pools show up here. */
function runShare(records: RunRecord[], pick: (record: RunRecord) => string[], label: string): number {
  if (records.length === 0 || label === '') return 0;
  return records.filter((record) => pick(record).includes(label)).length / records.length;
}

function summarize(
  policy: PolicyName,
  nodes: NodePolicyName,
  records: RunRecord[],
  durationMs: number,
): Sample {
  const runs = records.length;

  const perGym: GymRow[] = GYMS.map((gym) => {
    const number = gym.segment + 1;
    const reached = records.filter((record) => record.deepestGymFought >= number).length;
    const cleared = records.filter((record) => record.gymsCleared >= number).length;
    return {
      gym: number,
      leader: gym.leader,
      type: gym.type,
      // Read from the curve rather than written as a literal, so the column
      // cannot drift out of agreement with what the gym actually fielded.
      teamSize: opponentTeamSize('gym', gym.segment, 'normal', gym.teamSize),
      reached,
      cleared,
      clearRate: reached === 0 ? 0 : cleared / reached,
      dropFromPrevious: 0,
    };
  });
  for (const [index, row] of perGym.entries()) {
    const previous = perGym[index - 1];
    row.dropFromPrevious = previous ? (previous.clearRate - row.clearRate) * 100 : 0;
  }

  const turnsBySegment = SEGMENTS.map((segment) => {
    const battles = records.flatMap((record) => record.battles.filter((battle) => battle.segment === segment.segment));
    return {
      segment: segment.segment,
      battles: battles.length,
      meanTurns: battles.length === 0 ? 0 : battles.reduce((total, b) => total + b.turns, 0) / battles.length,
    };
  });

  const deaths = records.map((record) => record.death).filter((death): death is CauseOfDeath => death !== null);

  const wins = records.filter((record) => record.outcome === 'victory');
  const fastestWin = wins.reduce<RunRecord | null>(
    (best, record) => (!best || record.totalTurns < best.totalTurns ? record : best),
    null,
  );
  const losses = records.filter((record) => record.outcome === 'defeat');
  const earliestLoss = losses.reduce<RunRecord | null>(
    (worst, record) =>
      !worst || record.gymsCleared < worst.gymsCleared || (record.gymsCleared === worst.gymsCleared && record.nodes < worst.nodes)
        ? record
        : worst,
    null,
  );

  const allSpecies = records.flatMap((record) => record.encounters.map((encounter) => encounter.species));
  const allAbilities = records.flatMap((record) => record.encounters.map((encounter) => encounter.ability));
  const topSpecies = tally(allSpecies, 10);
  const topAbilities = tally(allAbilities, 10);

  return {
    policy,
    nodes,
    runs,
    completionRate: runs === 0 ? 0 : wins.length / runs,
    meanGymsCleared: runs === 0 ? 0 : records.reduce((total, r) => total + r.gymsCleared, 0) / runs,
    perGym,
    turnsBySegment,
    deaths: {
      byGym: tally(deaths.map((death) => `gym ${death.segment + 1} (${death.leader})`), SEGMENTS_PER_RUN),
      bySpecies: tally(deaths.map((death) => death.bySpecies ?? '(indirect)'), 10),
      byMove: tally(deaths.map((death) => death.byMove ?? '(no move)'), 10),
      indirect: tally(deaths.filter((death) => !death.byMove).map((death) => death.indirect ?? '(unknown)'), 5),
    },
    outliers: {
      fastestWin: fastestWin
        ? { seed: fastestWin.seed, turns: fastestWin.totalTurns, nodes: fastestWin.nodes }
        : null,
      earliestLoss: earliestLoss
        ? {
            seed: earliestLoss.seed,
            gymsCleared: earliestLoss.gymsCleared,
            nodes: earliestLoss.nodes,
            death: earliestLoss.death,
          }
        : null,
    },
    diversity: {
      encounters: allSpecies.length,
      distinctSpecies: new Set(allSpecies).size,
      topSpecies,
      distinctAbilities: new Set(allAbilities).size,
      topAbilities,
      topSpeciesRunShare: runShare(records, (r) => r.encounters.map((e) => e.species), topSpecies[0]?.label ?? ''),
      topAbilityRunShare: runShare(records, (r) => r.encounters.map((e) => e.ability), topAbilities[0]?.label ?? ''),
      distinctStarters: new Set(records.map((record) => record.starter)).size,
    },
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function table(head: string[], rows: string[][]): string {
  const widths = head.map((_, column) =>
    Math.max(head[column]?.length ?? 0, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  const line = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [line(head), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

function render(sample: Sample): string {
  const out: string[] = [];
  const title = `policy ${sample.policy} · nodes ${sample.nodes} · ${sample.runs} seeds · ${(sample.durationMs / 1000).toFixed(1)}s`;
  out.push('', title, '='.repeat(title.length));

  out.push('', 'Clear rate per gym — of the runs that reached it');
  out.push(
    table(
      ['gym', 'leader', 'type', 'team', 'reached', 'cleared', 'clear rate', 'drop'],
      sample.perGym.map((row) => [
        String(row.gym),
        row.leader,
        row.type,
        String(row.teamSize),
        String(row.reached),
        String(row.cleared),
        pct(row.clearRate),
        row.gym === 1 ? '—' : `${row.dropFromPrevious >= 0 ? '-' : '+'}${Math.abs(row.dropFromPrevious).toFixed(0)}pt`,
      ]),
    ),
  );

  out.push(
    '',
    `Run completion: ${pct(sample.completionRate)}   ·   mean gyms cleared: ${sample.meanGymsCleared.toFixed(2)} / ${SEGMENTS_PER_RUN}`,
  );

  out.push('', 'Turns per battle, by segment');
  out.push(
    table(
      ['segment', 'battles', 'mean turns'],
      sample.turnsBySegment.map((row) => [
        String(row.segment + 1),
        String(row.battles),
        row.meanTurns.toFixed(2),
      ]),
    ),
  );

  if (sample.deaths.byGym.length > 0) {
    out.push('', 'Cause of death — where');
    out.push(
      table(
        ['segment', 'runs', 'share'],
        sample.deaths.byGym.map((row) => [row.label, String(row.count), pct(row.share)]),
      ),
    );
    out.push('', 'Cause of death — what killed them');
    out.push(
      table(
        ['species', 'runs', 'share', '', 'move', 'runs', 'share'],
        sample.deaths.bySpecies.map((row, index) => {
          const move = sample.deaths.byMove[index];
          return [
            row.label,
            String(row.count),
            pct(row.share),
            '',
            move?.label ?? '',
            move ? String(move.count) : '',
            move ? pct(move.share) : '',
          ];
        }),
      ),
    );
  }

  out.push('', 'Outlier seeds — replay these in the browser');
  const { fastestWin, earliestLoss } = sample.outliers;
  out.push(
    fastestWin
      ? `  fastest win    ${fastestWin.seed}  (${fastestWin.turns} turns over ${fastestWin.nodes} nodes)`
      : '  fastest win    none — no run finished',
  );
  out.push(
    earliestLoss
      ? `  earliest loss  ${earliestLoss.seed}  (${earliestLoss.gymsCleared} gyms, ${earliestLoss.nodes} nodes` +
          `${earliestLoss.death ? `, to ${describeDeath(earliestLoss.death)}` : ''})`
      : '  earliest loss  none — no run was lost',
  );

  out.push('', 'Diversity — the number win rate cannot measure');
  out.push(
    `  ${sample.diversity.distinctSpecies} distinct species and ${sample.diversity.distinctAbilities} distinct abilities across ` +
      `${sample.diversity.encounters} encounters; ${sample.diversity.distinctStarters} distinct starters chosen`,
  );
  out.push(
    table(
      ['top species', 'seen', 'of all', 'in runs', '', 'top ability', 'seen', 'of all'],
      sample.diversity.topSpecies.map((row, index) => {
        const ability = sample.diversity.topAbilities[index];
        return [
          row.label,
          String(row.count),
          pct(row.share),
          index === 0 ? pct(sample.diversity.topSpeciesRunShare) : '',
          '',
          ability?.label ?? '',
          ability ? String(ability.count) : '',
          ability ? pct(ability.share) : '',
        ];
      }),
    ),
  );
  out.push(...verdicts(sample));
  return out.join('\n');
}

function describeDeath(death: CauseOfDeath): string {
  const killer = death.bySpecies ?? death.indirect ?? 'something';
  return death.byMove ? `${killer}'s ${death.byMove}` : killer;
}

/**
 * The report reading itself against the Stage 2 targets.
 *
 * These are the spec's starting hypotheses, not truths, and the line says so.
 * Printing them is what turns a wall of numbers into a decision — a reader who
 * has to remember four thresholds to interpret a table will not.
 */
function verdicts(sample: Sample): string[] {
  const lines: string[] = ['', 'Against the Stage 2 targets (starting hypotheses, not truths)'];
  const gym1 = sample.perGym[0];
  const worst = sample.perGym.reduce((a, b) => (b.dropFromPrevious > a.dropFromPrevious ? b : a));

  const check = (ok: boolean, text: string): string => `  ${ok ? 'ok  ' : 'MISS'}  ${text}`;

  if (sample.policy === 'greedy') {
    lines.push(check(!!gym1 && gym1.clearRate >= 0.85 && gym1.clearRate <= 0.95, `gym 1 clear rate ${pct(gym1?.clearRate ?? 0)} (target ~90%)`));
    lines.push(check(sample.completionRate >= 0.05 && sample.completionRate <= 0.15, `full run completion ${pct(sample.completionRate)} (target 5-15%)`));
  } else {
    // Two lines, because the spec's sentence about the random policy is really
    // two claims and only the second one is a depth test. "Rarely gets past gym
    // 3" is about how forgiving the early game is; "if a random policy clears
    // gym 6, the game has no depth" is about whether move choice matters at
    // all, and that is the one worth failing a build over.
    const past3 = (sample.perGym[2]?.cleared ?? 0) / Math.max(1, sample.runs);
    const clearedSix = (sample.perGym[5]?.cleared ?? 0) / Math.max(1, sample.runs);
    lines.push(check(past3 <= 0.25, `random gets past gym 3 in ${pct(past3)} of runs (target: rarely)`));
    lines.push(check(clearedSix <= 0.02, `random clears gym 6 in ${pct(clearedSix)} of runs — the depth test (target: ~never)`));
    lines.push(check(sample.completionRate <= 0.01, `random completes a run in ${pct(sample.completionRate)} (target: ~never)`));
  }
  lines.push(check(worst.dropFromPrevious <= 25, `steepest drop ${worst.dropFromPrevious.toFixed(0)}pt at gym ${worst.gym} (${worst.leader}) (target <=25pt)`));
  lines.push(
    check(
      sample.diversity.topSpeciesRunShare <= 0.25,
      `most common species (${sample.diversity.topSpecies[0]?.label ?? '—'}) appears in ${pct(sample.diversity.topSpeciesRunShare)} of runs (target <=25%)`,
    ),
  );
  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const options = parseArgs(process.argv.slice(2));
const samples: Sample[] = [];
const startedAt = new Date();

for (const nodes of options.nodePolicies) {
  for (const policy of options.policies) {
    const label = `${policy}/${nodes}`;
    const started = Date.now();
    const records = await playSample(policy, nodes, options, (done) => {
      if (options.quiet || done % 50 !== 0) return;
      process.stderr.write(`\r  ${label}: ${done}/${options.seeds}   `);
    });
    if (!options.quiet) process.stderr.write(`\r  ${label}: ${options.seeds}/${options.seeds}   \n`);
    samples.push(summarize(policy, nodes, records, Date.now() - started));
  }
}

const report = {
  generatedAt: startedAt.toISOString(),
  // Stamped so a report can be matched to the data that produced it. A balance
  // report whose randomizer version you cannot recover is a screenshot.
  randomizerVersion: RANDOMIZER_VERSION,
  runLogVersion: RUN_LOG_VERSION,
  engineVersion: ENGINE_VERSION,
  partySize: PARTY_SIZE,
  segments: SEGMENTS_PER_RUN,
  seedPrefix: options.prefix,
  seeds: options.seeds,
  tuning: options.tuning,
  scaling: SEGMENTS,
  samples,
};

mkdirSync(options.outDir, { recursive: true });
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const file = join(options.outDir, `${stamp}-${RANDOMIZER_VERSION}-${options.seeds}.json`);
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

if (!options.quiet) {
  for (const sample of samples) console.log(render(sample));
  if (samples.length > 1) {
    console.log('\nSide by side');
    console.log(comparison(samples));
  }
}
console.log(`\nreport written to ${file}`);

/**
 * The one number two samples exist to produce.
 *
 * The gap between greedy and random is the crude measure of whether player
 * skill matters. It is printed last because it is the only line in the whole
 * report that no single sample can produce.
 */
function comparison(all: Sample[]): string {
  return table(
    ['policy', 'nodes', 'completion', 'mean gyms', 'gym 1', 'gym 4', 'gym 8'],
    all.map((sample) => [
      sample.policy,
      sample.nodes,
      pct(sample.completionRate),
      sample.meanGymsCleared.toFixed(2),
      pct(sample.perGym[0]?.clearRate ?? 0),
      pct(sample.perGym[3]?.clearRate ?? 0),
      pct(sample.perGym[7]?.clearRate ?? 0),
    ]),
  );
}
