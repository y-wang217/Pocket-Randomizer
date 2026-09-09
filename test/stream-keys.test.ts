/**
 * Keyed sub-streams: the isolation the whole of Stage 4.6 is built on.
 *
 * Stage 2's named streams stopped one *system* from moving another's rolls.
 * They did nothing about one system moving its own: every map draw in a run
 * came off one sequence, so a draw added at segment 0 shifted every draw at
 * segments 1 through 7. That is the cost 4.6a pays once, so that 4.6b and 4.6c
 * — which both add draws — pay nothing.
 *
 * Six properties, and the first three are the ones a later stage will break if
 * anybody breaks them:
 *
 *   1. A key is a sequence of its own. Draining one moves no other.
 *   2. A key is stable. The same key on the same seed gives the same values
 *      whatever else was drawn first, and however many times it was asked for.
 *   3. A new key costs nothing. Opening one cannot move an existing one.
 *   4. Keys do not leak across streams or across seeds.
 *   5. A key cannot collide with the unkeyed sequence.
 *   6. Generation actually uses them — the property the five above are for.
 */
import { describe, expect, it } from 'vitest';

import { createRun } from '../src/core/run';
import { generateSegment, generateStarterOptions, nodesOf } from '../src/core/encounters';
import { createRng, RNG_STREAMS } from '../src/core/rng';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** The first `count` values of a stream, as a comparable array. */
function take(stream: { nextUint32(): number }, count = 8): number[] {
  return Array.from({ length: count }, () => stream.nextUint32());
}

describe('1. one key cannot move another', () => {
  it('leaves every other key where it was when one is drained', () => {
    const drained = createRng('KEYS');
    const untouched = createRng('KEYS');

    // Ten thousand draws on one key, which under the old sequential streams
    // would have moved everything generated after it.
    for (let i = 0; i < 10_000; i++) drained.map.at('seg0/shape').nextUint32();

    expect(take(drained.map.at('seg1/shape'))).toEqual(take(untouched.map.at('seg1/shape')));
    expect(take(drained.map.at('seg7/shape'))).toEqual(take(untouched.map.at('seg7/shape')));
    expect(take(drained.rewards.at('node/s0-0-0/offer'))).toEqual(
      take(untouched.rewards.at('node/s0-0-0/offer')),
    );
  });

  it('leaves the other four streams where they were', () => {
    const rng = createRng('KEYS-CROSS');
    const before = Object.fromEntries(RNG_STREAMS.map((name) => [name, rng[name].totalDraws]));

    for (let i = 0; i < 500; i++) rng.randomizer.at('node/x').nextUint32();

    expect(rng.randomizer.totalDraws).toBe((before['randomizer'] ?? 0) + 500);
    for (const name of RNG_STREAMS) {
      if (name === 'randomizer') continue;
      expect(rng[name].totalDraws, `${name} moved`).toBe(before[name]);
    }
  });
});

describe('2. a key is stable', () => {
  it('gives the same values however much was drawn elsewhere first', () => {
    const quiet = createRng('KEYS-STABLE');
    const busy = createRng('KEYS-STABLE');

    for (const key of ['a', 'b', 'c', 'd']) {
      for (let i = 0; i < 1000; i++) busy.rewards.at(key).nextUint32();
    }
    busy.rewards.nextUint32();

    expect(take(busy.rewards.at('target'))).toEqual(take(quiet.rewards.at('target')));
  });

  it('returns the same sub-stream for the same key rather than a fresh one', () => {
    /*
     * The memoization, asserted directly. A version of `at` that built a new
     * sequence per call would restart the key every time it was asked for, so
     * two draws meant to be consecutive would be the same value twice — a bug
     * that looks like nothing until a moveset comes back with four copies of
     * one move.
     */
    const rng = createRng('KEYS-MEMO');
    const first = rng.map.at('same');
    const second = rng.map.at('same');
    expect(second).toBe(first);

    const a = first.nextUint32();
    const b = second.nextUint32();
    expect(b).not.toBe(a);
    expect(rng.map.keys).toBe(1);
  });
});

