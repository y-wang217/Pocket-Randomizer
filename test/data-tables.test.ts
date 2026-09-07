/**
 * The generated pools, held to the dex they were generated from.
 *
 * Stage 1 validated twenty-four hand-written entries here and the point was to
 * catch a typo. Nothing is hand-written any more, so a typo is impossible and a
 * *drift* is not: the tables are committed and @pkmn/sim is a dependency that
 * moves. If a version bump renames a move or reclassifies a species, the
 * randomizer would keep drawing an entry the engine no longer knows and the
 * failure would surface as one broken node in one seed.
 *
 * So this suite asserts the committed tables are a faithful **subset** of the
 * live dex, not an exact copy of it. Subset rather than equality on purpose:
 * an upstream release that *adds* a species must not fail the build, because
 * regenerating the pool to pick it up is a deliberate act that costs a
 * `RANDOMIZER_VERSION` bump and invalidates every shared seed.
 *
 * The second half asserts the properties the randomizer's correctness rests on
 * — that every band has every type to draw from — because those are assumed by
 * `rollMoveset` and by every gym.
 */
import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';

import { ABILITY_POOL } from '../src/data/abilities';
import { GYMS } from '../src/data/gyms';
import { DAMAGING_MOVES, MAX_MOVE_BAND, STATUS_MOVES } from '../src/data/movePools';
import { SEGMENTS, speciesBandsFor } from '../src/data/scaling';
import { MAX_SPECIES_BAND, SPECIES_POOL } from '../src/data/speciesPools';

const dex = Dex.forGen(9);

