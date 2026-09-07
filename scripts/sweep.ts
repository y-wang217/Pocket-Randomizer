/**
 * Play N runs headless and report what happened.
 *
 * This is the pacing instrument for Stage 1's playtest and the seed of Stage
 * 2's thousand-seed balance sweep. It is deliberately a thin loop around
 * `playRun` with a scripted policy: if it needed its own run loop, the numbers
 * it reports would be about that loop rather than about the game.
 *
 * Usage:
 *   npm run sweep                     # 200 runs, default tuning
 *   npm run sweep -- 500              # 500 runs
 *   npm run sweep -- 500 stepsPerSegment.min=4 stepsPerSegment.max=5
 *
 * Any dotted `Tuning` path can be overridden, which is the whole point of
 * every balance number living in one typed object.
 */
import { greedyAiPolicy } from '../src/core/battle/ai';
import type { Policy } from '../src/core/battle/policy';
import type { NodeSpec } from '../src/core/encounters';
import { hpFraction, ppTotals } from '../src/core/party';
import { playRun, segmentOf, type RunPolicy, type RunState } from '../src/core/run';
import { DEFAULT_TUNING, type Tuning } from '../src/data/tuning';

const args = process.argv.slice(2);
const count = Number(args[0]) || 200;
const tuning = applyOverrides(DEFAULT_TUNING, args.slice(1));

/** Prefers a kind when offered, so a sweep can compare playstyles. */
function preferring(kind: NodeSpec['kind'], battle: Policy): RunPolicy {
  return {
    chooseStarter: async () => 0,
    chooseNode: async (options) => {
      const index = options.findIndex((option) => option.kind === kind);
      return index === -1 ? 0 : index;
    },
    battle,
  };
}

interface Tally {
  label: string;
  wins: number;
  runs: number;
  nodes: number[];
  /** Turns per battle, not per run: the read on whether a fight is a fight. */
  turns: number[];
  /** HP fraction entering the gym, for the runs that got there. */
  gymHp: number[];
  gymPp: number[];
  rests: number[];
}

const playstyles: { label: string; policy: RunPolicy }[] = [
  { label: 'always rest when offered', policy: preferring('rest', greedyAiPolicy) },
  { label: 'never rest (first option)', policy: preferring('wild', greedyAiPolicy) },
  { label: 'always trainers', policy: preferring('trainer', greedyAiPolicy) },
];

const tallies: Tally[] = [];

for (const { label, policy } of playstyles) {
  const tally: Tally = { label, wins: 0, runs: 0, nodes: [], turns: [], gymHp: [], gymPp: [], rests: [] };

  for (let i = 0; i < count; i++) {
    let beforeGym: RunState | null = null;
    const run = await playRun(`SWEEP-${i}`, policy, tuning, {
      onState: (state) => {
        if (!state.outcome && state.starterIndex !== null && state.position >= segmentOf(state).steps.length) {
          beforeGym = state;
        }
      },
    });

    tally.runs++;
    if (run.outcome === 'victory') tally.wins++;
    tally.nodes.push(run.state.history.length);
    for (const visit of run.state.history) if (visit.result) tally.turns.push(visit.result.turns);
    tally.rests.push(run.state.history.filter((visit) => visit.node.kind === 'rest').length);

    const arrival = beforeGym as RunState | null;
    const member = arrival?.party[0];
    if (member) {
      tally.gymHp.push(hpFraction(member));
      const pp = ppTotals(member);
      tally.gymPp.push(pp.maxPp === 0 ? 0 : pp.pp / pp.maxPp);
    }
  }
  tallies.push(tally);
}

const pct = (value: number): string => `${(value * 100).toFixed(0)}%`;
const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

console.log(`\n${count} runs per playstyle, ${playstyles.length} playstyles, tuning:`);
console.log(`  steps ${tuning.stepsPerSegment.min}-${tuning.stepsPerSegment.max}`);
console.log(`  starter Lv${tuning.starterLevel}, wild ${fmtRange(tuning, 'wild')}, trainer ${fmtRange(tuning, 'trainer')}, gym ${fmtRange(tuning, 'gym')}\n`);

const head = ['playstyle', 'win', 'nodes', 'turns/fight', 'rests', 'HP@gym', 'PP@gym', 'reached'];
const rows = tallies.map((tally) => [
  tally.label,
  pct(tally.wins / tally.runs),
  mean(tally.nodes).toFixed(1),
  mean(tally.turns).toFixed(1),
  mean(tally.rests).toFixed(1),
  pct(mean(tally.gymHp)),
  pct(mean(tally.gymPp)),
  pct(tally.gymHp.length / tally.runs),
]);

const widths = head.map((_, column) => Math.max(head[column]!.length, ...rows.map((row) => row[column]!.length)));
const line = (cells: string[]): string => cells.map((cell, i) => cell.padEnd(widths[i]!)).join('  ');
console.log(line(head));
console.log(widths.map((width) => '-'.repeat(width)).join('  '));
for (const row of rows) console.log(line(row));
console.log();

function fmtRange(config: Tuning, kind: 'wild' | 'trainer' | 'gym'): string {
  const range = config.levelOffset[kind];
  return `${range.min >= 0 ? '+' : ''}${range.min}..${range.max >= 0 ? '+' : ''}${range.max}`;
}

/** `stepsPerSegment.min=4` -> a copy of the tuning with that path replaced. */
function applyOverrides(base: Tuning, overrides: string[]): Tuning {
  const next = structuredClone(base);
  for (const override of overrides) {
    const [path, raw] = override.split('=');
    if (!path || raw === undefined) throw new Error(`Bad override "${override}", want path=value`);
    const keys = path.split('.');
    const leaf = keys.pop();
    if (!leaf) throw new Error(`Bad override "${override}"`);
    let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (const key of keys) {
      const child = cursor[key];
      if (typeof child !== 'object' || child === null) throw new Error(`Unknown tuning path "${path}"`);
      cursor = child as Record<string, unknown>;
    }
    if (!(leaf in cursor)) throw new Error(`Unknown tuning key "${path}"`);
    cursor[leaf] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  }
  return next;
}
