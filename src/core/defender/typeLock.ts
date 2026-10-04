/**
 * The type lock. **Defender Mode v0, step 2.**
 *
 * Every party slot must carry the gym type in either type slot; secondary
 * types are the coverage. The off-type relic (step 5) grants a number of
 * exempt slots, and a party may hold that many off-type members and no more.
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

/**
 * Why `candidate` may not join `party`, or null when it may.
 *
 * `replacing` is the slot the candidate takes over, for a trade, so the member
 * leaving is not counted against the exemption it frees. A refusal is a string
 * so the run can throw it whole: loud, and naming the mon.
 */
export function typeLockRefusal(
  party: readonly Pick<PokemonSpec, 'species'>[],
  candidate: Pick<PokemonSpec, 'species'>,
  gymType: string,
  exemptSlots: number,
  replacing?: number,
): string | null {
  if (carriesGymType(candidate, gymType)) return null;
  const staying = party.filter((_, slot) => slot !== replacing);
  const used = offTypeCount(staying, gymType);
  if (used < exemptSlots) return null;
  return `${candidate.species} does not carry ${gymType}, and the party's ${exemptSlots} exempt slot${
    exemptSlots === 1 ? ' is' : 's are'
  } ${exemptSlots === 0 ? 'not available' : 'taken'}`;
}
