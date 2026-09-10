/**
 * Seeds for the V4 summary screenshots: one the scripted policy wins on, one
 * it loses at gym 5 on. Headless, the same policy the gallery page replays in
 * the browser, so what is found here is what is rendered there.
 *
 *   npx vite-node scripts/visual/scan-summary-seeds.ts [count]
 */
import { greedyAiPolicy } from '../../src/core/battle/ai';
import { causeOfDeath, gymsCleared, playRun, scriptedRunPolicy } from '../../src/core/run';

const count = Number(process.argv[2] ?? 400);
let victory: string | null = null;
let gymFive: string | null = null;
for (let i = 0; i < count && (!victory || !gymFive); i++) {
  const seed = `V4-${i}`;
  const result = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), undefined, { opponent: greedyAiPolicy });
  const cleared = gymsCleared(result.state);
  const death = causeOfDeath(result.state);
  if (result.outcome === 'victory' && !victory) victory = seed;
  if (death && death.kind === 'gym' && death.segment === 4 && !gymFive) gymFive = seed;
  if (i % 50 === 49) console.log(`${i + 1} seeds: victory=${victory} gym5=${gymFive} (last: ${cleared} gyms)`);
}
console.log(JSON.stringify({ victory, gymFive }));
