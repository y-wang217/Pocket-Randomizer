/**
 * The three capability bands.
 *
 * The property that matters most is the last one in this file: teaching a
 * capability move always yields `known`, whatever the party read before. That
 * is the rule the whole feature rests on — a gate the run can see is a gate the
 * run can fix — and it is the one a legality-based `latent` would have broken,
 * silently, for exactly the species a player would have been most surprised by.
 */
import { describe, expect, it } from 'vitest';
import { createPartyMember } from '../src/core/party';
import { resolveCapability } from '../src/core/capabilities';
import { CAPABILITIES, CAPABILITY_MOVES, CAPABILITY_TYPES, capabilityTypes } from '../src/data/capabilityTypes';
import { SPECIES_POOL, typesOfSpecies } from '../src/data/speciesPools';
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

describe('the three bands', () => {
  it('reads none when neither a slot nor a type answers', () => {
    // A Fire type with no capability move: not Water, so not even latent.
    const party = [member(firstOf('Fire'), ['Ember', 'Tackle'])];
    expect(resolveCapability(party, 'surf')).toBe('none');
  });

  it('reads latent when a type answers but no slot does', () => {
    const party = [member(firstOf('Water'), ['Tackle'])];
    expect(resolveCapability(party, 'surf')).toBe('latent');
  });

  it('reads known when a slot answers', () => {
    const party = [member(firstOf('Water'), ['Surf'])];
    expect(resolveCapability(party, 'surf')).toBe('known');
  });

  it('reads known off a species whose type does not answer', () => {
    // The whole point of slots-before-types: a Fire type holding Surf passes
    // the water gate. Nothing asks whether it was allowed to learn it.
    const party = [member(firstOf('Fire'), ['Surf'])];
    expect(resolveCapability(party, 'surf')).toBe('known');
  });

  it('matches a move name case- and punctuation-insensitively', () => {
    const party = [member(firstOf('Fire'), ['rock smash'])];
    expect(resolveCapability(party, 'rockSmash')).toBe('known');
  });

  it('reads an empty party as none', () => {
    expect(resolveCapability([], 'cut')).toBe('none');
  });

  it('counts a fainted member', () => {
    // A capability is a property of the team, not of who is standing up.
    const [live] = [member(firstOf('Water'), ['Surf'])];
    if (!live) throw new Error('fixture');
    expect(resolveCapability([{ ...live, fainted: true, hp: 0 }], 'surf')).toBe('known');
  });

  it('answers from any slot in the party, not just the lead', () => {
    const party = [member(firstOf('Fire'), ['Ember']), member(firstOf('Water'), ['Surf'])];
    expect(resolveCapability(party, 'surf')).toBe('known');
  });
});

describe('the property that makes a gate fixable', () => {
  it('yields known for every capability once the move is slotted, from any prior band', () => {
    for (const capability of CAPABILITIES) {
      const move = CAPABILITY_MOVES[capability];
      const satisfying = capabilityTypes(capability);

      // A species that answers by type, and one that does not, so both the
      // latent->known and the none->known transitions are covered.
      const byType = firstOf(satisfying[0] ?? 'Water');
      const notByType = SPECIES_POOL.find(
        (row) => !row.types.some((type) => satisfying.includes(type)),
      )?.species;
      if (!notByType) throw new Error(`Every pool species answers ${capability}`);

      expect(resolveCapability([member(byType, ['Tackle'])], capability)).toBe('latent');
      expect(resolveCapability([member(notByType, ['Tackle'])], capability)).toBe('none');

      for (const species of [byType, notByType]) {
        expect(resolveCapability([member(species, [move])], capability)).toBe('known');
        expect(resolveCapability([member(species, ['Tackle', move, 'Ember'])], capability)).toBe('known');
      }
    }
  });
});

describe('the type table', () => {
  it('covers every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_TYPES[capability].length).toBeGreaterThan(0);
      expect(CAPABILITY_MOVES[capability]).toBeTruthy();
    }
  });

  it('names only types the species pool actually carries', () => {
    // A typo here would make a gate unpassable and nothing else would say so.
    const real = new Set(SPECIES_POOL.flatMap((entry) => entry.types));
    for (const capability of CAPABILITIES) {
      for (const type of CAPABILITY_TYPES[capability]) {
        expect(real.has(type), `${capability} names an unknown type ${type}`).toBe(true);
      }
    }
  });

  it('leaves every capability reachable and none automatic', () => {
    // Both ends matter: a gate no species answers is a wall, and one every
    // species answers is not a gate at all.
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
    expect(resolveCapability([member('Missingno', ['Tackle'])], 'surf')).toBe('none');
  });
});
