/**
 * @vitest-environment jsdom
 *
 * The `evolve` decision through a whole run: asked where the walk says, logged,
 * replayed, saved, and drawing nothing.
 *
 * The seed below is a scanned one, and it is a **needle**: a run has to survive
 * to a gym clear *and* be carrying a member whose evolution branches at exactly
 * that level. Measured while rescanning it, one seed in three hundred qualifies
 * under the scripted policy. It stops being the right seed the moment the curve
 * or the pool moves.
 *
 * **That is not only a `RANDOMIZER_VERSION` bump, and this file learned it the
 * hard way.** The line here used to say a bump announces it. The
 * bench-carryover and gym-levels patch moved the gym level column, which is
 * `src/data/**` and therefore `contentHash`, and left `RANDOMIZER_VERSION`
 * alone on the correct argument that the draw order and count did not change
 * (`core/randomizer.ts`, "the draw order"). The seed stopped qualifying anyway,
 * because what a gym fields decides whether the run reaches the clear. **Any
 * axis moving is the signal to rescan**, `contentHash` included, and
 * `scripts/scan-seed.ts` carries the same correction.
 *
 * Rescan with `npx vite-node scripts/scan-seed.ts fork 6000`, which prints a
 * seed, the two branch species and where the decision lands — the three
 * literals below. S49B-96 and its Tyrogue were what it printed before the gym
 * column moved; S49B-2850 and Wurmple's two-way split are what it prints now.
 * The later stage applies itself: only the fork is a decision, so one `evolve`
 * entry becomes a Beautifly or a Dustox several clears later.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { RunLog } from '../src/core/types';
import { clearRunLog, loadRunLog, saveRunLog } from '../src/ui/storage';

const SEED = 'S49B-2850';

function capturePolicy(branch = 0): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
    chooseEvolution: async () => branch,
  };
}

describe('the evolve decision in a played run', () => {
  it('is asked once at the fork, logged, and applied to the party', async () => {
    const run = await playRun(SEED, capturePolicy(0), DEFAULT_TUNING);
    const evolves = run.log.decisions.filter((decision) => decision.kind === 'evolve');
    expect(evolves).toHaveLength(1);
    expect(run.state.party.map((member) => member.spec.species)).toContain('Beautifly');
    // The fork is asked after the gym is won and before its cards: the entry
    // sits after that gym's battle decisions and before the next reward.
    const at = run.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    const before = run.log.decisions.slice(0, at).map((decision) => decision.kind);
    expect(before.at(-1)).toBe('battle');
    expect(run.log.decisions[at + 1]?.kind === 'reward' || run.log.decisions[at + 1]?.kind === 'target').toBe(true);
  }, 120_000);

  it('replays to the same run, evolution included', async () => {
    const original = await playRun(SEED, capturePolicy(0), DEFAULT_TUNING);
    const replayed = await replayRun(JSON.parse(JSON.stringify(original.log)) as RunLog);
    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party.map((member) => member.spec.species)).toEqual(
      original.state.party.map((member) => member.spec.species),
    );
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  }, 120_000);

  it('is a decision: the other branch changes the party and nothing the seed drew', async () => {
    const beautifly = await playRun(SEED, capturePolicy(0), DEFAULT_TUNING);
    const dustox = await playRun(SEED, capturePolicy(1), DEFAULT_TUNING);
    expect(dustox.state.party.map((member) => member.spec.species)).toContain('Dustox');
    // Player decisions consume no RNG: the map, drawn before any decision, is
    // the same map, every node's team and reward included.
    expect(dustox.state.segments).toEqual(beautifly.state.segments);
    // And the two logs agree on every entry up to the fork.
    const at = beautifly.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    expect(dustox.log.decisions.slice(0, at)).toEqual(beautifly.log.decisions.slice(0, at));
    expect(dustox.log.decisions[at]).toEqual({ kind: 'evolve', index: 1 });
  }, 120_000);

  it('saves and reloads through storage', async () => {
    clearRunLog();
    const run = await playRun(SEED, capturePolicy(0), DEFAULT_TUNING);
    saveRunLog(run.log);
    expect(loadRunLog()).toEqual(run.log);
    clearRunLog();
  }, 120_000);

  it('draws nothing: the evolution module never touches the RNG', () => {
    const source = readFileSync('src/core/evolution.ts', 'utf8');
    expect(source).not.toMatch(/from '\.\/rng'/);
    expect(source).not.toMatch(/from '\.\/streamKeys'/);
  });
});
