/**
 * The eight capabilities, and the types that make a party a plausible candidate
 * for one.
 *
 * ## What this table is *not*
 *
 * It is not how a capability is satisfied. A capability is granted by a
 * **relic** — see `data/relics.ts` — and nothing in this file can produce the
 * `known` band. What lives here is the softer question underneath it: with no
 * relic, does this party look like it could improvise the job?
 *
 * That distinction is the third version of this design and the first one that
 * holds. `docs/generation.md` section 8 carries the full history; the short
 * form is that capabilities were first HM items, then ordinary moves, and both
 * tied capability value to move quality. Surf is a move a player keeps anyway,
 * Cut is a move nobody keeps, so under version 2 a Surf gate was free and a Cut
 * gate was impossible — the same mechanic behaving oppositely depending on
 * which move it named.
 *
 * **Knowing a capability-named move now grants nothing.** Surf-the-move and
 * Surf-the-capability are unrelated systems that happen to share a name.
 *
 * ## Why types and not a learnset
 *
 * The obvious `latent` test is a real gen 7 learnset, and it was measured
 * rather than assumed: a generated table over the 635 reachable species costs
 * 12.8 kB and needs a codegen script, a byte-identical drift test against a
 * dependency that ships new learnsets, and a prevo walk to stop an evolved
 * Water type resolving `none` for Surf.
 *
 * It was rejected, and not for the 12.8 kB. Legality is the wrong question for
 * this game: GYMRUN runs Custom Game precisely so the randomizer can hand the
 * engine a Magikarp with Levitate and Boomburst. A `latent` band read off a
 * legality table would be the one place in the game asking whether a Pokemon is
 * *allowed* to know something, out of a table nothing else consults.
 *
 * Under version 3 the objection is stronger still, because `latent` no longer
 * claims anything about a species at all — it is a hint that the party could
 * improvise, and a type is a better hint than a legality table for the reason
 * that decides it: **the map shows the requirement and the band**, and a player
 * can read a type off their own party without a lookup.
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
 * ## The known skew, and the lever that is not this table
 *
 * `surf`, `waterfall` and `dive` are all Water and nothing else, so a party
 * with any Water type sits at `latent` for three of the eight gates. Water and
 * Flying are common types; Ghost and Dragon are not. Capabilities keyed to
 * common types will therefore resolve `latent` more often, and that is a real
 * skew rather than a rounding error.
 *
 * **It is corrected by weighting event counts in `data/events.ts`, not by
 * narrowing these type sets.** Narrowing them to flatten the distribution would
 * make the table say something false about the games in order to fix a
 * different table's problem. 4.6c ships a per-capability `latent` rate in the
 * simulator report, which is the direct measurement that feeds the weighting.
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

/** The types that satisfy `capability`. */
export function capabilityTypes(capability: Capability): readonly TypeName[] {
  return CAPABILITY_TYPES[capability];
}
