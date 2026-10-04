/**
 * Which two classes knock at a door. **Defender Mode v0, step 2.**
 *
 * The two challengers at a door are always two different classes, drawn from
 * the classes eligible at the rank. Uniform, two draws, every door: the first
 * picks from the eligible list, the second from what is left. The caller keys
 * the stream to the door, so a door's classes are a function of the seed and
 * the door alone.
 */
import { classesAtRank, type TrainerClass } from '../../data/trainerClasses';
import type { RngStream } from '../rng';

export function drawDoorClasses(rank: number, stream: RngStream): [TrainerClass, TrainerClass] {
  const eligible = classesAtRank(rank);
  if (eligible.length < 2) {
    throw new RangeError(`Rank ${rank} has ${eligible.length} trainer classes; a door needs two different ones`);
  }
  const first = stream.pick(eligible);
  const second = stream.pick(eligible.filter((entry) => entry.id !== first.id));
  return [first, second];
}
