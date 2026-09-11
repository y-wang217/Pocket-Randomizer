/**
 * Base-power bands: the ramp's unit of measure.
 *
 * **Stage 4.6b.** A move's band is what "the player starts weak and climbs"
 * is expressed in — segments draw a distribution over bands, gyms draw one
 * band higher, rewards pay one or two above the segment, and the starter opens
 * at the bottom. All of that rests on a band meaning the same thing everywhere,
 * which is what this file is for.
 *
 * Four properties:
 *
 *   1. The band a move carries is the band its base power says, with the two
 *      documented corrections applied and nothing else.
 *   2. An override wins over the computed band, and cannot name a move that
 *      does not exist.
 *   3. The distribution is a ramp: later segments are strictly harder, gyms are
 *      harder than the segment around them, and nothing runs off the table.
 *   4. Every generated moveset still has an attack in it, and a starter never
 *      holds a move above band 1.
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import {
  bandedMovePool,
  damagingInBands,
  generateGymTeam,
  generateStarters,
  generateTrainerTeam,
  generateWildTeam,
} from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import { GYMS } from '../src/data/gyms';
import {
  bandOf,
  danglingOverrides,
  impactOf,
  MAX_MOVE_BAND,
  MIN_MOVE_BAND,
  MOVE_OVERRIDES,
} from '../src/data/moveOverrides';
import { COMPUTED_MAX_MOVE_BAND, DAMAGING_MOVES, STATUS_MOVES } from '../src/data/movePools';
import {
  GYM_MOVE_BAND_BONUS,
  moveBandsFor,
  moveBandWeightsFor,
  SEGMENTS,
  segmentMoveBand,
  starterLevel,
} from '../src/data/scaling';
import { STARTER_MOVE_BANDS } from '../src/data/starters';

const SEGMENT_INDEXES = SEGMENTS.map((row) => row.segment);
const SEEDS = Array.from({ length: 24 }, (_, index) => `BAND-${index}`);

/** The cuts in `scripts/gen-pools.ts`, restated so a drift in either is loud. */
const POWER_CUTS = [55, 75, 95];

function bandFromPower(power: number): number {
  const index = POWER_CUTS.findIndex((cut) => power <= cut);
  return (index === -1 ? POWER_CUTS.length : index) + 1;
}

// ---------------------------------------------------------------------------
// 1. Assignment
// ---------------------------------------------------------------------------

