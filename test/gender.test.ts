/**
 * Gender: rolled once, from the real ratio, and stable for the life of a run.
 *
 * **This file exists because the engine gets all three of those wrong**, and
 * the Stage 4.5.1 investigation measured it rather than assuming it. Showdown
 * assigns an unnamed gender in `sim/pokemon.ts` with:
 *
 *     this.gender = genders[set.gender] || this.species.gender ||
 *                   this.battle.sample(['M', 'F']);
 *
 * Three consequences, each of which a test below pins:
 *
 *   1. **The ratio is ignored.** `sample(['M','F'])` is a flat coin flip.
 *      Combee, 87.5% male in its own data, came out 206/194 over 400 seeds.
 *   2. **The draw comes from the battle PRNG**, so the same party member is
 *      male in one fight and female in the next, and a party screen has nothing
 *      to show at all.
 *   3. **It costs a draw per gendered body.** Naming the gender removes it,
 *      which is why this stage moved `ENGINE_VERSION` as well as
 *      `RANDOMIZER_VERSION` — a relocated draw, not a new one.
 *
 * The prohibition in the original spec ("do not add gender to `PokemonSpec`,
 * the sim derives it from species gender ratio, which is reproducible for a
 * fixed seed") rested on 1 and 2 being false. They are not, so the spec is
 * where gender lives now.
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import { createRng } from '../src/core/rng';
import {
  generateStarters,
  generateTrainerTeam,
  generateWildMon,
  RANDOMIZER_VERSION,
  rollGender,
} from '../src/core/randomizer';
import { chooseStarter, createRun, playRun, scriptedRunPolicy } from '../src/core/run';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { genderMark } from '../src/ui/scene';
import { SPECIES_POOL } from '../src/data/speciesPools';
import type { Gender } from '../src/core/types';

// ---------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------

describe('the species pool carries a real gender ratio', () => {
  it('gives every entry a male chance or an explicit null', () => {
    for (const entry of SPECIES_POOL) {
      if (entry.maleChance === null) continue;
      expect(entry.maleChance, entry.species).toBeGreaterThanOrEqual(0);
      expect(entry.maleChance, entry.species).toBeLessThanOrEqual(1);
    }
  });

  it('records the ratios the dex states, not a coin flip', () => {
    // The three shapes that matter, and the ones the engine would get wrong.
    const of = (id: string): number | null | undefined =>
      SPECIES_POOL.find((entry) => entry.id === id)?.maleChance;

    expect(of('combee'), 'Combee is 87.5% male, not 50%').toBe(0.875);
    expect(of('magnemite'), 'Magnemite is genderless').toBeNull();
    expect(of('chansey'), 'Chansey is always female').toBe(0);
    expect(of('tauros'), 'Tauros is always male').toBe(1);
  });

  it('has genderless entries, so the "render nothing" path is reachable', () => {
    expect(SPECIES_POOL.some((entry) => entry.maleChance === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------

describe('the randomizer rolls gender', () => {
  it('gives every generated Pokemon a gender', () => {
    const rng = createRng('GENDER-ROLL');
    for (let i = 0; i < 40; i++) {
      const mon = generateWildMon(2, 'normal', rng);
      expect(mon.gender === 'M' || mon.gender === 'F' || mon.gender === null, mon.species).toBe(true);
    }
  });

  it('gives starters and trainer teams one too, not only wild encounters', () => {
    const rng = createRng('GENDER-EVERYWHERE');
    for (const spec of generateStarters(3, 5, rng)) expect(spec.gender).not.toBeUndefined();
    for (const spec of generateTrainerTeam(3, 'hard', rng)) expect(spec.gender).not.toBeUndefined();
  });

  it('rolls null for a genderless species and never M or F', () => {
    // Sampled across many draws rather than asserted on one, because which
    // species comes out is the seed's business.
    const rng = createRng('GENDERLESS');
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      const mon = generateWildMon(4, 'hard', rng);
      const entry = SPECIES_POOL.find((e) => e.species === mon.species);
      if (entry?.maleChance !== null) continue;
      checked++;
      expect(mon.gender, mon.species).toBeNull();
    }
    expect(checked, 'no genderless species was ever drawn').toBeGreaterThan(0);
  });

  it('respects the ratio rather than flipping a coin', () => {
    /*
     * The measurement that overturned the spec's premise, as an assertion.
     *
     * An always-male species must come out male every time. Under the engine's
     * `sample(['M','F'])` this would be a coin flip — `species.gender` saves the
     * gender-*locked* ones, but nothing saves a species whose ratio is merely
     * skewed, which is why Combee is checked in the data test above.
     */
    const rng = createRng('RATIO');
    let male = 0;
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const mon = generateWildMon(5, 'elite', rng);
      const entry = SPECIES_POOL.find((e) => e.species === mon.species);
      if (entry?.maleChance !== 1) continue;
      checked++;
      if (mon.gender === 'M') male++;
    }
    if (checked > 0) expect(male).toBe(checked);
  });

  it('costs exactly one draw, genderless or not', () => {
    /*
     * The draw-and-discard, tested directly because it is invisible from
     * outside. A version that returned early for a genderless species would
     * pass every observable assertion in this file while quietly making the
     * per-Pokemon draw count a function of which species the pool contains.
     */
    const gendered = SPECIES_POOL.find((entry) => entry.maleChance === 0.5)!;
    const genderless = SPECIES_POOL.find((entry) => entry.maleChance === null)!;

    for (const entry of [gendered, genderless]) {
      const rng = createRng('ONE-DRAW');
      const before = rng.randomizer.draws;
      rollGender(entry, rng.randomizer);
      expect(rng.randomizer.draws - before, entry.species).toBe(1);
    }
  });

  it('rolls the stated ratio over many draws, not a coin flip', () => {
    // Combee: 87.5% male in its own data, and 50/50 under the engine's
    // `sample(['M','F'])`. 1000 draws, so the gap between 87.5% and 50% is far
    // outside anything sampling noise could produce.
    const combee = SPECIES_POOL.find((entry) => entry.id === 'combee')!;
    const rng = createRng('COMBEE-RATIO');
    let male = 0;
    for (let i = 0; i < 1000; i++) {
      if (rollGender(combee, rng.randomizer) === 'M') male++;
    }
    expect(male / 1000).toBeGreaterThan(0.82);
    expect(male / 1000).toBeLessThan(0.93);
  });
});

