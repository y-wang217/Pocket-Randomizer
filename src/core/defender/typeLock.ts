/**
 * The gym type, read off a species. **Defender Mode v0, step 2; the lock
 * reversed 2026-10-06.**
 *
 * Until then every party slot had to carry the gym type in either type slot,
 * and the Stranger's Pass exempted one. Now any mon may join, and what these
 * two readings decide is the **badge**: `badge.ts`'s `badgesActive` puts it
 * out while any member does not carry the type and the Pass is not held, and
 * `memberBadge` gives an off-type member none even while it is lit. The
 * refusal and the exempt slot are deleted (`docs/generation.md` section 117).
 *
 * Read off the species' own types (`data/speciesTypes.ts`), never a battle's
 * live types: a Burn Up or a Soak changes a Pokemon for a fight, not which
 * gym it belongs to.
 */
import { typesOfSpecies } from '../../data/speciesTypes';
import type { PokemonSpec } from '../types';

/** Whether `spec`'s species carries `gymType` in either slot. */
export function carriesGymType(spec: Pick<PokemonSpec, 'species'>, gymType: string): boolean {
  return typesOfSpecies(spec.species).includes(gymType);
}

/** How many of `party` do not carry the gym type. */
export function offTypeCount(party: readonly Pick<PokemonSpec, 'species'>[], gymType: string): number {
  return party.filter((spec) => !carriesGymType(spec, gymType)).length;
}
