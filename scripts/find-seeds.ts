import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { DEFAULT_TUNING } from '../src/data/tuning';

const collector = (): RunPolicy => ({
  ...scriptedRunPolicy(greedyAiPolicy),
  chooseAcquisition: async (_o, party, capacity) => (hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' }),
});

async function scan(prefix: string, n: number, test: (r: Awaited<ReturnType<typeof playRun>>) => boolean, label: string) {
  const hits: string[] = [];
  for (let i = 0; i < n && hits.length < 6; i++) {
    const seed = `${prefix}${i}`;
    try {
      const run = await playRun(seed, collector(), DEFAULT_TUNING);
      if (test(run)) hits.push(seed);
    } catch (e) { if (i < 2) console.log('THREW', seed, String(e).slice(0,120)); }
  }
  console.log(label, hits.join(' '));
}

const gyms = (r: Awaited<ReturnType<typeof playRun>>) => r.state.history.filter((v) => v.node.kind === 'gym').length;

await scan('S49B-', 60, (r) => gyms(r) > 0, 'reaches a gym:');
await scan('PARTY-D', 60, (r) => r.log.decisions.some((d) => d.kind === 'acquisition') && r.state.party.length > 1, 'acquires:');
await scan('S49B-', 400, (r) => r.state.party.some((m) => m.spec.species === 'Hitmonlee' || m.spec.species === 'Tyrogue'), 'tyrogue line:');
