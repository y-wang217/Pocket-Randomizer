/**
 * The stat formula, as a pure function of base stat and level.
 *
 * This file exists because of one asymmetry in the protocol: **the sim tells
 * you your own stats and never tells you the opponent's.** The `|request|`
 * payload carries `side.pokemon[].stats` for your side only, which is correct
 * for a competitive client — an opponent's exact numbers depend on EVs, IVs and
 * nature, none of which are public, so a real client can only ever estimate.
 *
 * GYMRUN has no EVs, no IVs and no natures. Every Pokemon in the game sits on
 * one fixed spread — Serious, 31 IVs, 0 EVs, set in `toPokemonSet` — and that
 * is out of scope through Stage 5. So the number this file computes is not an
 * estimate the way a Showdown client's would be. It is **exact**, and the
 * opponent's Attack can be shown as a number rather than a range.
 *
 * ## Why it is duplicated rather than read off the engine
 *
 * The driver holds the sim's `Battle` and could read `pokemon.storedStats` for
 * either side. That would also be exact, and it would be less code. It is not
 * what happens, for two reasons:
 *
 *   - The stat panel has to render Pokemon that are **not in a battle** — the
 *     bench, and eventually a party screen. `describeSpecCard` already builds a
 *     throwaway `Battle` to answer that question for HP and PP, and that probe
 *     is not free. A formula is.
 *   - A pure function is testable against the engine. `test/stats.test.ts`
 *     cross-checks this file against `storedStats` for a sweep of species and
 *     levels, so the duplication cannot silently drift — if the gen-lock moves
 *     and the formula changes, the test fails rather than the panel quietly
 *     lying. Reading the engine directly would have nothing to check.
 *
 * The formula is transcribed from `Battle#statModify` in @pkmn/sim, with the
 * EV, IV and nature terms folded to their fixed GYMRUN values. Nothing here
 * imports the sim: this is `core/types.ts` vocabulary only, so `view.ts` can
 * use it without widening the adapter boundary.
 */
import type { StatName, StatsTable } from '../types';

/** Every Pokemon in GYMRUN gets 31 in every stat. See `toPokemonSet`. */
export const GYMRUN_IV = 31;

/** And 0 EVs. There is no EV system and there is not going to be one. */
export const GYMRUN_EV = 0;

/**
 * The stat-stage multiplier table, indexed by absolute stage.
 *
 * Positive stages multiply, negative stages divide — `[stage]` for +n and
 * `1 / [stage]` for -n. That asymmetry is the actual mechanic, not a
 * simplification of it: +1 is x1.5 and -1 is x(2/3), which is why a Growl is
 * worth less than a Swords Dance and why the panel shows the effective number
 * rather than asking the player to do it.
 */
export const BOOST_TABLE: readonly number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4];

/** Stages are clamped to this range by the engine, so the display clamps too. */
export const MAX_STAGE = 6;

/**
 * Max HP at a level.
 *
 * `maxHpOverride` carries `species.maxHP`, which exists for exactly one
 * Pokemon: Shedinja, whose max HP is 1 at every level regardless of its base
 * stat. The randomizer draws from the whole dex, so Shedinja *will* turn up,
 * and a panel that computed 130 for something the engine gave 1 HP would be
 * wrong in the single most visible way available.
 */
export function hpAtLevel(base: number, level: number, maxHpOverride?: number): number {
  if (maxHpOverride !== undefined) return maxHpOverride;
  return Math.trunc(((2 * base + GYMRUN_IV + Math.trunc(GYMRUN_EV / 4) + 100) * level) / 100 + 10);
}

/**
 * Any stat other than HP at a level.
 *
 * The nature term from `statModify` is absent because Serious has no plus or
 * minus stat, so both branches are identity. Spelling that out rather than
 * multiplying by 1 keeps the function honest about what it assumes.
 */
export function statAtLevel(base: number, level: number): number {
  return Math.trunc(((2 * base + GYMRUN_IV + Math.trunc(GYMRUN_EV / 4)) * level) / 100 + 5);
}

/** The whole spread at once, from a species' base stats. */
export function statsAtLevel(base: StatsTable, level: number, maxHpOverride?: number): StatsTable {
  return {
    hp: hpAtLevel(base.hp, level, maxHpOverride),
    atk: statAtLevel(base.atk, level),
    def: statAtLevel(base.def, level),
    spa: statAtLevel(base.spa, level),
    spd: statAtLevel(base.spd, level),
    spe: statAtLevel(base.spe, level),
  };
}

/**
 * Apply a stat stage, the way the engine does it.
 *
 * Transcribed from `Pokemon#getStat`: clamp to +-6, multiply by the table for a
 * raise, divide by it for a drop, and floor. The floor is on the *result*, and
 * the division case floors too — `Math.floor(stat / 1.5)`, not a rounded
 * reciprocal — which is why this is a transcription rather than a
 * reimplementation.
 */
export function applyStage(value: number, stage: number): number {
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  const multiplier = BOOST_TABLE[Math.abs(clamped)] ?? 1;
  return clamped >= 0 ? Math.floor(value * multiplier) : Math.floor(value / multiplier);
}

/**
 * The paralysis speed cut, as its own function.
 *
 * Gen 7 onwards halves Speed; the gen-lock in `format.ts` is the thing that
 * would change it, which is why the constant lives next to the formula it
 * belongs to rather than inline at the call site.
 *
 * Quick Feet cancels the cut (and grants x1.5 instead). That is an *ability*
 * modifier, so it is folded in by the caller under the visibility rule rather
 * than assumed here — see `view.ts`.
 */
export const PARALYSIS_SPEED_MULTIPLIER = 0.5;

export function applyParalysis(speed: number): number {
  return Math.floor(speed * PARALYSIS_SPEED_MULTIPLIER);
}

/** The six stats in Showdown's display order. HP first, Speed last. */
export const DISPLAY_STATS: readonly (keyof StatsTable)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** The five boostable stats, in the same order, minus HP. */
export const BOOSTABLE_STATS: readonly StatName[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Short labels for the panel. Showdown's spelling, because players read it elsewhere. */
export const STAT_LABELS: Record<keyof StatsTable, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};
