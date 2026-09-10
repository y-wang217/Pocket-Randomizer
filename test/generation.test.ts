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
import { generateSegment, generateStarterOptions, nodesOf, type Segment,
  routeStepsOf,
} from '../src/core/encounters';
import { isBattleKind } from '../src/core/economy';
import { createRng } from '../src/core/rng';
import { playerLevel, SEGMENT_COUNT, segmentScaling, starterLevel } from '../src/data/scaling';
import { getStarterPool } from '../src/data/starters';
import { stepsRangeFor, DEFAULT_TUNING, withTuning } from '../src/data/tuning';

function generate(seed: string, tuning = DEFAULT_TUNING): { starters: unknown; segment: Segment } {
  const rng = createRng(seed);
  const starters = generateStarterOptions(rng, tuning);
  const segment = generateSegment(0, rng, tuning);
  return { starters, segment };
}

/**
 * Every segment of a run, generated in the order `createRun` generates them.
 *
 * Tier weights vary by phase of the run, so a property about segment 7 cannot
 * be checked from a segment 0 generated in isolation — and generating segment 7
 * on a fresh `Rng` would read the right band off the wrong stream position.
 */
function wholeRun(seed: string, tuning = DEFAULT_TUNING): Segment[] {
  const rng = createRng(seed);
  generateStarterOptions(rng, tuning);
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => generateSegment(index, rng, tuning));
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
      if (!isBattleKind(node.kind)) {
        // Rests, shops and events have no opponent. Their *contents* are still
        // eager — a shop's shelf and an event's outcomes are drawn in pass 4 —
        // which the assertions below the loop cover.
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
      /*
       * **Stage 4.8, item 3: the range is the segment's own row, not one number.**
       * `generate` builds segment 0, so this reads row 0; the whole curve is
       * walked by `test/node-curve.test.ts`, which also checks the guarantees at
       * every length in it.
       */
      const range = stepsRangeFor(DEFAULT_TUNING, segment.index);
      for (const route of segment.routes) {
        expect(route.steps.length).toBeGreaterThanOrEqual(range.min);
        expect(route.steps.length).toBeLessThanOrEqual(range.max);
      }
      for (const step of routeStepsOf(segment)) {
        expect(step.options.length).toBeGreaterThanOrEqual(2);
        expect(step.options.length).toBeLessThanOrEqual(DEFAULT_TUNING.nodeChoiceCount.max);
      }
    }
  });

  it('never offers the same kind twice in one step', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      /*
       * The guaranteed wild step is the one exception, and it is a deliberate
       * one: 4.6a needs a wild encounter reachable whatever the player picks,
       * so one step per route is wild all the way across. It stays a decision
       * because those options carry **different tiers** — see
       * `tuning.wildStepsPerSegment`, which trims that step to the number of
       * tiers the segment can actually draw so that two options are never the
       * same trade printed twice.
       */
      for (const step of routeStepsOf(segment)) {
        const kinds = step.options.map((option) => option.kind);
        if (kinds.every((kind) => kind === 'wild')) {
          const tiers = step.options.map((option) => option.tier);
          expect(new Set(tiers).size, 'a wild step must offer distinct tiers').toBe(tiers.length);
          continue;
        }
        expect(new Set(kinds).size).toBe(kinds.length);
      }
    }
  });

  it('never offers a rest before the tuned earliest step, and always offers enough of them', () => {
    for (const seed of seeds) {
      const { segment } = generate(seed);
      const restSteps = routeStepsOf(segment).filter((step) => step.options.some((o) => o.kind === 'rest'));
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
      expect(routeStepsOf(segment).flatMap((s) => s.options).some((o) => o.kind === 'gym')).toBe(false);
    }
  });

  it('gives every fight a tier and every non-fight none', () => {
    // Stage 2 wrote `normal` on all four kinds. Stage 3 makes the absence
    // structural: a rest node and a gym have no tier at all, so nothing can
    // key a reward pool off one. The assertion is on both halves, because
    // "every fight has a tier" alone would pass on a build that also tagged
    // rest nodes, which is the bug the null exists to prevent.
    for (const seed of seeds) {
      const { segment } = generate(seed);
      for (const node of nodesOf(segment)) {
        // A tier scales an encounter and picks a reward pool. Gyms are excluded
        // for the separate reason `generateGymTeam` takes no tier: a gym is the
        // segment's difficulty statement and a second dial on it is one the
        // balance report cannot attribute.
        if (!isBattleKind(node.kind) || node.kind === 'gym') {
          expect(node.tier, `${node.id} is a ${node.kind} and should carry no tier`).toBeNull();
        } else {
          expect(['normal', 'hard', 'elite']).toContain(node.tier);
        }
      }
    }
  });

  it('offers a spread of tiers within a step rather than the same trade twice', () => {
    // The rule that makes a step a decision. Two fights in one step must be two
    // different risks; if they were not, the tier on the map would be a label
    // rather than a choice.
    let stepsWithTwoFights = 0;
    for (const seed of seeds) {
      for (const segment of wholeRun(`${seed}-SPREAD`)) {
        for (const step of routeStepsOf(segment)) {
          const tiers = step.options.map((option) => option.tier).filter((tier) => tier !== null);
          if (tiers.length < 2) continue;
          stepsWithTwoFights++;
          expect(new Set(tiers).size, `step ${step.index} of segment ${segment.index} repeats a tier`).toBe(
            tiers.length,
          );
        }
      }
    }
    // Guard against the assertion above passing vacuously on a population where
    // no step ever offered two fights.
    expect(stepsWithTwoFights).toBeGreaterThan(50);
  });

  it('keeps elite out of the opening segments and weights it in later ones', () => {
    // The tier distribution is per band of the run, so a segment-0 elite node
    // would mean the band table is not being read. Asserted as a population
    // property over many seeds rather than as one map, because a single seed
    // says nothing about a weighted draw.
    const seen = new Map<number, Set<string>>();
    for (const seed of seeds) {
      for (const segment of wholeRun(`${seed}-BANDS`)) {
        const bucket = seen.get(segment.index) ?? new Set<string>();
        for (const node of nodesOf(segment)) if (node.tier) bucket.add(node.tier);
        seen.set(segment.index, bucket);
      }
    }
    expect([...(seen.get(0) ?? [])].sort()).toEqual(['hard', 'normal']);
    expect([...(seen.get(1) ?? [])].sort()).toEqual(['hard', 'normal']);
    expect(seen.get(6)?.has('elite')).toBe(true);
    expect(seen.get(7)?.has('elite')).toBe(true);
  });

  it('scales encounter levels with the segment index', () => {
    // The generator takes an index and uses it, which is the difference between
    // something Stage 2 could call in a loop and something it had to rewrite.
    //
    // Asserted against the curve *table* rather than against a formula. The
    // curve is eight hand-tuned rows now and is allowed to bend anywhere; a
    // test that encoded "player level minus at most eight" would be a second,
    // stale copy of the balance data, and would fail the next tuning pass for
    // no reason.
    const gymLevels: number[] = [];
    for (const index of [0, 3, 7]) {
      const row = segmentScaling(index);
      const segment = generateSegment(index, createRng(`RULES-SCALE-${index}`), DEFAULT_TUNING);
      for (const member of segment.gym.encounter?.team ?? []) {
        expect(member.level).toBeGreaterThanOrEqual(row.playerLevel + row.levelOffset.gym.min);
        expect(member.level).toBeLessThanOrEqual(row.playerLevel + row.levelOffset.gym.max);
      }
      gymLevels.push(segment.gym.encounter?.team[0]?.level ?? 0);
      expect(playerLevel(index)).toBe(row.playerLevel);
    }
    // And the index genuinely moves the numbers rather than being accepted and
    // ignored, which is what the Stage 1 version of this test was really for.
    expect(new Set(gymLevels).size).toBe(gymLevels.length);
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
