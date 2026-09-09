/**
 * What a party can do about a route requirement, in three bands.
 *
 * Pure, no RNG, no dex. A capability is read off the party as it stands, so the
 * same party always reads the same band and a replay never has to record one.
 *
 * ## Slots before types, and why the order is the design
 *
 * `known` is checked first and it is checked against move slots, which means a
 * party member holding Surf satisfies `surf` whatever it is. That is the rule
 * the whole feature rests on: the run can *fix* a gate by teaching a move, and
 * a fix that some species were quietly ineligible for would be a promise the
 * map screen made and the party screen broke.
 *
 * `latent` then answers a softer question — nobody has the move, but somebody
 * here looks like they could carry it — from a type table in
 * `data/capabilityTypes.ts`. That file carries the argument for types over a
 * generated gen 7 learnset, and the measurements behind the table.
 *
 * So the two bands are not two strengths of the same test. `known` is a fact
 * about what the party is holding; `latent` is a statement about what it could
 * plausibly hold. Reading them in that order is what makes teaching a move
 * always work.
 */
import { capabilityMove, capabilityTypes, type Capability } from '../data/capabilityTypes';
import { typesOfSpecies } from '../data/speciesTypes';
import type { PokemonState } from './types';

/**
 * How well a party answers a requirement.
 *
 * Three bands rather than a boolean because a gate the party *could* open is a
 * different decision from one it cannot: the first is a reason to take a move
 * reward, the second is a reason to walk the other way.
 */
export type CapabilityBand = 'known' | 'latent' | 'none';

/** Punctuation- and case-insensitive, so 'Rock Smash' and 'rocksmash' agree. */
function normalize(move: string): string {
  return move.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Whether a member has `move` in one of its slots.
 *
 * Reads `spec.moves` rather than the live `moves` array. The two agree on which
 * moves a member has — `MoveState` is built from the spec and only PP moves
 * afterwards — and the spec is the one that exists before a battle has ever
 * built a `MoveState`, which is what a map-screen readout asks against.
 */
function hasMove(member: PokemonState, move: string): boolean {
  const wanted = normalize(move);
  return member.spec.moves.some((slotted) => normalize(slotted) === wanted);
}

/** Whether a member's species carries any of `types`. */
function hasType(member: PokemonState, types: readonly string[]): boolean {
  const mine = typesOfSpecies(member.spec.species);
  return mine.some((type) => types.includes(type));
}

/**
 * The band this party reads at for this capability.
 *
 * Fainted members count. A capability is a property of the team, not of who is
 * standing up right now — a route requirement asked against a party that just
 * won a fight badly would otherwise flicker between bands on the way to the
 * next node, and the map screen would be reporting the last battle rather than
 * the team.
 */
export function resolveCapability(
  party: readonly PokemonState[],
  capability: Capability,
): CapabilityBand {
  const move = capabilityMove(capability);
  if (party.some((member) => hasMove(member, move))) return 'known';

  const types = capabilityTypes(capability);
  if (party.some((member) => hasType(member, types))) return 'latent';

  return 'none';
}
