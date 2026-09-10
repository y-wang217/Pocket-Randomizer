/**
 * What the run can do about a route requirement, in three bands.
 *
 * Pure, no RNG, no dex. A capability is read off the run as it stands, so the
 * same run always reads the same band and a replay never has to record one.
 *
 * ## The three bands answer two different questions
 *
 * `known` is a fact about the **run**: it holds a relic that grants this
 * capability. `latent` is a statement about the **party**: nobody has the
 * relic, but somebody here is a type that could plausibly improvise the job.
 * `none` is neither.
 *
 * They are not two strengths of one test, and the split is why the signature
 * takes a `RunState` rather than a party. A relic belongs to the run, not to a
 * party member — it survives every faint, release and swap — so a function
 * given only a party could not see the band that matters.
 *
 * ## Nothing a Pokemon knows grants a capability
 *
 * A party member holding Surf does **not** make `surf` resolve `known`. This is
 * the load-bearing rule of the third design, and it reads as surprising until
 * you see what it prevents.
 *
 * Capabilities were first HM items and then ordinary moves. Both tied the value
 * of a capability to the quality of the move naming it: Surf is a move a player
 * keeps anyway, so Surf gates cost nothing; Cut is a move nobody keeps, so Cut
 * gates were unpassable. The same mechanic behaved oppositely depending on
 * which move it named, and the premise it rested on — that a utility slot is a
 * real sacrifice — held for one and collapsed for the other.
 *
 * So Surf-the-move and Surf-the-capability are unrelated systems that share a
 * name. If that reads as confusing in playtest the fix is to rename the
 * capabilities, never to reconnect them. `docs/generation.md` section 8 has the
 * full history and `docs/spec/` still holds both superseded designs.
 */
import { grantsCapability } from './relics';
import { capabilityTypes, type Capability } from '../data/capabilities';
import { typesOfSpecies } from '../data/speciesTypes';
import type { PokemonState } from './types';
import type { RelicId } from '../data/relics';

/**
 * How well a run answers a requirement.
 *
 * Three bands rather than a boolean because a gate the run *could* open is a
 * different decision from one it cannot: the first is a reason to route toward
 * an elite node for the relic, the second is a reason to walk the other way.
 */
export type CapabilityBand = 'known' | 'latent' | 'none';

/**
 * The part of a run this reads.
 *
 * Structural rather than `RunState` itself, so the map screen, the simulator
 * and a test can all ask without one of them having to build a whole run — and
 * so this module does not import the run state machine it is read by.
 */
export interface CapabilityContext {
  relics: readonly RelicId[];
  party: readonly PokemonState[];
}

/** Whether a member's species carries any of `types`. */
function hasType(member: PokemonState, types: readonly string[]): boolean {
  return typesOfSpecies(member.spec.species).some((type) => types.includes(type));
}

/**
 * The band this run reads at for this capability.
 *
 * Fainted members count toward `latent`. A capability is a property of the
 * team, not of who is standing up right now — a requirement read against a
 * party that just won a fight badly would otherwise flicker between bands on
 * the way to the next node, and the map would be reporting the last battle
 * rather than the run.
 */
export function resolveCapability(run: CapabilityContext, capability: Capability): CapabilityBand {
  if (grantsCapability(run.relics, capability)) return 'known';

  const types = capabilityTypes(capability);
  if (run.party.some((member) => hasType(member, types))) return 'latent';

  return 'none';
}
