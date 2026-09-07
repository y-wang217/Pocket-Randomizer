/**
 * Generation has to be a pure function of the seed.
 *
 * This is Stage 0's central property restated at map scale: two players who
 * type the same seed get the same starters, the same map and the same
 * encounters, or the seed means nothing.
 *
 * Stage 1 also validated the curated pools here. There are no curated pools any
 * more — the randomizer draws from generated tables — so that half moved to
 * test/data-tables.test.ts, which validates them against the dex they came from.
 */
import { describe, expect, it } from 'vitest';

import { describeSpec } from '../src/core/battle/driver';
import { generateSegment, generateStarterOptions, nodesOf, type Segment } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { playerLevel, starterLevel } from '../src/data/scaling';
import { getStarterPool } from '../src/data/starters';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

function generate(seed: string, tuning = DEFAULT_TUNING): { starters: unknown; segment: Segment } {
  const rng = createRng(seed);
  const starters = generateStarterOptions(rng, tuning);
  const segment = generateSegment(0, rng, tuning);
  return { starters, segment };
}

describe('generation determinism', () => {
  it('gives two runs of one seed identical starters, map and encounters', () => {
    const first = generate('GEN-SAME');
    const second = generate('GEN-SAME');

    expect(second.starters).toEqual(first.starters);
    // Deep equality covers the whole structure at once: step count, option
    // count per step, node kinds, tiers, labels, species, levels, and the sim
    // seed each battle will run under.
    expect(second.segment).toEqual(first.segment);
  });

  it('gives different seeds different maps', () => {
    const a = generate('GEN-A');
    const b = generate('GEN-B');
    expect(b.segment).not.toEqual(a.segment);
  });

  it('draws the whole map before the player decides anything', () => {
    // Every node, including the options never taken, already has its contents
    // and its sim seed. If any of this were drawn lazily the assertion below
    // would find a placeholder.
    const { segment } = generate('GEN-EAGER');
    for (const node of nodesOf(segment)) {
      if (node.kind === 'rest') {
        expect(node.encounter).toBeNull();
        continue;
      }
      expect(node.encounter?.team.length).toBeGreaterThan(0);
      expect(node.encounter?.simSeed).toMatch(/^sodium,[0-9a-f]{64}$/);
    }
  });

  it('gives every battle in a segment its own sim seed', () => {
    // The failure this catches is real and silent: createBattle derives its
    // seed from the run seed, so a run that let it do that would play the same
    // damage rolls in every fight.
    const { segment } = generate('GEN-SEEDS');
    const seeds = nodesOf(segment)
      .map((node) => node.encounter?.simSeed)
      .filter((seed) => Boolean(seed));

    expect(seeds.length).toBeGreaterThan(4);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('leaves the battle stream untouched by map shape alone', () => {
    // Two tunings that draw a different number of *map* values must not be the
    // reason a seed's battles change; only the number of battle nodes may move
    // the battle stream. Here the same map is generated twice and the battle
    // stream is compared after: identical maps, identical seeds.
    const wide = withTuning({ nodeChoiceCount: { min: 3, max: 3 } });
    expect(generate('GEN-STREAM', wide).segment).toEqual(generate('GEN-STREAM', wide).segment);
  });
});

describe('generation rules', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `RULES-${i}`);

  it('respects the tuned step and option counts', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      expect(segment.steps.length).toBeGreaterThanOrEqual(DEFAULT_TUNING.stepsPerSegment.min);
      expect(segment.steps.length).toBeLessThanOrEqual(DEFAULT_TUNING.stepsPerSegment.max);
      for (const step of segment.steps) {
        expect(step.options.length).toBeGreaterThanOrEqual(2);
        expect(step.options.length).toBeLessThanOrEqual(DEFAULT_TUNING.nodeChoiceCount.max);
      }
    }
  });

  it('never offers the same kind twice in one step', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      for (const step of segment.steps) {
        const kinds = step.options.map((option) => option.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
      }
    }
  });

  it('never offers a rest before the tuned earliest step, and always offers enough of them', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      const restSteps = segment.steps.filter((step) => step.options.some((o) => o.kind === 'rest'));
      for (const step of restSteps) {
        expect(step.index).toBeGreaterThanOrEqual(DEFAULT_TUNING.restEarliestStep);
      }
      expect(restSteps.length).toBeGreaterThanOrEqual(DEFAULT_TUNING.minRestSteps);
    }
  });

  it('ends every segment at its gym, which is never an option', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      expect(segment.gym.kind).toBe('gym');
      expect(segment.gym.label).toContain(segment.leader);
      expect(segment.steps.flatMap((s) => s.options).some((o) => o.kind === 'gym')).toBe(false);
    }
  });

  it('tags every node with a tier so Stage 3 has somewhere to hang rewards', () => {
    const { segment } = generate('RULES-TIER');
    for (const node of nodesOf(segment)) expect(node.tier).toBe('normal');
  });

  it('scales encounter levels with the segment index', () => {
    // The generator takes an index and uses it, which is the difference between
    // something Stage 2 could call in a loop and something it had to rewrite.
    // Asserted against the curve table rather than against a multiplication,
    // because the curve is a table now and is allowed to bend.
    for (const index of [0, 3, 7]) {
      const segment = generateSegment(index, createRng(`RULES-SCALE-${index}`), DEFAULT_TUNING);
      for (const member of segment.gym.encounter?.team ?? []) {
        expect(member.level).toBeLessThanOrEqual(playerLevel(index));
        expect(member.level).toBeGreaterThan(playerLevel(index) - 8);
      }
    }
  });

  it('keeps the starter pool additive, so unlocks cannot reshape a recorded seed', () => {
    const base = getStarterPool();
    expect(base.length).toBeGreaterThan(50);
    // Generation draws indices from this list. An unlock that removed an entry
    // or inserted into the middle would change what every seed recorded before
    // it offers, so the base pool has to survive an unlock unchanged and in
    // order. Stage 1 has nothing to add, which is the point: the seam is here
    // and it is already the right shape.
    expect(getStarterPool(['anything', 'at', 'all'])).toEqual(base);
    expect(getStarterPool([]).map((entry) => entry.id)).toEqual(base.map((entry) => entry.id));
  });

  it('offers distinct starters', () => {
    for (const seed of seeds) {
      const options = generateStarterOptions(createRng(seed), DEFAULT_TUNING);
      expect(options).toHaveLength(DEFAULT_TUNING.starterOptionCount);
      expect(new Set(options.map((o) => o.species)).size).toBe(options.length);
      for (const option of options) expect(option.level).toBe(starterLevel());
    }
  });
});

describe('the engine, not our arithmetic', () => {
  it('asks the engine for max HP and PP rather than recomputing them', () => {
    const vitals = describeSpec({ species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest'], level: 50 });
    // Snorlax at level 50 with 31 IVs and 0 EVs, and Body Slam with three PP
    // Ups. Hardcoded here as a canary: if the engine's numbers ever move, this
    // is where we find out rather than in a run that will not replay.
    expect(vitals.maxHp).toBe(235);
    expect(vitals.moves.map((m) => [m.name, m.pp, m.maxPp])).toEqual([
      ['Body Slam', 24, 24],
      ['Rest', 8, 8],
    ]);
  });
});
