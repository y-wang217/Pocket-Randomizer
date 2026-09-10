/**
 * What a stat block is built to do, in one word.
 *
 * Stage 4.7, Part 7. `data/archetypes.ts` holds the labels, the thresholds and
 * every word that reaches a screen; this file is the arithmetic between them.
 *
 * ## Derived from base stats only, never from the moveset
 *
 * Three reasons, and the third is the one that decides it.
 *
 * **It is stable.** A member's label does not change when it takes a move
 * reward, so the shorthand stays learnable across a run. A moveset-derived
 * label would relabel a Pokemon the player already knows, mid-run, as a side
 * effect of a decision about something else.
 *
 * **It works on the opponent**, which is half the point. The player can read an
 * opposing stat block from Stage 4.5's panels; what they cannot do is add it up
 * at a glance mid-turn.
 *
 * **A moveset-derived label would leak the opponent's moveset**, which the
 * player is not shown. `BattleView.foe` is deliberately restricted to what a
 * player could know, and a chip reading "special attacker" computed from four
 * hidden moves would be that restriction defeated by a display feature. A stat
 * label says what the Pokemon is *built* to do; working out what it is actually
 * holding is the read, and the read is the game.
 *
 * The cost of that is real and is stated wherever the label is explained: see
 * `ARCHETYPE_CAVEAT`. Under full randomization a `pAttacker` can roll four
 * special moves.
 *
 * ## Part 4
 *
 * The label is a classification of public data. Nothing here or downstream of
 * it may extend it into "counters your lead", order a list by it, or mark an
 * opponent's label as favourable.
 */
import { ARCHETYPE_TUNING, type Archetype, type ArchetypeTuning } from '../data/archetypes';
import type { StatsTable } from './types';

/**
 * Classify a base stat spread. Pure: no RNG, no DOM, no dex.
 *
 * Takes a `StatsTable` rather than a species name so that it cannot reach for
 * anything else — a function handed a name could grow a learnset lookup, and
 * the whole argument above is that it must not.
 *
 * Two independent axes, both cut in `data/archetypes.ts`:
 *
 *   1. **Offence or bulk.** `max(atk, spa)` against `mean(hp, def, spd)`,
 *      compared as a ratio. A max of two against a mean of three is not a like
 *      comparison, which is exactly why the cut is a tunable ratio rather than
 *      a bare `>`.
 *   2. **Which side of the split.** For an attacker, Attack against Special
 *      Attack; for a tank, Defence against Special Defence. Close enough is
 *      `mixed`, and "close enough" is a ratio so that it means the same thing
 *      at base 60 as at base 160.
 *
 * Speed is not read. See `Archetype` for the seventh label that is deliberately
 * not being added.
 */
export function archetypeOf(baseStats: StatsTable, tuning: ArchetypeTuning = ARCHETYPE_TUNING): Archetype {
  const offence = Math.max(baseStats.atk, baseStats.spa);
  const bulk = (baseStats.hp + baseStats.def + baseStats.spd) / 3;

  /*
   * A bulk of zero cannot happen in the dex and is guarded anyway, because the
   * alternative is `Infinity` propagating into a comparison and the label
   * silently becoming "attacker" for a malformed spread. Shedinja is the
   * closest real case at 1 HP, and it classifies fine.
   */
  const ratio = bulk === 0 ? Infinity : offence / bulk;
  const attacker = ratio === tuning.attackerRatio
    ? tuning.offenceTie === 'attacker'
    : ratio > tuning.attackerRatio;

  const [physical, special] = attacker
    ? [baseStats.atk, baseStats.spa]
    : [baseStats.def, baseStats.spd];

  const split = splitOf(physical, special, tuning);
  if (attacker) return split === 'mixed' ? 'mixAttacker' : split === 'physical' ? 'pAttacker' : 'sAttacker';
  return split === 'mixed' ? 'mixTank' : split === 'physical' ? 'pTank' : 'sTank';
}

/** Which side of a two-stat split wins, or neither. */
function splitOf(
  physical: number,
  special: number,
  tuning: ArchetypeTuning,
): 'physical' | 'special' | 'mixed' {
  const high = Math.max(physical, special);
  const low = Math.min(physical, special);
  // Two zeroes are maximally close rather than a division by zero.
  const closeness = high === 0 ? 1 : low / high;

  if (closeness > tuning.mixedRatio) return 'mixed';
  if (closeness === tuning.mixedRatio) return tuning.splitTie === 'mixed' ? 'mixed' : 'physical';
  return physical > special ? 'physical' : 'special';
}
