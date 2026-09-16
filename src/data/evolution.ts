/**
 * What a species evolves into, and whether it may exist at a level.
 *
 * A derived read over `speciesPools.ts`, beside it rather than inside it for
 * the reason `speciesTypes.ts` gives: the pool file is generated and a helper
 * appended to it is deleted on the next `npm run gen:pools`.
 *
 * The generated table carries the evolution graph **child-side**: each entry
 * names its `prevo` and the `evoLevel` at which it becomes a legal stage. This
 * file inverts that once, in dex order, so that "what does X become" is a
 * lookup whose result order is stable — and that order is what the run log's
 * `evolve` decision indexes into, so it must never depend on anything but the
 * table.
 *
 * Blacklisted species are removed from the targets here rather than in the
 * generator, the same rule `core/randomizer.ts` follows for the draw: the
 * generated pool stays a faithful record of the dex, and un-banning is a
 * one-line revert. Shedinja is the case that matters — with it out, Nincada
 * has one target and asks no question.
 *
 * No RNG and no sim. `core/evolution.ts` and `core/randomizer.ts` both read
 * this; `test/boundaries.test.ts` keeps both free of `@pkmn/sim`.
 */
import { isSpeciesBlacklisted } from './blacklists';
import { SPECIES_POOL, type SpeciesEntry } from './speciesPools';

const ENTRY_BY_ID = new Map<string, SpeciesEntry>(SPECIES_POOL.map((entry) => [entry.id, entry]));
const ENTRY_BY_SPECIES = new Map<string, SpeciesEntry>(SPECIES_POOL.map((entry) => [entry.species, entry]));

/** Every in-pool, non-blacklisted child of each parent id, in dex order. */
const TARGETS_BY_PREVO: ReadonlyMap<string, readonly SpeciesEntry[]> = (() => {
  const map = new Map<string, SpeciesEntry[]>();
  for (const entry of SPECIES_POOL) {
    if (entry.prevo === null || isSpeciesBlacklisted(entry.id)) continue;
    const list = map.get(entry.prevo) ?? [];
    list.push(entry);
    map.set(entry.prevo, list);
  }
  return map;
})();

/** The pool entry for a species name as a `PokemonSpec` carries it, or null. */
export function entryOfSpecies(species: string): SpeciesEntry | null {
  return ENTRY_BY_SPECIES.get(species) ?? null;
}

/** The pool entry for a dex id, or null. */
export function entryOfId(id: string): SpeciesEntry | null {
  return ENTRY_BY_ID.get(id) ?? null;
}

/**
 * What `id` can evolve into, in dex order. Empty for a final form, for a base
 * form nothing in the pool descends from, and for an unknown id.
 */
export function targetsOf(id: string): readonly SpeciesEntry[] {
  return TARGETS_BY_PREVO.get(id) ?? [];
}

/** Whether `entry` has at least one target in the pool. */
export function hasEvolution(entry: SpeciesEntry): boolean {
  return targetsOf(entry.id).length > 0;
}

/**
 * Whether `entry` may exist at `level`: a base form always, an evolved form
 * once the level has reached its threshold.
 *
 * This is the stage gate. The randomizer asks it of every species it draws,
 * against the *lowest* level the encounter can roll, so no opponent is ever a
 * stage its own level could not have reached; and `core/evolution.ts` is the
 * other half, moving a party member up a stage the first time its level
 * qualifies.
 */
export function stageAllowedAt(entry: SpeciesEntry, level: number): boolean {
  return entry.evoLevel === null || entry.evoLevel <= level;
}

/**
 * Whether `entry` is a base form: nothing in the dex evolves into it.
 *
 * Distinct from "has no in-pool parent": a species whose parent was dropped
 * from the pool (a regional forme) still carries its `evoLevel` and is not a
 * base form. A starter must be one of these.
 */
export function isBaseForm(entry: SpeciesEntry): boolean {
  return entry.evoLevel === null;
}
