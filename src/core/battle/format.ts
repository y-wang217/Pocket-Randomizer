/**
 * Format and clause configuration, isolated to one file on purpose.
 *
 * The build spec calls for gen-locking to Gen 3 at a later stage. That has to
 * be a config change here and nowhere else, so this module owns the generation
 * number, the format id, and the clause list, and driver.ts asks it rather than
 * hardcoding anything.
 *
 * Custom Game is the right base: it is the only ladder-less format with no
 * banlist and no species/move legality, which is exactly what a randomizer
 * needs. We then strip the clauses it does carry.
 */
import { Dex } from '@pkmn/sim';
import type { Format } from '@pkmn/sim';

/**
 * The generation the whole game runs in.
 *
 * Changing this to 3 (plus GYMRUN_FORMAT below) is the entire gen-lock.
 */
export const GYMRUN_GEN = 9 as const;

/** The Custom Game format for the configured generation. */
export const GYMRUN_FORMAT = `gen${GYMRUN_GEN}customgame` as const;

/**
 * Clauses removed from the base format.
 *
 * `Team Preview` goes because a roguelike run should not reveal the enemy team
 * before the fight, and in Stage 0 with one Pokemon a side it would be a purely
 * ceremonial extra request. Custom Game carries no Sleep/Species/Evasion
 * clauses to begin with, which is why this list is short — it is not an
 * oversight.
 */
export const STRIPPED_CLAUSES: readonly string[] = ['Team Preview'];

/** Battles longer than this are called on the turn limit rather than hanging. */
export const TURN_LIMIT = 200;

/**
 * The format id string including custom rules, in Showdown's `base@@@rules`
 * syntax. Exported so it can be asserted in tests and shown in engine notes.
 */
export function formatIdWithRules(): string {
  if (STRIPPED_CLAUSES.length === 0) return GYMRUN_FORMAT;
  return `${GYMRUN_FORMAT}@@@${STRIPPED_CLAUSES.map((c) => `!${c}`).join(',')}`;
}

let cached: Format | null = null;

/** The resolved sim Format object. Built once; the dex lookup is not cheap. */
export function gymrunFormat(): Format {
  if (!cached) cached = Dex.formats.get(formatIdWithRules());
  return cached;
}
