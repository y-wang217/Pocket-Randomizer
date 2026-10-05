/**
 * The recruit draft. **Defender Mode v0, step 5.**
 *
 * When a boss's win unlocks a party slot, the player picks one of three mons
 * carrying the gym type, at the new rank's level. Trades cannot grow a party,
 * so this is the only way one grows. Drawn at generation for every rank whose
 * boss unlocks a slot, for all three gym types, plus one off-type candidate
 * per type that replaces the third option only while a Stranger's Pass slot is
 * free (`recruitOptions`). Every draw happens whatever the run does.
 */
import { DEFENDER_GYM_TYPES, DEFENDER_RANKS, DEFENDER_SLOT_SCHEDULE_OFFSET, DEFENDER_DRAFT, type DefenderGymType } from '../../data/defender';
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
import { exemptSlots } from './exempt';
import type { DefenderRecruits, RecruitOffer } from './opening';
import { offTypeCount, typeLockRefusal } from './typeLock';

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
      const typed = generateTypedMons(type, segment, level, damaging, DEFENDER_DRAFT.options, stream, seen).map((spec, i) =>
        finishDefenderMon(spec, `recruit/${rank}/${type}/${i}`, rng),
      );
      const [off] = generateOffTypeMons(type, segment, level, damaging, 1, stream, seen);
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
  const exemptFree = offTypeCount(state.party.map((member) => member.spec), gymType) < exemptSlots(state);
  return exemptFree ? [...offer.typed.slice(0, -1), offer.offType] : offer.typed;
}

/** Add the picked recruit to the party, under the type lock, with the next acquisition index. */
export function chooseRecruit(state: RunState, options: readonly PokemonSpec[], index: number): RunState {
  const defender = state.defender;
  if (!defender?.gymType) throw new Error('A recruit needs a defender run with a gym type');
  const spec = options[index];
  if (!spec) throw new RangeError(`Recruit pick ${index} out of range (${options.length} offered)`);
  const refusal = typeLockRefusal(state.party.map((member) => member.spec), spec, defender.gymType, exemptSlots(state));
  if (refusal) throw new RangeError(`Recruit refused: ${refusal}`);
  const member: PokemonState = {
    ...createPartyMember(joiningSpec(spec, state.currentSegment), state.currentSegment),
    acquired: defender.acquisitions,
  };
  return { ...state, party: [...state.party, member], defender: { ...defender, acquisitions: defender.acquisitions + 1 } };
}