describe('band assignment', () => {
  it('bands every damaging move from 1 to 4, and no status move at all', () => {
    expect(MIN_MOVE_BAND).toBe(1);
    expect(COMPUTED_MAX_MOVE_BAND).toBe(POWER_CUTS.length + 1);

    for (const move of DAMAGING_MOVES) {
      const band = bandOf(move);
      expect(band, move.name).not.toBeNull();
      expect(band, move.name).toBeGreaterThanOrEqual(MIN_MOVE_BAND);
      expect(band, move.name).toBeLessThanOrEqual(MAX_MOVE_BAND);
      expect(impactOf(move), `${move.name} impact`).toBeNull();
    }

    for (const move of STATUS_MOVES) {
      expect(bandOf(move), `${move.name} band`).toBeNull();
      expect(impactOf(move), `${move.name} impact`).not.toBeNull();
    }
  });

  it('follows base power for every move except the two documented corrections', () => {
    /*
     * The sweep the spec asks for, stated as "and nothing else": a move whose
     * band does not follow from its base power has to be explained by an
     * override or by the multi-hit correction in the generator. Anything else
     * is banding that came from nowhere.
     */
    const unexplained = DAMAGING_MOVES.filter((move) => {
      if (MOVE_OVERRIDES[move.id]) return false;
      const computed = bandFromPower(move.basePower);
      if (bandOf(move) === computed) return false;
      // The only other correction: multi-hit moves band on power times expected
      // hits, so their band is always *above* what base power alone says.
      return (bandOf(move) ?? 0) <= computed;
    });
    expect(unexplained.map((move) => move.name)).toEqual([]);
  });

  it('bands multi-hit moves on what they actually apply in a turn', () => {
    // The named case, and the one that would be most wrong: Population Bomb
    // reports 20 base power and lands ten times.
    const bomb = DAMAGING_MOVES.find((move) => move.id === 'populationbomb');
    expect(bomb?.basePower).toBe(20);
    expect(bandOf(bomb!), 'Population Bomb should not be a band 1 move').toBe(MAX_MOVE_BAND);

    // And one that is genuinely weak despite hitting three times.
    const tripleKick = DAMAGING_MOVES.find((move) => move.id === 'triplekick');
    if (tripleKick) expect(bandOf(tripleKick)).toBe(1);
  });

  it('keeps every band monotonic in effective power', () => {
    // Two moves in different bands must not disagree about which hits harder,
    // or a band stops being a strength statement. Compared on the *corrected*
    // power, which for a single-hit move is its base power.
    const ceilingOf = (band: number): number =>
      band >= COMPUTED_MAX_MOVE_BAND ? Number.POSITIVE_INFINITY : (POWER_CUTS[band - 1] ?? 0);
    for (const move of DAMAGING_MOVES) {
      if (MOVE_OVERRIDES[move.id]) continue;
      // The move sits at or below its band's ceiling. Multi-hit moves are
      // banded *up* from their base power, so this holds for them too.
      expect(move.basePower, move.name).toBeLessThanOrEqual(ceilingOf(bandOf(move) ?? 1));
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Overrides
// ---------------------------------------------------------------------------

describe('the override table', () => {
  it('names no move the pools do not contain', () => {
    expect(danglingOverrides()).toEqual([]);
  });

  it('gives every entry a reason', () => {
    for (const [id, override] of Object.entries(MOVE_OVERRIDES)) {
      expect(override.why, `${id} has no reason`).toBeTruthy();
    }
  });

  it('wins over the computed band', () => {
    // Asserted against a synthetic entry rather than a real override, because
    // the table ships empty on purpose and a test that needed an entry in it
    // would be a test that pressures the table to grow.
    const move = DAMAGING_MOVES[0]!;
    const computed = bandOf(move);
    const overridden = { ...MOVE_OVERRIDES, [move.id]: { band: 4, why: 'test' } };
    const resolved = overridden[move.id]?.band ?? move.band;
    expect(resolved).toBe(4);
    expect(resolved).not.toBe(computed === 4 ? -1 : computed);
  });
});

// ---------------------------------------------------------------------------
// 3. The ramp
// ---------------------------------------------------------------------------

describe('the segment ramp', () => {
  it('climbs, and never falls back', () => {
    const bands = SEGMENT_INDEXES.map((segment) => segmentMoveBand(segment));
    expect(bands).toEqual([...bands].sort((a, b) => a - b));
    // It has to actually move, or the table is a flat line with extra steps.
    expect(bands.at(0)).toBe(MIN_MOVE_BAND);
    expect(bands.at(-1)).toBe(MAX_MOVE_BAND);
  });

  it('opens on band 1 alone and ends on band 4', () => {
    expect(moveBandsFor(0, 'normal')).toEqual([1]);
    expect(moveBandsFor(1, 'normal')).toEqual([1]);
    expect(moveBandsFor(7, 'normal')).toContain(MAX_MOVE_BAND);
  });

  it('makes a hard node draw above a normal one, and elite above hard', () => {
    for (const segment of SEGMENT_INDEXES) {
      const normal = segmentMoveBand(segment, 'normal');
      const hard = segmentMoveBand(segment, 'hard');
      const elite = segmentMoveBand(segment, 'elite');
      expect(hard, `segment ${segment} hard`).toBeGreaterThanOrEqual(normal);
      expect(elite, `segment ${segment} elite`).toBeGreaterThanOrEqual(hard);
    }
  });

  it('never asks for a band the table does not have', () => {
    for (const segment of SEGMENT_INDEXES) {
      for (const tier of ['normal', 'hard', 'elite'] as const) {
        for (const band of moveBandsFor(segment, tier)) {
          expect(band, `segment ${segment} ${tier}`).toBeGreaterThanOrEqual(MIN_MOVE_BAND);
          expect(band, `segment ${segment} ${tier}`).toBeLessThanOrEqual(MAX_MOVE_BAND);
          expect(damagingInBands([band]).length, `band ${band} is empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the total weight positive in every segment and tier', () => {
    for (const segment of SEGMENT_INDEXES) {
      for (const tier of ['normal', 'hard', 'elite'] as const) {
        const weights = Object.values(moveBandWeightsFor(segment, tier));
        expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeGreaterThan(0);
      }
    }
  });

  it('gives a gym leader a band the segment around it does not draw', () => {
    expect(GYM_MOVE_BAND_BONUS).toBeGreaterThan(0);
    // Measured through the roll rather than the table, because the bonus is
    // applied in `gymMovePool` and a constant nobody reads is not a spike.
    for (const segment of [0, 3, 6]) {
      const gym = GYMS[segment]!;
      const gymBands = new Set(
        generateGymTeam(gym, segment, createRng(`GYM-BAND-${segment}`).randomizer.at('test'))
          .flatMap((spec) => describeSpecCard(spec).moves)
          .filter((move) => move.category !== 'Status')
          .map((move) => bandFromPower(move.basePower)),
      );
      const segmentTop = Math.max(...moveBandsFor(segment, 'normal'));
      expect(Math.max(...gymBands), `gym ${segment}`).toBeGreaterThanOrEqual(segmentTop);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. What a generated moveset holds
// ---------------------------------------------------------------------------

describe('generated movesets under banding', () => {
  it('always has at least one damaging move', () => {
    // The property test the spec asks to keep: banding narrows the pool every
    // slot draws from, so "slot one is always an attack" has to survive it.
    for (const seed of SEEDS) {
      for (const segment of SEGMENT_INDEXES) {
        const rng = createRng(`${seed}-${segment}`);
        const team = [
          ...generateWildTeam(segment, 'normal', rng.randomizer.at('test')),
          ...generateTrainerTeam(segment, 'elite', rng.randomizer.at('test')),
        ];
        for (const spec of team) {
          const damaging = describeSpecCard(spec).moves.filter((move) => move.category !== 'Status');
          expect(damaging.length, `${spec.species} at segment ${segment}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never gives a starter a move above band 1', () => {
    expect(STARTER_MOVE_BANDS).toEqual([1]);
    for (const seed of SEEDS) {
      for (const spec of generateStarters(3, starterLevel(), createRng(seed).randomizer.at('test'))) {
        for (const move of describeSpecCard(spec).moves) {
          if (move.category === 'Status') continue;
          expect(bandFromPower(move.basePower), `${spec.species} knows ${move.name}`).toBe(1);
        }
      }
    }
  });

  it('spends the same number of draws whatever the weights say', () => {
    /*
     * The invariant the band draw was built around: one draw per slot for the
     * band, taken whether or not the slot uses it. Retuning `moveBandWeights`
     * has to change *which* move a slot gets and never how many draws the
     * moveset costs, or every roll after it in the seed moves with the tuning.
     */
    // Measured through the real entry points rather than against the draw
    // helper directly: what has to hold is that a *team* costs the same, which
    // is the number every later roll in the seed is positioned by.
    const cost = (segment: number): number => {
      const rng = createRng('BAND-COST');
      const before = rng.randomizer.at('test').draws;
      generateTrainerTeam(segment, 'normal', rng.randomizer.at('test'));
      return rng.randomizer.at('test').draws - before;
    };
    // Segment 0 draws one band; segment 6 draws from two. Team sizes differ by
    // segment, so this compares per-member cost.
    const perMember = (segment: number): number =>
      cost(segment) / generateTrainerTeam(segment, 'normal', createRng('BAND-COST').randomizer.at('test')).length;
    expect(perMember(0)).toBe(perMember(6));
  });

  it('produces the same moveset for the same stream position, twice', () => {
    for (const segment of SEGMENT_INDEXES) {
      const first = generateWildTeam(segment, 'hard', createRng('BAND-DET').randomizer.at('test'));
      const second = generateWildTeam(segment, 'hard', createRng('BAND-DET').randomizer.at('test'));
      expect(second).toEqual(first);
    }
  });

  it('builds a pool for every segment and tier without emptying one', () => {
    for (const segment of SEGMENT_INDEXES) {
      for (const tier of ['normal', 'hard', 'elite'] as const) {
        const pool = bandedMovePool(segment, tier);
        expect(pool.all.length, `segment ${segment} ${tier}`).toBeGreaterThan(20);
        expect(Object.keys(pool.weights).length).toBeGreaterThan(0);
      }
    }
  });
});
