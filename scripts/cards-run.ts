/**
 * The card run bench: the run bot (`core/cards/cardrunBot.ts`) plays whole runs
 * and prints, per seed, how far each got. Balance is not a gate: this records.
 *
 * Usage: npm run cards:run -- [count] [prefix]
 */
import { createRun } from '../src/core/cards/cardrun';
import { playRunBot } from '../src/core/cards/cardrunBot';

const count = Number(process.argv[2] ?? 20);
const prefix = process.argv[3] ?? 'CRUN';
let fights = 0;
let bosses = 0;
let won = 0;
for (let i = 0; i < count; i++) {
  const seed = `${prefix}${i}`;
  const { state, actions } = playRunBot(createRun(seed));
  const over = state.screen.k === 'over' ? (state.screen.won ? 'won' : 'lost') : 'stopped';
  if (over === 'won') won++;
  fights += state.stats.fights;
  bosses += state.stats.bosses;
  const at = state.nodes[state.at];
  console.log(
    `${seed.padEnd(8)} ${over.padEnd(7)} at ${at ? `${at.key} ${at.kind === 'fight' ? at.encounter : (state.battle?.encounter ?? state.stop ?? '')}` : 'the end'}  fights ${state.stats.fights}  bosses ${state.stats.bosses}  quests ${state.stats.quests}  upgrades ${state.stats.upgrades}  deck ${state.deck.length}  actions ${actions.length}`,
  );
}
console.log(`\n${count} runs, prefix ${prefix}: mean fights won ${(fights / count).toFixed(2)}, mean bosses beaten ${(bosses / count).toFixed(2)}, runs won ${won}/${count}`);
