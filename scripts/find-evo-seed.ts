import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { DEFAULT_TUNING } from '../src/data/tuning';

const collector = (branch: number): RunPolicy => ({
  ...scriptedRunPolicy(greedyAiPolicy),
  chooseAcquisition: async (_o, party, capacity) => (hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' }),
  chooseEvolution: async () => branch,
});

const hits: string[] = [];
for (let i = 0; i < 4000 && hits.length < 4; i++) {
  const seed = `S49B-${i}`;
  try {
    const run = await playRun(seed, collector(0), DEFAULT_TUNING);
    const evolves = run.log.decisions.filter((d) => d.kind === 'evolve');
    if (evolves.length === 1 && run.state.party.some((m) => m.spec.species === 'Hitmonlee')) {
      const other = await playRun(seed, collector(1), DEFAULT_TUNING);
      if (other.state.party.some((m) => m.spec.species === 'Hitmonchan')) {
        hits.push(seed);
        console.log('HIT', seed);
      }
    }
  } catch { /* keep scanning */ }
}
console.log('evolution fork seeds:', hits.join(' '));
