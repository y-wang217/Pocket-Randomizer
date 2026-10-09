/**
 * Play every scenario with the guard bot and print what happened.
 *
 *   npm run cards:bench -- [--seeds 50] [--prefix GB] [--scenario skirmish] [--random]
 *
 * Per scenario: wins, units standing on a win, rounds to a win, the fitness
 * `cards:train` optimizes, and where the bot placed each unit (the home row
 * and lane it chose, as a share of battles). `--random` adds the random bot
 * as a floor. Every figure is stamped with its seed prefix and count.
 */
import { ENCOUNTERS } from '../src/cardData/encounters';
import { runSuite, summarize, type BattleResult } from '../src/core/cards/bench';
import { botStream, randomBot } from '../src/core/cards/bots';
import { guardBot } from '../src/core/cards/guard';
import type { UnitId } from '../src/core/cards/state';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1]! : fallback;
};
const seeds = Number(opt('seeds', '50'));
const prefix = opt('prefix', 'GB');
const scenarios = args.includes('--scenario') ? [opt('scenario', '')] : Object.keys(ENCOUNTERS);
for (const id of scenarios) {
  if (!Object.hasOwn(ENCOUNTERS, id)) {
    console.error(`cards:bench: no scenario ${id}`);
    process.exit(2);
  }
}

function table(name: string, results: BattleResult[], ms: number): void {
  console.log(`\n${name}: seeds ${prefix}0..${prefix}${seeds - 1} (${seeds} per scenario), ${(ms / results.length).toFixed(0)} ms a battle`);
  for (const s of summarize(results)) {
    const pct = ((100 * s.wins) / s.battles).toFixed(0);
    console.log(
      `  ${s.encounterId.padEnd(10)} won ${String(s.wins).padStart(3)}/${s.battles} (${pct.padStart(3)}%)  ` +
        `units kept on a win ${s.aliveOnWin.toFixed(2)}  rounds to win ${s.roundsToWin.toFixed(1)}  fitness ${s.fitness.toFixed(3)}`,
    );
  }
}

/** Where each unit started, by home row (back C1, front C2) and lane, as shares of battles. */
function patterns(results: BattleResult[]): void {
  console.log('\nplacement patterns (row: back C1 / front C2; lane 1 left to 3 right)');
  for (const id of [...new Set(results.map((r) => r.encounterId))]) {
    const rs = results.filter((r) => r.encounterId === id);
    const parts = (['A', 'B', 'C'] as UnitId[]).map((unit) => {
      const front = rs.filter((r) => r.deployed[unit]?.col === 2).length;
      const lanes = [1, 2, 3].map((lane) => rs.filter((r) => r.deployed[unit]?.lane === lane).length);
      return `${unit} front ${String(Math.round((100 * front) / rs.length)).padStart(3)}% lanes ${lanes.join('/')}`;
    });
    console.log(`  ${id.padEnd(10)} ${parts.join('   ')}`);
  }
}

let t = performance.now();
const guard = runSuite(() => guardBot(), prefix, seeds, scenarios);
table('guard bot', guard, performance.now() - t);
patterns(guard);
if (args.includes('--random')) {
  t = performance.now();
  let i = 0;
  const random = runSuite(() => {
    const stream = botStream(`${prefix}R${i++}`);
    return (state) => randomBot(state, stream);
  }, prefix, seeds, scenarios);
  table('random bot', random, performance.now() - t);
}
