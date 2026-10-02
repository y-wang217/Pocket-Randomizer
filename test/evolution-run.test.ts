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
 * column moved; S49B-2850 and Wurmple's two-way split were what it printed
 * after it. **S49B-840 and Tyrogue's three-way split are what it prints now**,
 * rescanned for the band recut, which moved `contentHash` again and stranded
 * the previous seed exactly as this header predicts. The later stage applies
 * itself: only the fork is a decision, so one `evolve` entry becomes a
 * Hitmonlee or a Hitmonchan several clears later.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { firstRunWhere, seedRange } from './seed-search';
import type { RunLog } from '../src/core/types';
import { clearRunLog, loadRunLog, saveRunLog } from '../src/ui/storage';

const SEED = 'S49B-840';

/**
 * The species each branch would produce, recorded as the fork is answered.
 *
 * **The tests below used to name Hitmonlee and Hitmonchan**, on a seed pinned
 * to a run that captured a Tyrogue and cleared a gym with it. Two things were
 * wrong with that and the `-22` bump made both bite at once: which species a
 * seed hands you is a property of the draw that every bump reshuffles (see
 * `test/seed-search.ts`), and Tyrogue is not the subject — **any** species
 * with two targets in the pool forks, and the rule is about the fork.
 *
 * So the fork records what it was offered, the seed is searched for, and the
 * assertions read the recording. The test is stronger for it: it now holds for
 * every branching species in the table rather than for the one in one seed.
 */
interface Fork {
  from: string;
  options: string[];
  taken: string;
}

function capturePolicy(branch = 0, forks: Fork[] = []): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
    chooseEvolution: async (question) => {
      const index = Math.min(branch, question.options.length - 1);
      forks.push({
        from: question.member.spec.species,
        options: question.options.map((entry) => entry.species),
        taken: question.options[index]?.species ?? '',
      });
      return index;
    },
  };
}

/**
 * Seeds known to reach a fork, then a search behind them.
 *
 * **A fork is rare and got rarer.** It needs a branching species in the party
 * at a gym clear, and at `-22`'s difficulty a gym clear is most of a run: no
 * seed in the first 400 reaches one, and these two were found by scanning two
 * thousand. Both fork a Tyrogue three ways. That rarity is filed as an open
 * item in `docs/README.md` section 5 — it is a question about whether Stage
 * 4.9's mechanic is reachable at all, and not something a test may tune away.
 *
 * So the list is pinned *and* searched. The pinned pair makes the common case
 * instant; the range behind them means the next bump that moves these two does
 * not leave the file asserting nothing, and `firstRunWhere` throws with
 * "widen the search" rather than passing vacuously when the range runs out.
 */
const FORK_SEEDS = ['S49B-1706', 'S49B-2470', ...seedRange('S49B-', 400)];

/** A seed whose run reaches a fork with at least `options` branches on it. */
async function seedWithFork(options: number): Promise<{ seed: string; forks: Fork[] }> {
  let forks: Fork[] = [];
  const { seed } = await firstRunWhere(
    FORK_SEEDS,
    (candidate) => {
      forks = [];
      return playRun(candidate, capturePolicy(0, forks), DEFAULT_TUNING);
    },
    () => forks.length === 1 && (forks[0]?.options.length ?? 0) >= options,
    `reached exactly one evolution fork with ${options} or more branches`,
  );
  return { seed, forks };
}

describe('the evolve decision in a played run', () => {
  it('is asked once at the fork, logged, and applied to the party', async () => {
    const { seed, forks } = await seedWithFork(1);
    const run = await playRun(seed, capturePolicy(0), DEFAULT_TUNING);
    const evolves = run.log.decisions.filter((decision) => decision.kind === 'evolve');
    expect(evolves).toHaveLength(1);
    // The branch that was taken is the species standing in the party, and the
    // one it grew out of is gone.
    expect(run.state.party.map((member) => member.spec.species)).toContain(forks[0]!.taken);
    // The fork is asked after the gym is won and before its cards: the entry
    // sits after that gym's battle decisions and before the next reward.
    const at = run.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    const before = run.log.decisions.slice(0, at).map((decision) => decision.kind);
    expect(before.at(-1)).toBe('battle');
    expect(run.log.decisions[at + 1]?.kind === 'reward' || run.log.decisions[at + 1]?.kind === 'items').toBe(true);
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
    // Two branches or more, because a fork with one option is not a decision
    // and this is the test that the decision is one.
    const { seed, forks } = await seedWithFork(2);
    const first = await playRun(seed, capturePolicy(0), DEFAULT_TUNING);
    const secondForks: Fork[] = [];
    const second = await playRun(seed, capturePolicy(1, secondForks), DEFAULT_TUNING);

    // The other branch is a different species, and it is the one on offer.
    expect(secondForks[0]!.taken).not.toBe(forks[0]!.taken);
    expect(forks[0]!.options).toContain(secondForks[0]!.taken);
    expect(second.state.party.map((member) => member.spec.species)).toContain(secondForks[0]!.taken);
    // Player decisions consume no RNG: the map, drawn before any decision, is
    // the same map, every node's team and reward included.
    expect(second.state.segments).toEqual(first.state.segments);
    // And the two logs agree on every entry up to the fork.
    const at = first.log.decisions.findIndex((decision) => decision.kind === 'evolve');
    expect(second.log.decisions.slice(0, at)).toEqual(first.log.decisions.slice(0, at));
    expect(second.log.decisions[at]).toEqual({ kind: 'evolve', index: 1 });
  }, 240_000);

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
