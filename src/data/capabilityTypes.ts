/**
 * What a capability is, and which types satisfy it without the move.
 *
 * A capability is a gate an event can put in front of the player: "this needs
 * Cut". The party answers it in one of three ways, and `core/capabilities.ts`
 * owns that resolution. This file owns the two data halves it reads — the
 * capability list, and the types that make a capability *latent*.
 *
 * ## Latent is type-based, not learnset-based
 *
 * The obvious implementation is a generated learnset table: a capability is
 * latent if some party member could legally learn the move. That was built as
 * far as a measurement — 12.8 kB over the reachable species pool — and
 * rejected, for three reasons that all point the same way.
 *
 * **Move legality is already fiction here.** The randomizer hands moves to
 * species that cannot learn them; that is what a randomizer is, and
 * `core/battle/format.ts` runs Custom Game precisely so no validator objects.
 * A `latent` derived from learnsets would be the one place in the game where
 * legality suddenly counted, and it would disagree with the moveset the player
 * is looking at.
 *
 * **A type is legible off the map.** The party screen already shows every
 * member's types, and the run map already shows a locale's four. A player who
 * reads "requires Cut, your party: latent" can look at their Bulbasaur and see
 * why. A learnset answer is a lookup they cannot perform and therefore cannot
 * predict.
 *
 * **The bundle does not ship learnsets.** `build-config/trim-sim-data.ts`
 * strips the learnset, legality and Pokemon GO tables — about 450 kB gzipped —
 * on the argument that GYMRUN never validates a team, and
 * `test/trimmed-data.test.ts` holds it to that. A learnset-based `latent` would
 * have put those tables back, or shipped a second copy of the part it needed.
 *
 * ## The type sets are a balance dial
 *
 * Two types is the default width. One (`surf`) is deliberately narrow and four
 * would be wide enough that `latent` stopped meaning anything — every party of
 * six would satisfy it. They live here rather than in `core/` because widening
 * one is a tuning pass, not a logic change.
 *
 * **Part 4 applies.** Nothing in this file ranks a capability, calls one
 * easier, or tells the player what to do about a gate. A type set is an
 * attribute of the capability and the screen states it.
 */
import type { TypeName } from '../core/types';

/**
 * The capabilities, in a fixed order.
 *
 * The order is a **draw order** — `data/events.ts` gates on these ids and a
 * future weighted pick would index into this list — so appending is safe and
 * reordering changes what a recorded seed produces.
 *
 * Five, and the set is deliberately short. Fly and Dive are absent because
 * their moves carry `flags.charge` and `scripts/gen-pools.ts` excludes charge
 * moves from every pool: the damage calc scores one turn of a two-turn move,
 * so a policy that picks them looks twice as strong as it plays. That
 * exclusion is protecting a number in the balance report, and a capability
 * bound to a move no pool contains would be a gate the player cannot open.
 */
export const CAPABILITIES = ['cut', 'flash', 'rockSmash', 'strength', 'surf'] as const;

export type CapabilityId = (typeof CAPABILITIES)[number];

export interface CapabilityDefinition {
  id: CapabilityId;
  /** What the event screen and the map node call it. A name, never a verdict. */
  label: string;
  /**
   * The types that satisfy this capability without the move slotted.
   *
   * A party member qualifies if **either** of its types is in this list, which
   * is the same rule `data/locales.ts` uses to admit a species to a locale.
   * One matching member is enough — a capability is a thing the party can do,
   * not a thing every member can do.
   */
  types: readonly TypeName[];
}

/**
 * The table.
 *
 * Every set is satisfiable by at least two locales, which is the property
 * `test/capabilities.test.ts` asserts rather than trusts: a capability whose
 * types no locale offers is a gate that resolves `none` for every party that
 * did not buy the move, and a mechanic that cannot appear is one nobody can
 * learn — the same argument `tuning.minEventSteps` rests on.
 *
 * The move's own type has nothing to do with these. Cut is a Normal-type move
 * satisfied by Grass and Bug, because the question is what a party could
 * plausibly do, not what the move is made of.
 */
export const CAPABILITY_TYPES: Readonly<Record<CapabilityId, CapabilityDefinition>> = {
  cut: { id: 'cut', label: 'Cut', types: ['Grass', 'Bug'] },
  flash: { id: 'flash', label: 'Flash', types: ['Electric', 'Fire', 'Fairy'] },
  rockSmash: { id: 'rockSmash', label: 'Rock Smash', types: ['Fighting', 'Rock'] },
  strength: { id: 'strength', label: 'Strength', types: ['Fighting', 'Steel'] },
  surf: { id: 'surf', label: 'Surf', types: ['Water'] },
};

/** The definition, or null for an id no capability uses. */
export function capabilityById(id: string): CapabilityDefinition | null {
  return (CAPABILITY_TYPES as Record<string, CapabilityDefinition>)[id] ?? null;
}

/**
 * Whether a set of types satisfies a capability.
 *
 * The one function anything outside `data/` should ask, for the reason
 * `localeAdmits` is one function: two call sites spelling "either type is in
 * the list" differently is two rules where one was intended.
 */
export function typesSatisfy(capability: CapabilityId, types: readonly TypeName[]): boolean {
  const allowed = new Set(CAPABILITY_TYPES[capability].types);
  return types.some((type) => allowed.has(type));
}
