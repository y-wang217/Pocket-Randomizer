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
import type { ActiveMove, Battle, Format, Pokemon as SimPokemon } from '@pkmn/sim';

import type { BattleBadge } from '../types';

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

// ---------------------------------------------------------------------------
// Defender Mode v0: the badges, as format-level handlers
// ---------------------------------------------------------------------------

/**
 * Install a defender battle's badge on a battle whose p1 team is set and whose
 * p2 is not, so nothing has switched in yet. **Defender Mode v0, step 4.**
 *
 * The mechanism is `Battle#onEvent(eventid, format, callback)`: a handler on
 * the battle itself, keyed to the format, run inside every `runEvent` of that
 * name. Each handler checks a flag this function writes on the eligible p1
 * Pokemon's `m`, the sim's free per-Pokemon bag, so it acts on one side and on
 * gym-type members only. Called only when a badge exists; an attacker battle
 * never reaches this function and registers nothing.
 *
 * Here rather than in `driver.ts` because it is the format's half of the
 * adapter: the two files are the only ones allowed to import `@pkmn/sim`.
 */
export function installDefenderBadge(
  battle: Battle,
  badge: BattleBadge,
  numbers: { fireCritStages: readonly number[]; flyingSpeed: number; fifthMovePp: number },
): void {
  const side = battle.sides[0];
  if (!side) throw new Error('Install a badge after p1 is set');

  for (const [index, member] of badge.members.entries()) {
    const mon = side.pokemon[index];
    if (!mon || !member) continue;
    mon.m.gymrunBadge = true;
    // The modifier as the sim's `chainModify` will hold it, read by the views
    // so the AI's Speed read and the engine's agree to the point.
    if (badge.gymType === 'Flying') mon.m.gymrunSpeed = Math.trunc(numbers.flyingSpeed * 4096);
    mon.m.gymrunHighlight = member.highlight;
    mon.m.gymrunStreak = 0;
    if (member.fifthMove) {
      // The fifth slot is the last one; its PP is the badge's, not the move's,
      // and a fresh battle is a fresh slot, which is "resets every battle".
      const slot = mon.moveSlots.length - 1;
      mon.m.gymrunFifthSlot = slot;
      for (const slots of [mon.moveSlots, mon.baseMoveSlots]) {
        const entry = slots[slot];
        if (entry) {
          entry.pp = numbers.fifthMovePp;
          entry.maxpp = numbers.fifthMovePp;
        }
      }
    }
  }

  const eligible = (pokemon: SimPokemon | null | undefined): pokemon is SimPokemon =>
    !!pokemon && pokemon.side === side && pokemon.m.gymrunBadge === true;

  if (badge.gymType === 'Fire') {
    const stages = numbers.fireCritStages;
    battle.onEvent('ModifyCritRatio', battle.format, function (this: Battle, critRatio: number, source: SimPokemon, _target: SimPokemon, move: ActiveMove) {
      if (!eligible(source) || !source.m.gymrunHighlight || move.id !== source.m.gymrunHighlight) return undefined;
      const streak = source.m.gymrunStreak as number;
      const stage = stages[Math.min(streak, stages.length - 1)] ?? 0;
      // On the protocol as a debug line, which Custom Game prints, so a test
      // can assert the stage a use carried rather than infer it from crits.
      this.debug(`gymrun-fire-streak ${source.fullname} use ${streak + 1} stage +${stage}`);
      return critRatio + stage;
    });
    battle.onEvent('AfterMove', battle.format, (source: SimPokemon, _target: SimPokemon, move: ActiveMove) => {
      if (!eligible(source)) return;
      source.m.gymrunStreak = source.m.gymrunHighlight && move.id === source.m.gymrunHighlight ? (source.m.gymrunStreak as number) + 1 : 0;
    });
    // The streak belongs to a stint on the field: switching out ends it, and
    // so does a faint. Reset on the way back in covers a drag-out too.
    const reset = (pokemon: SimPokemon): void => {
      if (eligible(pokemon)) pokemon.m.gymrunStreak = 0;
    };
    battle.onEvent('SwitchIn', battle.format, reset);
    battle.onEvent('SwitchOut', battle.format, reset);
    battle.onEvent('Faint', battle.format, reset);
  }

  if (badge.gymType === 'Flying') {
    battle.onEvent('ModifySpe', battle.format, function (this: Battle, _spe: number, pokemon: SimPokemon) {
      if (!eligible(pokemon)) return undefined;
      return this.chainModify(numbers.flyingSpeed);
    });
  }
}

/**
 * The crit stage the highlighted move's next use would add, or null when
 * `pokemon` carries no Fire highlight. Read for the move button.
 */
export function fireNextStage(pokemon: SimPokemon, stages: readonly number[]): { highlight: string; stage: number } | null {
  if (pokemon.m.gymrunBadge !== true || !pokemon.m.gymrunHighlight) return null;
  const streak = pokemon.m.gymrunStreak as number;
  return { highlight: pokemon.m.gymrunHighlight as string, stage: stages[Math.min(streak, stages.length - 1)] ?? 0 };
}

/** The Flying badge's fifth slot on `pokemon`, zero-based, or null. */
export function fifthSlotOf(pokemon: SimPokemon): number | null {
  return typeof pokemon.m.gymrunFifthSlot === 'number' ? pokemon.m.gymrunFifthSlot : null;
}

/** Whether `pokemon` carries the badge: a p1 gym-type member of a defender battle. */
export function carriesBadge(pokemon: SimPokemon): boolean {
  return pokemon.m.gymrunBadge === true;
}

/**
 * Gen 9's crit chance at each clamped crit ratio, 0 to 4: the table inside
 * `BattleActions#getDamage`, restated so a readout can name a chance without
 * running a hit. A ratio of 1 is every move's default.
 */
const GEN9_CRIT_CHANCE: readonly number[] = [0, 1 / 24, 1 / 8, 1 / 2, 1];

/** The chance a move with `critRatio` crits after `stage` more stages. */
export function critChanceAt(critRatio: number, stage: number): number {
  const ratio = Math.max(0, Math.min(GEN9_CRIT_CHANCE.length - 1, critRatio + stage));
  return GEN9_CRIT_CHANCE[ratio] ?? 0;
}

/** The Flying badge's Speed numerator on `pokemon`, or null. */
export function speedModifierOf(pokemon: SimPokemon): number | null {
  return typeof pokemon.m.gymrunSpeed === 'number' ? pokemon.m.gymrunSpeed : null;
}
