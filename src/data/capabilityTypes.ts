/**
 * The eight capabilities, the move that proves each one, and the types that
 * stand in for one.
 *
 * ## Why types and not a learnset
 *
 * A capability has three bands. `known` is a fact about the party — someone has
 * the move in a slot — and needs no table at all. `latent` is the interesting
 * one: "nobody has it, but somebody here plausibly could." The obvious answer
 * is a real gen 7 learnset, and it was measured rather than assumed: a
 * generated table over the 635 reachable species costs 12.8 kB and needs a
 * codegen script, a byte-identical drift test against a dependency that ships
 * new learnsets, and a prevo walk to stop an evolved Water type resolving
 * `none` for Surf.
 *
 * It was rejected, and the reason is not the 12.8 kB. It is that legality is
 * the wrong question for this game. GYMRUN runs Custom Game precisely so the
 * randomizer can hand the engine a Magikarp with Levitate and Boomburst — move
 * legality is not a rule this project enforces, it is a rule it exists to
 * break. A `latent` band read off a legality table would be the one place in
 * the game that asked whether a Pokemon is *allowed* to know something, and it
 * would have answered from a table nothing else consults.
 *
 * Types answer the question the player is actually asking, which is "does this
 * team look like it could get past a river". They are also legible: a player
 * who sees a Water type pass a Surf gate has learned the rule, and one who sees
 * a specific Water type fail it has learned nothing except that there is a
 * table they cannot see.
 *
 * `docs/generation.md` carries the decision. The learnset table is not
 * scheduled; it was considered, measured, and dropped.
 *
 * ## Where these type sets came from
 *
 * Not invented. The gen 7 learnsets were queried once, offline, and for each
 * capability the types whose members can actually learn that move were ranked:
 *
 *     surf       Water 78%
 *     strength   Fighting 76%   Ground 70%
 *     rockSmash  Fighting 82%   Ground 80%   Dark 57%   Rock 53%
 *     waterfall  Water 66%
 *     dive       Water 67%
 *     flash      Psychic 73%    Electric 69%  Grass 63%
 *     fly        Flying 58%
 *     cut        Dark 51%       Grass 45%
 *
 * The table below is that ranking with a thematic edit, because a gate is read
 * by a player and not by a validator. Dark tops `cut` and `rockSmash` only
 * because Dark types are disproportionately physical attackers, and "your Dark
 * type can cut down a tree" reads as a bug; Grass, Bug and Steel read as an
 * edge. Grass at 63% on `flash` is the same artifact in reverse. Where data and
 * theme agreed — every Water entry, Fighting and Ground on the two smashing
 * capabilities, Psychic and Electric on `flash` — the data was taken as-is.
 *
 * ## The known tuning lever
 *
 * `surf`, `waterfall` and `dive` are all Water and nothing else. That is what
 * the source material says and what the learnset ranking found, and it means
 * one type clears three of the eight gates: a party with any Water type is
 * never stopped by water again.
 *
 * It is left that way deliberately. Splitting them — Ice on `dive`, say — is an
 * invention, and 4.6c ships the simulator's per-band gate pass rate, which is
 * the instrument that would say whether the split is needed. Tuning before the
 * instrument exists is guessing with extra steps. This paragraph is the note to
 * the tuning pass that the lever is here and was not pulled.
 *
 * Share of the 635 reachable species that satisfies each capability, and how
 * often a party of four random pool species misses it entirely:
 *
 *     cut        26%   missed 30%      fly        16%   missed 50%
 *     surf       16%   missed 50%      waterfall  16%   missed 50%
 *     strength   20%   missed 42%      dive       16%   missed 50%
 *     rockSmash  20%   missed 42%      flash      20%   missed 41%
 */
import type { TypeName } from '../core/types';

/** The eight things a route can ask a party for. */
export type Capability =
  | 'cut'
  | 'surf'
  | 'strength'
  | 'rockSmash'
  | 'fly'
  | 'waterfall'
  | 'dive'
  | 'flash';

/** Every capability, in the order a readout lists them. */
export const CAPABILITIES: readonly Capability[] = [
  'cut',
  'surf',
  'strength',
  'rockSmash',
  'fly',
  'waterfall',
  'dive',
  'flash',
];

/**
 * The move that proves a capability outright.
 *
 * Here rather than in a `data/hms.ts`, because there is no such file and there
 * is not going to be one: the release plan's amendment makes HMs ordinary
 * moves, with no item class, no permanence and no teaching screen. This map is
 * the whole of what is special about them, and what is special is only that
 * eight moves have a second meaning on the map screen.
 *
 * Display names, matched case- and punctuation-insensitively, because that is
 * what `PokemonSpec.moves` carries.
 */
export const CAPABILITY_MOVES: Readonly<Record<Capability, string>> = {
  cut: 'Cut',
  surf: 'Surf',
  strength: 'Strength',
  rockSmash: 'Rock Smash',
  fly: 'Fly',
  waterfall: 'Waterfall',
  dive: 'Dive',
  flash: 'Flash',
};

/**
 * The types that make a party member a plausible candidate for a capability.
 *
 * A tuning table. Widening a row makes a gate easier for every party that rolls
 * that type; narrowing it makes the capability a thing to plan for.
 */
export const CAPABILITY_TYPES: Readonly<Record<Capability, readonly TypeName[]>> = {
  cut: ['Grass', 'Bug', 'Steel'],
  surf: ['Water'],
  strength: ['Fighting', 'Ground', 'Rock'],
  rockSmash: ['Fighting', 'Rock', 'Ground'],
  fly: ['Flying', 'Dragon'],
  waterfall: ['Water'],
  dive: ['Water'],
  flash: ['Electric', 'Psychic', 'Fairy'],
};

/** The move name that proves `capability`. */
export function capabilityMove(capability: Capability): string {
  return CAPABILITY_MOVES[capability];
}

/** The types that satisfy `capability`. */
export function capabilityTypes(capability: Capability): readonly TypeName[] {
  return CAPABILITY_TYPES[capability];
}
