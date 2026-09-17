/**
 * @vitest-environment jsdom
 *
 * The `evolve` decision through a whole run: asked where the walk says, logged,
 * replayed, saved, and drawing nothing.
 *
 * **Searched rather than pinned, against a conceding opponent.** This pinned
 * S49B-96 — the capture policy picked up a Tyrogue, the gym 2 clear took the
 * party to 20, and Tyrogue forks three ways. Its own docstring predicted it
 * would stop being the right seed the moment the curve or the pool moved, and
 * the band recut moved both.
 *
 * Two things replace it. The opponent is a **pacifist**, the idiom
 * `test/party.test.ts` uses for its full-run test and for the same reason: a
 * fork is only reachable by a party that survives to a gym clear, and whether
 * the game is winnable is `npm run sim`'s question, not this file's. What is
 * under test here is the decision plumbing — asked once at the fork, logged,
 * applied, replayed, and drawing nothing.
 *
 * And the seed is found by search. Only 14 species in the pool branch at all,
 * so a run has to be *holding* one when a gym clear crosses its threshold;
 * that was always rare and is why the old seed was scanned for in the first
 * place. The search asserts it found one, so a pool change that removed every
 * fork fails loudly here rather than passing vacuously.
 *
 * The species are deliberately not named below. Which fork a seed reaches is a
 * property of the search, and a test that hardcoded "Hitmonlee" would have to be
 * rewritten every time the curve moves — which is exactly the failure this
 * rewrite is fixing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { moveChoice, switchChoice, type RunLog } from '../src/core/types';
import type { Policy } from '../src/core/battle/policy';
import { clearRunLog, loadRunLog, saveRunLog } from '../src/ui/storage';

/**
 * An opponent that never presses its advantage, so the run's *transitions* are
 * the subject. Lifted from `test/party.test.ts`'s victory run.
 */
const pacifist: Policy = async (view) => {
  if (view.forceSwitch) {
    return switchChoice(view.switches.find((option) => option.usable)?.slot ?? 1);
  }
  const weakest = [...view.moves]
    .filter((move) => move.usable)
    .sort((a, b) => a.basePower - b.basePower)[0];
  return moveChoice(weakest?.slot ?? 1);
};

/** Seeds to search for a run that actually reaches a fork. */
const FORK_SEEDS = Array.from({ length: 80 }, (_unused, index) => `S49E-${index}`);

const forkRun = (seed: string, branch: number): Promise<Awaited<ReturnType<typeof playRun>>> =>
  playRun(seed, capturePolicy(branch), DEFAULT_TUNING, { opponent: pacifist });

/**
 * The first seed whose run reaches exactly one fork, and whose two branches
 * reach different parties. Memoised: every test below wants the same one, and
 * the search is the expensive part.
 */
let cached: string | null = null;
async function forkSeed(): Promise<string> {
  if (cached) return cached;
  for (const seed of FORK_SEEDS) {
    const run = await forkRun(seed, 0);
    if (run.log.decisions.filter((decision) => decision.kind === 'evolve').length !== 1) continue;
    const other = await forkRun(seed, 1);
    const a = run.state.party.map((member) => member.spec.species).join(',');
    const b = other.state.party.map((member) => member.spec.species).join(',');
    if (a === b) continue;
    cached = seed;
    return seed;
  }
  throw new Error('no seed in FORK_SEEDS reached a branching evolution');
}

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
    const run = await forkRun(await forkSeed(), 0);
    const evolves = run.log.decisions.filter((decision) => decision.kind === 'evolve');
    expect(evolves).toHaveLength(1);
    // The fork is asked after the gym is won and before its cards: the entry
    // sits after that gym's battle decisions and before the next reward.
    const at = run.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    const before = run.log.decisions.slice(0, at).map((decision) => decision.kind);
    expect(before.at(-1)).toBe('battle');
    expect(run.log.decisions[at + 1]?.kind === 'reward' || run.log.decisions[at + 1]?.kind === 'target').toBe(true);
  }, 120_000);

  it('replays to the same run, evolution included', async () => {
    const original = await forkRun(await forkSeed(), 0);
    /*
     * The opponent has to be handed to the replay as well. A `RunLog` records
     * the *player's* decisions and nothing about the bot on the other side, so
     * replaying a pacifist run against the default opponent replays a different
     * set of battles and runs out of step at the first reward that is no longer
     * there. That is the log doing its job, not a defect.
     */
    const replayed = await replayRun(
      JSON.parse(JSON.stringify(original.log)) as RunLog,
      DEFAULT_TUNING,
      { opponent: pacifist },
    );
    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party.map((member) => member.spec.species)).toEqual(
      original.state.party.map((member) => member.spec.species),
    );
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  }, 120_000);

  it('is a decision: the other branch changes the party and nothing the seed drew', async () => {
    const seed = await forkSeed();
    const scizor = await forkRun(seed, 0);
    const kleavor = await forkRun(seed, 1);
    // The branches reach different parties — which is what `forkSeed` searched
    // for, asserted here so the search's own condition is visible at the claim.
    expect(kleavor.state.party.map((member) => member.spec.species)).not.toEqual(
      scizor.state.party.map((member) => member.spec.species),
    );
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
    const run = await forkRun(await forkSeed(), 0);
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
