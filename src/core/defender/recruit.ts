/**
 * The recruit draft. **Defender Mode v0, step 5.**
 *
 * When a boss's win unlocks a party slot, the player picks one of three mons
 * at the new rank's level: two carrying the gym type and one that does not
 * (`DEFENDER_RECRUIT`). Trades cannot grow a party, so this is the only way
 * one grows. Drawn at generation for every rank whose boss unlocks a slot, for
 * all three gym types. Every draw happens whatever the run does.
 *
 * **2026-10-06.** The off-type option used to replace the third typed one only
 * while a Stranger's Pass slot was free, and a pick outside the exemption was
 * refused. Both are gone: the option is always there and always admissible,
 * and what it costs is the badge (`badge.ts`, `badgesActive`).
 */
import { DEFENDER_GYM_TYPES, DEFENDER_RANKS, DEFENDER_RECRUIT, DEFENDER_SLOT_SCHEDULE_OFFSET, type DefenderGymType } from '../../data/defender';
import { partyCapacityAfter } from '../../data/partyTuning';
import { playerLevel } from '../../data/scaling';
import { joiningSpec } from '../acquisition';
import { createPartyMember } from '../party';
import { bandedMovePool, generateOffTypeMons, generateTypedMons } from '../randomizer';
import type { Rng } from '../rng';
import type { RunState } from '../run';
import { defenderRecruitKey } from '../streamKeys';
import type { PokemonSpec, PokemonState } from '../types';
import { finishDefenderMon } from './draft';
import type { DefenderRecruits, RecruitOffer } from './opening';

/** Whether beating rank `rank`'s boss unlocks a slot, on the schedule read one row ahead. */
export function bossUnlocksSlot(rank: number): boolean {
  const before = partyCapacityAfter(rank + DEFENDER_SLOT_SCHEDULE_OFFSET);
  const after = partyCapacityAfter(rank + 1 + DEFENDER_SLOT_SCHEDULE_OFFSET);
  return after > before && rank + 1 < DEFENDER_RANKS;
}

/** Every rank's recruit draft, all three types, drawn now. */
export function generateRecruits(rng: Rng): (DefenderRecruits | null)[] {
  return Array.from({ length: DEFENDER_RANKS }, (_, rank) => {
    if (!bossUnlocksSlot(rank)) return null;
    // The draft joins at the next rank's level, from the next rank's bands.
    const segment = rank + 1;
    const level = playerLevel(segment);
    const damaging = bandedMovePool(segment, 'normal');
    const byType = {} as Record<DefenderGymType, RecruitOffer>;
    for (const type of DEFENDER_GYM_TYPES) {
      const stream = rng.randomizer.at(defenderRecruitKey(rank, type));
      const seen = new Set<string>();
      const typed = generateTypedMons(type, segment, level, damaging, DEFENDER_RECRUIT.typed, stream, seen).map((spec, i) =>
        finishDefenderMon(spec, `recruit/${rank}/${type}/${i}`, rng),
      );
      const [off] = generateOffTypeMons(type, segment, level, damaging, DEFENDER_RECRUIT.offType, stream, seen);
      if (!off) throw new Error(`No off-type recruit for ${type} at rank ${rank}`);
      byType[type] = { typed, offType: finishDefenderMon(off, `recruit/${rank}/${type}/off`, rng) };
    }
    return byType;
  });
}

/** The recruit draft open after the boss just beaten, or none. */
export function recruitOptions(state: RunState, bossesBeaten: number): readonly PokemonSpec[] {
  const defender = state.defender;
  const gymType = defender?.gymType;
  if (!defender || !gymType) return [];
  const offer = defender.recruits[bossesBeaten - 1]?.[gymType];
  if (!offer) return [];
  // The typed options first, the off-type one last: a fixed order, so the
  // logged index means the same mon on every replay.
  return [...offer.typed, offer.offType];
}

/** Add the picked recruit to the party with the next acquisition index. */
export function chooseRecruit(state: RunState, options: readonly PokemonSpec[], index: number): RunState {
  const defender = state.defender;
  if (!defender?.gymType) throw new Error('A recruit needs a defender run with a gym type');
  const spec = options[index];
  if (!spec) throw new RangeError(`Recruit pick ${index} out of range (${options.length} offered)`);
  const member: PokemonState = {
    ...createPartyMember(joiningSpec(spec, state.currentSegment), state.currentSegment),
    acquired: defender.acquisitions,
  };
  return { ...state, party: [...state.party, member], defender: { ...defender, acquisitions: defender.acquisitions + 1 } };
}
