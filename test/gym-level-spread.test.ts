/**
 * The gym level spread, and the two things it must never do.
 *
 * ## What the spread is
 *
 * Nuzlocke convention sets the player's level cap at the gym leader's **ace**,
 * so the ace is at parity by definition and every other member sits below it.
 * Measured across all sixteen gyms of FireRed and Emerald, the team mean is
 * **0.91** of the cap and the ratio is flat — early gyms are not softer by
 * level, they are softer by shape.
 *
 * GYMRUN's player curve is already a stretched Emerald, so until 2026-09-18 it
 * had the reference's cap numbers and handed them to the whole roster: every
 * gym Pokemon at parity, a ratio of 1.00 where the reference sits at 0.91.
 * `levelOffset.gym.min` is now `round(-0.18 x playerLevel)` and `max` stays at
 * zero.
 *
 * ## The two failure modes
 *
 * **A gym above the player.** That is what `max === 0` forbids, and the reason
 * is in `data/scaling.ts`: Speed is the only stat read as a comparison, so a gym
 * one level up takes the first move in every tie and no team building gets it
 * back. `generation.test.ts` pins the table; this pins what comes out of it,
 * because the clamp in `levelFor` raises a level after the range has been drawn
 * and is the one thing that could push a member past the ceiling.
 *
 * **A pool emptied by its own floor.** `bandedSpeciesPool` gates its whole pool
 * on one level, so a range widened downward would delete every species that
 * evolves above the new floor. Measured at this column before the fix: segment
 * 4's Fire band-3 pool fell 21 species to 3, segment 7's Dragon band-4 fell 7 to
 * 2, and segment 6's band-4 Ghost pool fell to **zero** while the table still
 * carried a weight for it. Building the pool at the ceiling is the fix and this
 * is what keeps it.
 *
 * `docs/spec/gymrun-patch-teach-now-and-gym-level-spread.md`.
 */
import { describe, expect, it } from 'vitest';

import { generateGymTeam } from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import { GYMS } from '../src/data/gyms';
import { opponentLevel, playerLevel, SEGMENT_COUNT, speciesBandWeightsFor } from '../src/data/scaling';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { stageAllowedAt } from '../src/data/evolution';
import { isSpeciesBlacklisted } from '../src/data/blacklists';

const SEEDS = 120;

function gymFor(segment: number) {
  const gym = GYMS.find((entry) => entry.segment === segment);
  if (!gym) throw new Error(`no gym at segment ${segment}`);
  return gym;
}

function teamsAt(segment: number, count: number) {
  const gym = gymFor(segment);
  return Array.from({ length: count }, (_, index) =>
    generateGymTeam(gym, segment, createRng(`SPREAD-${segment}-${index}`).randomizer.at('test')),
  );
}

describe('a gym is never above the player', () => {
  it('fields no member above the cap, at any segment, over many seeds', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const cap = playerLevel(segment);
      for (const team of teamsAt(segment, SEEDS)) {
        for (const member of team) {
          expect(
            member.level,
            `${member.species} at segment ${segment} is above the player's ${cap}`,
          ).toBeLessThanOrEqual(cap);
        }
      }
    }
  });

  it('fields no member below the range the table names', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const floor = opponentLevel('gym', segment, 'normal').min;
      for (const team of teamsAt(segment, SEEDS)) {
        for (const member of team) expect(member.level).toBeGreaterThanOrEqual(floor);
      }
    }
  });
});

describe('the spread', () => {
  it('puts the team mean near the 0.91 the reference games sit at', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      /*
       * The cap is the ace's level, which is the range's ceiling. It was the
       * player's level until 2026-09-25, when gyms 1 to 3 moved one under the
       * party; the reference ratio is team mean to ace, so it is read against
       * the ceiling and the 0.91 still means what it did.
       */
      const cap = opponentLevel('gym', segment, 'normal').max;
      const levels = teamsAt(segment, SEEDS).flatMap((team) => team.map((member) => member.level));
      const mean = levels.reduce((total, level) => total + level, 0) / levels.length;
      /*
       * Wider than the 0.910-0.914 the arithmetic gives, because `levelFor`
       * clamps a drawn level up to the species' own evolution level and that
       * pushes the measured mean above the uniform-draw figure by an amount
       * that depends on each gym's pool. The band is what says "this is a
       * spread around 0.91", not a re-derivation of the column.
       */
      expect(mean / cap, `segment ${segment} mean ratio`).toBeGreaterThan(0.88);
      expect(mean / cap, `segment ${segment} mean ratio`).toBeLessThan(1.0);
    }
  });

  it('actually spreads, rather than collapsing back onto parity', () => {
    // Over a whole population a gym must field *something* below the cap, or
    // the column is doing nothing and the patch is a no-op.
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const cap = playerLevel(segment);
      const levels = teamsAt(segment, SEEDS).flatMap((team) => team.map((member) => member.level));
      expect(levels.some((level) => level < cap), `segment ${segment} never drops below parity`).toBe(true);
    }
  });
});

describe('the table may not advertise a band the code cannot draw', () => {
  /*
   * The test segment 6 needed and did not have. Its only band-4 Ghost is
   * Gholdengo at 50 and `playerLevel(6)` is exactly 50, so gating that pool one
   * level lower emptied the band while `speciesBandWeights` kept its weight —
   * and `bandedSpeciesPool` carries an empty band's weight onto its neighbour
   * silently, which is right for a thin pool and wrong for a row that names a
   * band it can never fill.
   */
  it('has a non-empty gym pool for every band carrying weight', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const gym = gymFor(segment);
      // The pool is built at the ceiling, which is what makes this hold.
      const gate = opponentLevel('gym', segment, 'normal').max;
      const weights = speciesBandWeightsFor(segment, 'normal');
      for (const [band, weight] of Object.entries(weights)) {
        if (weight <= 0) continue;
        const pool = SPECIES_POOL.filter(
          (entry) =>
            entry.band === Number(band) &&
            stageAllowedAt(entry, gate) &&
            !isSpeciesBlacklisted(entry.id) &&
            entry.types.includes(gym.type),
        );
        expect(
          pool.length,
          `segment ${segment} (${gym.type}) carries weight ${weight} for band ${band} and can draw none`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
