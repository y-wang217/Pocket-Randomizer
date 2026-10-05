/**
 * Trainer classes: who is knocking at a defender's door. **Defender Mode v0.**
 *
 * A class is an id, a type set, the ranks it appears at and a sprite key. Its
 * player-facing name is in `data/trainerClassCopy.ts`, outside the content
 * hash, by the 2026-09-22 ruling that no copy a player reads is inside it. Its
 * type set narrows the species its team may draw the way a gym's type narrows
 * a gym's, except that a class is a *set*: a species qualifies on carrying any
 * one of the class's types in either slot. An empty set is an untyped class,
 * which draws from the rank's whole pool.
 *
 * The prompt's three bands: single-type weak classes early, themed classes in
 * the middle, untyped Ace Trainers and Veterans at the end. The two
 * challengers at a door are always two different classes, so every rank band
 * here holds at least two.
 *
 * **Order is a draw order.** `core/defender/classes.ts` picks an index into the
 * classes eligible at a rank, filtered from this list in this order, so
 * re-sorting it reshuffles every recorded defender seed.
 *
 * `sprite` is a Showdown trainer sprite id, read only by `ui/`. No new art: the
 * mode ships on placeholders, and a class with no sprite on screen still has
 * its name.
 */
import type { TypeName } from '../core/types';

export interface TrainerClass {
  id: string;
  /** Empty for an untyped class. */
  types: readonly TypeName[];
  /** Inclusive, zero-based ranks this class may appear at. */
  ranks: { min: number; max: number };
  sprite: string;
}

export const TRAINER_CLASSES: readonly TrainerClass[] = [
  { id: 'bugcatcher', types: ['Bug'], ranks: { min: 0, max: 2 }, sprite: 'bugcatcher' },
  { id: 'youngster', types: ['Normal'], ranks: { min: 0, max: 2 }, sprite: 'youngster' },
  { id: 'lass', types: ['Grass'], ranks: { min: 0, max: 2 }, sprite: 'lass' },
  { id: 'hiker', types: ['Rock', 'Ground'], ranks: { min: 3, max: 5 }, sprite: 'hiker' },
  { id: 'swimmer', types: ['Water'], ranks: { min: 3, max: 5 }, sprite: 'swimmer' },
  { id: 'blackbelt', types: ['Fighting'], ranks: { min: 3, max: 5 }, sprite: 'blackbelt' },
  { id: 'birdkeeper', types: ['Flying'], ranks: { min: 3, max: 5 }, sprite: 'birdkeeper' },
  { id: 'acetrainer', types: [], ranks: { min: 6, max: 7 }, sprite: 'acetrainer' },
  { id: 'veteran', types: [], ranks: { min: 6, max: 7 }, sprite: 'veteran' },
];

/** The classes that may appear at `rank`, in table order. */
export function classesAtRank(rank: number): readonly TrainerClass[] {
  return TRAINER_CLASSES.filter((entry) => entry.ranks.min <= rank && rank <= entry.ranks.max);
}

/** A class by id, or null. */
export function trainerClass(id: string): TrainerClass | null {
  return TRAINER_CLASSES.find((entry) => entry.id === id) ?? null;
}
