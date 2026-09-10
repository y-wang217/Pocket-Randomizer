/**
 * The three capability bands, version 3.
 *
 * **Rewritten for Stage 4.6c.** This file previously asserted that a party
 * member with the capability move in a slot resolved `known` — including a case
 * named "reads known off a species whose type does not answer", which was the
 * point of the old design and is exactly backwards under this one. Capabilities
 * are granted by relics now, and nothing a Pokemon knows grants one. The old
 * assertions are replaced rather than deleted: the same situations are still
 * covered, with the answers version 3 gives.
 *
 * The property that matters most is the last one: holding the relic yields
 * `known` from any prior band. That is the rule the whole feature rests on — a
 * gate the run can see is a gate the run can open — and it is the one both
 * earlier designs broke, each for a different half of the capability list.
 */
import { describe, expect, it } from 'vitest';
import { createPartyMember } from '../src/core/party';
import { resolveCapability, type CapabilityContext } from '../src/core/capabilities';
import { CAPABILITIES, CAPABILITY_TYPES, capabilityTypes } from '../src/data/capabilities';
import { RELICS, relicsGranting } from '../src/data/relics';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { typesOfSpecies } from '../src/data/speciesTypes';
import type { PokemonState } from '../src/core/types';

function member(species: string, moves: string[]): PokemonState {
  return createPartyMember({ species, ability: 'Levitate', moves, level: 30 });
}

/** The first pool species carrying `type`, so the fixtures track the data. */
function firstOf(type: string): string {
  const entry = SPECIES_POOL.find((row) => row.types.includes(type));
  if (!entry) throw new Error(`No pool species is ${type}`);
  return entry.species;
}

/** A species carrying none of `types`. */
function firstWithout(types: readonly string[]): string {
  const entry = SPECIES_POOL.find((row) => !row.types.some((type) => types.includes(type)));
  if (!entry) throw new Error('Every pool species answers');
  return entry.species;
}

const run = (relics: string[], party: PokemonState[]): CapabilityContext => ({ relics, party });

describe('the three bands', () => {
  it('reads none when neither a relic nor a type answers', () => {
    const party = [member(firstWithout(capabilityTypes('surf')), ['Ember', 'Tackle'])];
    expect(resolveCapability(run([], party), 'surf')).toBe('none');
  });

  it('reads latent when a type answers but no relic does', () => {
    expect(resolveCapability(run([], [member(firstOf('Water'), ['Tackle'])]), 'surf')).toBe('latent');
  });

  it('reads known when a relic grants it', () => {
    const relic = relicsGranting('surf')[0];
    if (!relic) throw new Error('fixture');
    expect(resolveCapability(run([relic.id], []), 'surf')).toBe('known');
  });

  it('reads known on an empty party, because a relic is a run property', () => {
    const relic = relicsGranting('fly')[0];
    if (!relic) throw new Error('fixture');
    expect(resolveCapability(run([relic.id], []), 'fly')).toBe('known');
  });
});

describe('nothing a Pokemon knows grants a capability', () => {
  it('does not read known off a slotted capability-named move', () => {
    // The load-bearing rule of version 3, and the exact case the old file
    // asserted the other way. A Fire type holding Surf is a Fire type holding
    // an attack; it opens no water.
    const party = [member(firstWithout(capabilityTypes('surf')), ['Surf', 'Waterfall', 'Dive'])];
    expect(resolveCapability(run([], party), 'surf')).toBe('none');
  });

  it('still reads latent off type alone, move or no move', () => {
    const water = firstOf('Water');
    expect(resolveCapability(run([], [member(water, ['Surf'])]), 'surf')).toBe('latent');
    expect(resolveCapability(run([], [member(water, ['Tackle'])]), 'surf')).toBe('latent');
  });

  it('is unmoved by a relic that grants a different capability', () => {
    const flyRelic = relicsGranting('fly')[0];
    if (!flyRelic) throw new Error('fixture');
    const party = [member(firstWithout(capabilityTypes('surf')), ['Surf'])];
    expect(resolveCapability(run([flyRelic.id], party), 'surf')).toBe('none');
  });
});

describe('the property that makes a gate openable', () => {
  it('yields known for every capability once the relic is held, from any prior band', () => {
    for (const capability of CAPABILITIES) {
      const relic = relicsGranting(capability)[0];
      expect(relic, `no relic grants ${capability}`).toBeTruthy();
      if (!relic) continue;

      const satisfying = capabilityTypes(capability);
      const byType = firstOf(satisfying[0] ?? 'Water');
      const notByType = firstWithout(satisfying);

      // The three prior bands, each confirmed before the relic is added.
      expect(resolveCapability(run([], [member(byType, ['Tackle'])]), capability)).toBe('latent');
      expect(resolveCapability(run([], [member(notByType, ['Tackle'])]), capability)).toBe('none');
      expect(resolveCapability(run([], []), capability)).toBe('none');

      for (const party of [[member(byType, ['Tackle'])], [member(notByType, ['Tackle'])], []]) {
        expect(resolveCapability(run([relic.id], party), capability)).toBe('known');
      }
    }
  });

  it('holds for every relic in the table, not just the first per capability', () => {
    for (const relic of RELICS) {
      expect(resolveCapability(run([relic.id], []), relic.grants)).toBe('known');
    }
  });
});

describe('the type table', () => {
  it('covers every capability and has a relic for each', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_TYPES[capability].length).toBeGreaterThan(0);
      expect(relicsGranting(capability).length).toBeGreaterThan(0);
    }
  });

  it('names only types the species pool actually carries', () => {
    // A typo here would make a gate unreachable at latent and nothing else
    // would say so.
    const real = new Set(SPECIES_POOL.flatMap((entry) => entry.types));
    for (const capability of CAPABILITIES) {
      for (const type of CAPABILITY_TYPES[capability]) {
        expect(real.has(type), `${capability} names an unknown type ${type}`).toBe(true);
      }
    }
  });

  it('leaves every capability reachable at latent and none automatic', () => {
    for (const capability of CAPABILITIES) {
      const types = capabilityTypes(capability);
      const answering = SPECIES_POOL.filter((row) => row.types.some((type) => types.includes(type)));
      expect(answering.length, `${capability} is unreachable`).toBeGreaterThan(0);
      expect(answering.length, `${capability} is automatic`).toBeLessThan(SPECIES_POOL.length);
    }
  });
});

describe('the species type lookup', () => {
  it('returns the pool entry types', () => {
    const entry = SPECIES_POOL[0];
    if (!entry) throw new Error('fixture');
    expect(typesOfSpecies(entry.species)).toEqual(entry.types);
  });

  it('returns empty for a species outside the pool rather than throwing', () => {
    expect(typesOfSpecies('Missingno')).toEqual([]);
  });

  it('resolves none for a party of an unknown species', () => {
    expect(resolveCapability(run([], [member('Missingno', ['Tackle'])]), 'surf')).toBe('none');
  });
});
