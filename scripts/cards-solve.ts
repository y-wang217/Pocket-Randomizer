/**
 * Solve one battle on one seed and save the line as a log.
 *
 *   npm run cards:solve -- <scenario> <seed> [out.json] [--width 12] [--branch 4]
 *
 * The solver plays ahead, so it sees the draws a player cannot
 * (`src/core/cards/solve.ts`); it says whether and how well a seed can be won.
 * The saved log replays and narrates like a log copied from the sandbox:
 * `npm run cards:narrate -- out.json`.
 */
import { writeFileSync } from 'node:fs';

import { solveBattle } from '../src/core/cards/solve';

const args = process.argv.slice(2).filter((a) => a !== '--');
const num = (name: string, fallback: number): number => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? Number(args[at + 1]) : fallback;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const [scenario, seed, out] = positional;
if (!scenario || !seed) {
  console.error('usage: npm run cards:solve -- <scenario> <seed> [out.json] [--width 12] [--branch 4]');
  process.exit(2);
}
try {
  const t = performance.now();
  const solved = solveBattle(scenario, seed, { width: num('width', 12), branch: num('branch', 4) });
  const alive = solved.state.units.filter((u) => !u.fainted).map((u) => u.id);
  console.log(`${scenario} ${seed}: ${solved.state.phase} on round ${solved.state.round}, units standing ${alive.join(' ') || 'none'}; ${solved.explored} lines in ${((performance.now() - t) / 1000).toFixed(1)}s`);
  if (out) {
    writeFileSync(out, JSON.stringify(solved.log));
    console.log(`log written to ${out}`);
  } else console.log(JSON.stringify(solved.log));
} catch (error) {
  console.error(`cards:solve: ${(error as Error).message}`);
  process.exit(1);
}
