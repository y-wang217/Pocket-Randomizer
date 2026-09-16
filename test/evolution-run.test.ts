/**
 * @vitest-environment jsdom
 *
 * The `evolve` decision through a whole run: asked where the walk says, logged,
 * replayed, saved, and drawing nothing.
 *
 * S49B-96 is a scanned seed: the capture policy picks up a Tyrogue on the
 * road, the gym 2 clear takes the party to 20, and Tyrogue forks three ways
 * (Hitmonlee, Hitmonchan, Hitmontop, all at the dex's 20). It stops being the
 * right seed the moment the curve or the pool moves — which a
 * `RANDOMIZER_VERSION` bump announces.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { RunLog } from '../src/core/types';
import { clearRunLog, loadRunLog, saveRunLog } from '../src/ui/storage';

const SEED = 'S49B-96';

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
    expect(run.state.party.map((member) => member.spec.species)).toContain('Hitmonlee');
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
    const scizor = await playRun(SEED, capturePolicy(0), DEFAULT_TUNING);
    const kleavor = await playRun(SEED, capturePolicy(1), DEFAULT_TUNING);
    expect(kleavor.state.party.map((member) => member.spec.species)).toContain('Hitmonchan');
    // Player decisions consume no RNG: the map, drawn before any decision, is
    // the same map, every node's team and reward included.
    expect(kleavor.state.segments).toEqual(scizor.state.segments);
    // And the two logs agree on every entry up to the fork.
    const at = scizor.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    expect(kleavor.log.decisions.slice(0, at)).toEqual(scizor.log.decisions.slice(0, at));
    expect(kleavor.log.decisions[at]).toEqual({ kind: 'evolve', index: 1 });
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
