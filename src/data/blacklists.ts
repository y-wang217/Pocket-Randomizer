/**
 * Things the randomizer may not roll.
 *
 * **This file starts near-empty on purpose, and every entry has to be earned.**
 * A blacklist is the cheapest possible way to fix a balance problem and the
 * easiest one to over-apply: ban the ability that killed you, ban the species
 * that felt unfair, and three passes later the randomizer draws from a curated
 * list again and every seed feels the same. The Stage 2 done condition is that
 * each seed feels *different*, so the bar for adding a line here is evidence
 * from `npm run sim`, not a memory of a bad run.
 *
 * Each entry therefore carries the reason it exists. Two reasons are
 * admissible:
 *
 *   1. **Mechanical.** The entry makes an encounter something other than a
 *      fight — it cannot lose, cannot win, or cannot be played by the engine
 *      as it stands.
 *   2. **Measured.** The simulator's report showed it dominating an outcome
 *      distribution, and the number is quoted.
 *
 * "It feels strong" is not a reason. The bands in data/scaling.ts are the lever
 * for strength; this file is for things that are not on that axis at all.
 *
 * Ids are dex ids (lower case, no punctuation), matching `SpeciesEntry.id` and
 * `MoveEntry.id`. Abilities are matched on their id too, so the spelling of the
 * display name does not matter.
 */

/**
 * Species the randomizer may not roll.
 *
 * `shedinja` — mechanical. One max HP, always. HP attrition across a segment is
 * the resource the whole run is about, and a Pokemon that has none of it is not
 * a hard encounter or an easy one, it is a coin flip resolved by whether
 * anything connects. It is also the one species whose difficulty is completely
 * unmoved by every lever in data/scaling.ts.
 */
export const BLACKLISTED_SPECIES: readonly string[] = ['shedinja'];

/**
 * Abilities the randomizer may not roll.
 *
 * Empty at the first report by design — see the header. The full ability pool
 * on any species is the loudest thing about a randomizer, and pre-emptively
 * trimming it would be trimming the feature.
 */
export const BLACKLISTED_ABILITIES: readonly string[] = [];

/**
 * Moves the randomizer may not roll.
 *
 * Empty, and likely to stay smaller than the others: scripts/gen-pools.ts
 * already excludes the moves the *engine* or the *damage calc* cannot handle
 * honestly, and those exclusions are structural rather than balance calls.
 * What would land here is a move that survives those filters and still ruins a
 * distribution.
 */
export const BLACKLISTED_MOVES: readonly string[] = [];

const speciesBans = new Set(BLACKLISTED_SPECIES);
const abilityBans = new Set(BLACKLISTED_ABILITIES);
const moveBans = new Set(BLACKLISTED_MOVES);

/** Dex-style id: lower case, letters and digits only. */
export function toId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function isSpeciesBlacklisted(id: string): boolean {
  return speciesBans.has(toId(id));
}

export function isAbilityBlacklisted(name: string): boolean {
  return abilityBans.has(toId(name));
}

export function isMoveBlacklisted(id: string): boolean {
  return moveBans.has(toId(id));
}
