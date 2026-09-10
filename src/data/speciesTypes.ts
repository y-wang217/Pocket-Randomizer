/**
 * A species' types, by the name a `PokemonSpec` carries.
 *
 * A lookup rather than a dex query, so a caller that must not import the sim
 * can still ask what a Pokemon is. `core/capabilities.ts` is that caller, and
 * the transitive boundary test in `test/boundaries.test.ts` is what keeps it
 * one.
 *
 * **Here rather than in `speciesPools.ts` because that file is generated.**
 * This was learned the direct way: the first version of this helper was
 * appended to the bottom of the pool file, and the next `npm run gen:pools`
 * deleted it. A derived read belongs beside generated data, never inside it.
 */
import { SPECIES_POOL } from './speciesPools';
import type { TypeName } from '../core/types';

const TYPES_BY_SPECIES = new Map<string, readonly TypeName[]>(
  SPECIES_POOL.map((entry) => [entry.species, entry.types]),
);

/**
 * The types of `species`, or empty if it is not a pool species.
 *
 * Empty rather than a throw. A capability read on an unknown species should
 * resolve `none` and let the run carry on, not end it.
 */
export function typesOfSpecies(species: string): readonly TypeName[] {
  return TYPES_BY_SPECIES.get(species) ?? [];
}