describe('3. a new key is free', () => {
  it('moves nothing when a key that never existed is opened', () => {
    const rng = createRng('KEYS-NEW');
    const existing = take(rng.map.at('seg0/shape'));

    // A second Rng that opens a *new* key first, exactly as a later stage
    // would when it adds a draw of its own.
    const later = createRng('KEYS-NEW');
    for (let i = 0; i < 200; i++) later.map.at('seg0/locale-offer').nextUint32();

    expect(take(later.map.at('seg0/shape'))).toEqual(existing);
  });
});

describe('4. keys do not leak', () => {
  it('gives one key different values on two streams', () => {
    const rng = createRng('KEYS-LEAK');
    expect(take(rng.map.at('node/x'))).not.toEqual(take(rng.battle.at('node/x')));
  });

  it('gives one key different values on two seeds', () => {
    expect(take(createRng('SEED-A').map.at('k'))).not.toEqual(take(createRng('SEED-B').map.at('k')));
  });

  it('gives two keys different values on one stream', () => {
    const rng = createRng('KEYS-DISTINCT');
    expect(take(rng.map.at('seg0/shape'))).not.toEqual(take(rng.map.at('seg1/shape')));
  });
});

describe('5. a key cannot collide with the unkeyed sequence', () => {
  it('keeps the root sequence separate from every key', () => {
    const root = createRng('KEYS-ROOT');
    const keyed = createRng('KEYS-ROOT');
    expect(take(keyed.policy.at(''))).not.toEqual(take(root.policy));
  });

  /**
   * The `#` separator, which is what makes the claim above structural.
   *
   * A key is hashed as `gymrun:<stream>#<key>:<seed>` and the root as
   * `gymrun:<stream>:<seed>`. Neither a stream name nor a normalized seed can
   * contain a `#`, so no (stream, key, seed) triple can produce the same domain
   * string as a different one — which a plain `:` separator would allow, since
   * `map:a` + seed `b` and `map` + seed `a:b` are the same string.
   */
  it('separates a key from a seed that looks like one', () => {
    expect(take(createRng('B').map.at('A'))).not.toEqual(take(createRng('A:B').map));
  });
});

describe('6. generation draws from keys and not from the raw streams', () => {
  it('leaves every unkeyed sequence untouched by a whole run', () => {
    const rng = createRng('KEYS-GENERATION');
    generateStarterOptions(rng, DEFAULT_TUNING);
    for (let index = 0; index < 8; index++) generateSegment(index, rng, DEFAULT_TUNING);

    for (const name of RNG_STREAMS) {
      // `draws` is the unkeyed sequence alone. Every one of them must be zero:
      // a draw off a raw stream is a draw whose position depends on everything
      // generated before it, which is the failure this stage removed.
      expect(rng[name].draws, `${name} drew off its unkeyed sequence`).toBe(0);
    }
    // ...and the run really was generated, or the four zeroes above are vacuous.
    expect(rng.randomizer.totalDraws).toBeGreaterThan(0);
    expect(rng.map.keys).toBeGreaterThanOrEqual(8);
  });

  it('keys one segment independently of every other', () => {
    /*
     * The property the sub-stages actually need: generating segment 3 the same
     * way twice, from two `Rng`s that have generated *different* amounts before
     * it, must produce the same segment.
     */
    const alone = createRng('KEYS-SEGMENT');
    const after = createRng('KEYS-SEGMENT');
    for (let index = 0; index < 3; index++) generateSegment(index, after, DEFAULT_TUNING);
    generateStarterOptions(after, DEFAULT_TUNING);

    const digest = (segment: ReturnType<typeof generateSegment>): string =>
      JSON.stringify(nodesOf(segment).map((node) => [node.kind, node.tier, node.encounter?.team]));

    expect(digest(generateSegment(3, after, DEFAULT_TUNING))).toEqual(
      digest(generateSegment(3, alone, DEFAULT_TUNING)),
    );
  });

  it('generates an identical run from one seed, twice', () => {
    const digest = (seed: string): string =>
      JSON.stringify(createRun(seed).segments.map((segment) => nodesOf(segment)));
    expect(digest('KEYS-RUN')).toEqual(digest('KEYS-RUN'));
  });
});
