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

/*
 * ---------------------------------------------------------------------------
 * The Stage 4.5.1 gender audit: four candidates, none of them admissible.
 * ---------------------------------------------------------------------------
 *
 * Gender became a real, stable, displayed property in Stage 4.5.1, which made
 * it worth asking what in the pools depends on it. Recorded here so the next
 * person does not repeat the search and so that "we looked" is distinguishable
 * from "nobody looked".
 *
 * **No gender-dependent move is drawable at all.** Attract and Captivate are
 * both absent from `data/movePools.ts` — `scripts/gen-pools.ts` had already
 * excluded them on structural grounds. So the obvious worry, a move that does
 * nothing against the 4.6% of the species pool that is genderless, does not
 * arise: the move cannot be rolled.
 *
 * Four abilities in `data/abilities.ts` touch gender, and each was checked
 * against the pools rather than against memory of a normal Pokemon game:
 *
 *   - **Rivalry** — 1.25x into the same gender, 0.75x into the opposite. Read
 *     off the engine rather than assumed: `if (attacker.gender &&
 *     defender.gender)` means a genderless Pokemon on *either* side makes it a
 *     no-op, not a penalty. A legible ±25% swing, and more legible now than
 *     before, because both genders are on screen and neither re-rolls.
 *   - **Cute Charm** — 30% infatuation on contact, opposite gender only. The
 *     one entry whose *whole* effect is gender-gated. It still fires against
 *     roughly half of what a run meets, which is a variance ability rather than
 *     a dead one.
 *   - **Oblivious** — immunity to infatuation, Taunt and Intimidate. The
 *     infatuation clause is nearly unreachable now that Attract is not
 *     drawable, but Taunt is in the move pool and Intimidate is in this one, so
 *     two thirds of the ability is live.
 *   - **Aroma Veil** — blocks Attract, Disable, Encore, Heal Block, Taunt,
 *     Torment. Attract is unreachable and Heal Block and Torment are not in the
 *     pool, but Disable, Encore and Taunt all are.
 *
 * None of them meets this file's bar. None is *mechanical* — every one can be
 * played by the engine and none makes an encounter something other than a
 * fight — and none is *measured*, because no simulator report has shown any of
 * them touching an outcome distribution. Under-application is the cheap
 * mistake to fix here and over-application is not, so the list stays empty.
 *
 * What would change it is a report, not a bad run: Cute Charm is the one to
 * watch, because a 30% full-stop on contact is the closest thing in the pool to
 * a coin flip that decides a fight.
 */

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
