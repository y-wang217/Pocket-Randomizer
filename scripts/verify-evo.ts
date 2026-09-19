import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { DEFAULT_TUNING } from '../src/data/tuning';
const forks: { from: string; options: string[] }[] = [];
const policy = (b: number): RunPolicy => ({
  ...scriptedRunPolicy(greedyAiPolicy),
  chooseAcquisition: async (_o, p, c) => (hasRoom(p, c) ? { kind: 'accept' } : { kind: 'decline' }),
  chooseEvolution: async (q) => { forks.push({ from: q.member.spec.species, options: q.options.map((e) => e.species) }); return Math.min(b, q.options.length - 1); },
});
for (const seed of ['S49B-1706', 'S49B-2470']) {
  forks.length = 0;
  const run = await playRun(seed, policy(0), DEFAULT_TUNING);
  console.log(seed, 'forks', JSON.stringify(forks), 'gyms', run.state.history.filter((v) => v.node.kind === 'gym').length);
}
