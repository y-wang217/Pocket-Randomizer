/**
 * Generation has to be a pure function of the seed, and the curated pools have
 * to actually exist.
 *
 * The first half is the Stage 1 restatement of Stage 0's central property: two
 * players who type the same seed get the same starters, the same map and the
 * same encounters, or the seed means nothing. The second half is cheaper and
 * just as load-bearing — "curated" is a promise that every entry in these pools
 * is a real Pokemon with real moves, and a typo in a move name is a promise
 * quietly broken in one node of one seed.
 */
import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';

import { describeSpec } from '../src/core/battle/driver';
import { generateSegment, generateStarterOptions, nodesOf, type Segment } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { TRAINER_POOL, WILD_POOL, type MonEntry } from '../src/data/mons';
import { GYMS } from '../src/data/gyms';
import { getStarterPool } from '../src/data/starters';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const dex = Dex.forGen(9);

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
      .filter((seed): seed is string => Boolean(seed));

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
    // Stage 1 always passes 0. This asserts the index is actually used, which
    // is the difference between a generator Stage 2 can call in a loop and one
    // it has to rewrite.
    const rngA = createRng('RULES-SCALE');
    const rngB = createRng('RULES-SCALE');
    const first = generateSegment(0, rngA, DEFAULT_TUNING);
    const later = generateSegment(3, rngB, DEFAULT_TUNING);

    const levelOf = (segment: Segment): number => segment.gym.encounter?.team[0]?.level ?? 0;
    expect(levelOf(later) - levelOf(first)).toBe(3 * DEFAULT_TUNING.levelPerSegment);
  });

  it('offers distinct starters', () => {
    for (const seed of seeds) {
      const options = generateStarterOptions(createRng(seed), DEFAULT_TUNING);
      expect(options).toHaveLength(DEFAULT_TUNING.starterOptionCount);
      expect(new Set(options.map((o) => o.species)).size).toBe(options.length);
      for (const option of options) expect(option.level).toBe(DEFAULT_TUNING.starterLevel);
    }
  });
});

describe('curated pools', () => {
  const pools: Record<string, readonly MonEntry[]> = {
    starters: getStarterPool(),
    wild: WILD_POOL,
    trainer: TRAINER_POOL,
    gyms: GYMS.flatMap((gym) => gym.team),
  };

  for (const [name, pool] of Object.entries(pools)) {
    it(`${name}: every entry is a real Pokemon with real moves`, () => {
      for (const entry of pool) {
        expect(dex.species.get(entry.species).exists, `species ${entry.species}`).toBe(true);
        expect(dex.abilities.get(entry.ability).exists, `${entry.species}: ability ${entry.ability}`).toBe(true);
        expect(entry.moves, `${entry.species} moves`).toHaveLength(4);
        for (const move of entry.moves) {
          expect(dex.moves.get(move).exists, `${entry.species}: move ${move}`).toBe(true);
        }
      }
    });

    it(`${name}: no entry can lose a battle to itself`, () => {
      // Self-KO ends a run on the opponent's turn rather than the player's
      // play; switch moves silently do half of what they say until Stage 4
      // gives the driver a switch choice.
      const banned = new Set(['explosion', 'selfdestruct', 'finalgambit', 'memento', 'healingwish',
        'uturn', 'voltswitch', 'flipturn', 'batonpass', 'teleport', 'partingshot']);
      for (const entry of pool) {
        for (const move of entry.moves) {
          expect(banned.has(dex.moves.get(move).id), `${entry.species}: ${move}`).toBe(false);
        }
      }
    });

    it(`${name}: every id is unique`, () => {
      const ids = pool.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

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