describe('species pool', () => {
  it('is large enough to be a randomizer rather than a shuffler', () => {
    // The Stage 2 done condition is that each seed feels different. A pool of
    // fifty would pass every other test in this file and fail that one.
    expect(SPECIES_POOL.length).toBeGreaterThan(500);
  });

  it('matches the dex on identity and typing', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      expect(species.exists, `species ${entry.species}`).toBe(true);
      expect(species.name, `${entry.id} name`).toBe(entry.species);
      // Typing is what STAB and gym identity are computed from, so a stale
      // type here is a Rock gym quietly fielding something that is not Rock.
      expect([...species.types], `${entry.species} types`).toEqual([...entry.types]);
      const bst = Object.values(species.baseStats).reduce((total, stat) => total + stat, 0);
      expect(bst, `${entry.species} bst`).toBe(entry.bst);
    }
  });

  it('bands every entry, and monotonically by base stat total', () => {
    for (const entry of SPECIES_POOL) {
      expect(entry.band).toBeGreaterThanOrEqual(0);
      expect(entry.band).toBeLessThanOrEqual(MAX_SPECIES_BAND);
    }
    // Two entries in different bands must not disagree about which is stronger,
    // or the band window stops being a difficulty lever.
    for (const a of SPECIES_POOL) {
      for (const b of SPECIES_POOL) {
        if (a.band < b.band) expect(a.bst, `${a.species} vs ${b.species}`).toBeLessThan(b.bst);
      }
    }
  });

  it('has no legendary, mythical, paradox or alternate forme in it', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      expect(species.tags ?? [], `${entry.species} tags`).toEqual([]);
      expect(species.forme, `${entry.species} forme`).toBe('');
      expect(species.battleOnly, `${entry.species} battleOnly`).toBeFalsy();
    }
    // The four DLC paradoxes carry no upstream tag, so the assertion above
    // cannot see them. They are excluded by name in scripts/gen-pools.ts.
    for (const id of ['ragingbolt', 'gougingfire', 'ironboulder', 'ironcrown']) {
      expect(SPECIES_POOL.some((entry) => entry.id === id), id).toBe(false);
    }
  });

  it('has ids unique enough to blacklist against', () => {
    const ids = SPECIES_POOL.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('move pools', () => {
  it('matches the dex on type, category and power', () => {
    for (const move of [...DAMAGING_MOVES, ...STATUS_MOVES]) {
      const data = dex.moves.get(move.id);
      expect(data.exists, `move ${move.name}`).toBe(true);
      expect(data.name, `${move.id} name`).toBe(move.name);
      // The randomizer picks STAB by comparing these strings to a species'
      // types. A stale type here is a moveset that is type-plausible on paper
      // and nonsense in the battle.
      expect(data.type, `${move.name} type`).toBe(move.type);
      expect(data.category, `${move.name} category`).toBe(move.category);
      if (move.category !== 'Status') expect(data.basePower, `${move.name} power`).toBe(move.basePower);
    }
  });

  it('offers every type in every band', () => {
    // `rollMoveset` asks for "a damaging move of this species' type in this
    // band" and falls back to open coverage if there is none. That fallback is
    // meant to be unreachable, and this is what keeps it that way: a band
    // missing a type would silently strip STAB from every species of it.
    const types = new Set(DAMAGING_MOVES.map((move) => move.type));
    expect(types.size).toBe(18);

    for (let band = 0; band <= MAX_MOVE_BAND; band++) {
      const inBand = new Set(DAMAGING_MOVES.filter((move) => move.band === band).map((move) => move.type));
      expect(inBand.size, `band ${band} covers ${inBand.size}/18 types`).toBe(18);
    }
  });

  it('carries only status moves in the status pool, and only attacks in the other', () => {
    for (const move of STATUS_MOVES) expect(move.category, move.name).toBe('Status');
    for (const move of DAMAGING_MOVES) {
      expect(move.category, move.name).not.toBe('Status');
      expect(move.basePower, move.name).toBeGreaterThan(0);
    }
  });

  it('excludes the moves the engine or the damage calc cannot play honestly', () => {
    // Mirrors the exclusion sets in scripts/gen-pools.ts. Named here as well
    // because these are the ones that would quietly corrupt a balance number
    // rather than crash: a self-KO ends a run on the opponent's turn, a switch
    // move does half of what it says, and a two-turn move scores as though the
    // charge turn were free.
    const banned = ['explosion', 'selfdestruct', 'finalgambit', 'memento', 'healingwish',
      'uturn', 'voltswitch', 'flipturn', 'batonpass', 'teleport', 'partingshot',
      'fissure', 'sheercold', 'guillotine', 'horndrill', 'solarbeam', 'fly', 'dig',
      'hyperbeam', 'gigaimpact', 'mindblown', 'steelbeam', 'struggle'];
    const present = DAMAGING_MOVES.map((move) => move.id);
    for (const id of banned) expect(present, id).not.toContain(id);
  });
});

describe('ability pool', () => {
  it('is the full pool, not a species-legal subset', () => {
    // Three hundred abilities is the whole gen 9 list. If this ever shrinks to
    // the dozens, someone has quietly turned the randomizer back into a
    // shuffler.
    expect(ABILITY_POOL.length).toBeGreaterThan(250);
    for (const name of ABILITY_POOL) {
      const ability = dex.abilities.get(name);
      expect(ability.exists, `ability ${name}`).toBe(true);
      expect(ability.name, name).toBe(name);
    }
    expect(ABILITY_POOL).not.toContain('No Ability');
  });
});

describe('the curve can be drawn from', () => {
  it('gives every segment species and moves to roll', () => {
    for (const row of SEGMENTS) {
      const bands = new Set(speciesBandsFor(row.segment, 'normal'));
      const available = SPECIES_POOL.filter((entry) => bands.has(entry.band));
      expect(available.length, `segment ${row.segment} species`).toBeGreaterThan(30);

      const moveBands = new Set(row.moveBands);
      const moves = DAMAGING_MOVES.filter((move) => moveBands.has(move.band));
      expect(moves.length, `segment ${row.segment} moves`).toBeGreaterThan(50);
    }
  });

  it('gives every gym its own type inside its own segment bands', () => {
    // The one data dependency that would turn a gym into a lie. `gymSpeciesFor`
    // widens to every band rather than throwing if this fails, so without this
    // test the failure mode is a silently off-curve gym rather than a crash.
    for (const gym of GYMS) {
      const bands = new Set(speciesBandsFor(gym.segment, 'normal'));
      const available = SPECIES_POOL.filter(
        (entry) => bands.has(entry.band) && entry.types.includes(gym.type),
      );
      expect(available.length, `${gym.leader} (${gym.type}) at segment ${gym.segment}`).toBeGreaterThan(3);
    }
  });

  it('names a type the dex recognises for every gym', () => {
    const known = new Set(dex.types.all().map((type) => type.name));
    for (const gym of GYMS) expect(known.has(gym.type), `${gym.leader}: ${gym.type}`).toBe(true);
  });
});
