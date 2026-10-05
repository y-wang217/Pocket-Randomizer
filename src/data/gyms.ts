/**
 * The eight challenger slots.
 *
 * A slot is a segment and a number, nothing else. Stage 1 carried a hardcoded
 * roster and a type per gym and predicted neither would survive contact with
 * the randomizer. The roster went first; the type went at Stage 6.0 checkpoint
 * 6 ([`docs/spec/gymrun-stage6.0-checkpoint6-challengers.md`]): the boss of a
 * segment is a **challenger**, a rival, a protagonist, a gym leader or an
 * Elite Four member drawn per seed from the encounter library
 * (`data/encounters/`), with that game's roster fitted to the segment. The
 * challenger is agnostic of the training; the typed resource a run plans
 * around is the area's (`data/locales.ts`), not the boss's.
 *
 * That is why this file has no leaders, no types, no levels and no team sizes
 * in it. The challenger comes from the library; levels come from the curve;
 * team sizes come from `opponentTeamSize`, which from Stage 4.9 is the
 * player's own slot schedule: a challenger fields the roster the run has.
 *
 * The word "gym" stays on this table, on the node kind and on forty call
 * sites because renaming them is churn and the player never reads it: the
 * node reads `Challenger`, by `data/glyphLabels.ts`.
 */

export interface GymDefinition {
  id: string;
  /** Which segment this slot caps. */
  segment: number;
}

export const GYMS: readonly GymDefinition[] = [
  { id: 'gym-1', segment: 0 },
  { id: 'gym-2', segment: 1 },
  { id: 'gym-3', segment: 2 },
  { id: 'gym-4', segment: 3 },
  { id: 'gym-5', segment: 4 },
  { id: 'gym-6', segment: 5 },
  { id: 'gym-7', segment: 6 },
  { id: 'gym-8', segment: 7 },
];

/** The slot that caps a segment. Throws rather than wrapping: a missing slot is a bug. */
export function gymForSegment(segment: number): GymDefinition {
  const gym = GYMS.find((entry) => entry.segment === segment);
  if (!gym) throw new RangeError(`No gym defined for segment ${segment}`);
  return gym;
}