// ---------------------------------------------------------------------------
// Stability — the property the whole change exists for
// ---------------------------------------------------------------------------

describe('gender is stable', () => {
  it('is the same on the spec across many reads', () => {
    const rng = createRng('STABLE');
    const mon = generateWildMon(2, 'normal', rng);
    for (let i = 0; i < 5; i++) expect(mon.gender).toBe(mon.gender);
    expect(describeSpecCard(mon).gender).toBe(mon.gender);
  });

  it('survives a level-up, which rebuilds the spec', async () => {
    // `levelParty` builds `{...member.spec, level}`. A gender dropped there
    // would be silently re-rolled at the next battle.
    const state = chooseStarter(createRun('LEVELUP'), 0);
    const before = state.party[0]!.spec.gender;
    expect(before).not.toBeUndefined();

    const run = await playRun('LEVELUP', scriptedRunPolicy(greedyAiPolicy));
    for (const member of run.state.party) expect(member.spec.gender).not.toBeUndefined();
  }, 60_000);

  it('is the same every time a run is replayed from its seed', () => {
    const first = chooseStarter(createRun('REPLAY-GENDER'), 0);
    const second = chooseStarter(createRun('REPLAY-GENDER'), 0);
    expect(first.party.map((m) => m.spec.gender)).toEqual(second.party.map((m) => m.spec.gender));
  });

  it('does not vary with the battle seed, which is what it used to do', () => {
    // The old behaviour: the same spec came out F on seed 0 and M on seed 1
    // because the roll was `battle.sample` off the battle PRNG. The spec's
    // value is now read straight through, so a probe cannot disagree with it.
    const rng = createRng('NOT-THE-BATTLE');
    const mon = generateWildMon(3, 'normal', rng);
    expect(describeSpecCard({ ...mon }).gender).toBe(mon.gender);
    expect(describeSpecCard({ ...mon, level: mon.level + 1 }).gender).toBe(mon.gender);
  });
});

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

describe('the version guard covers this change', () => {
  it('has moved the randomizer version past Stage 4.5', () => {
    // Specs carry a new field rolled from a new draw, so every seed's species,
    // ability and moveset rolls differ from Stage 4.5's.
    expect(RANDOMIZER_VERSION).not.toBe('gymrun-randomizer-4');
  });
});

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

describe('genderMark', () => {
  it('shows a symbol for male and female', () => {
    expect(genderMark('M')).toBe(' ♂');
    expect(genderMark('F')).toBe(' ♀');
  });

  it('shows nothing at all for a genderless Pokemon, not a placeholder', () => {
    // The spec's rule, and the reason it is a rule: a dash or an "N" is a
    // symbol the player has to learn in order to ignore it.
    const nothing: Gender = null;
    expect(genderMark(nothing)).toBe('');
  });

  it('never renders a bare letter, which would read as a stat next to a level', () => {
    for (const gender of ['M', 'F', null] as const) {
      expect(genderMark(gender)).not.toMatch(/[A-Za-z]/);
    }
  });
});
