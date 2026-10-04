/**
 * The defender opening as state transitions. **Defender Mode v0, step 2.**
 *
 * The gym type, then the draft. Both are pure selections over what
 * `generateDefenderDraft` drew for all three types at generation, so neither
 * transition draws and the run log holds only indices.
 */
import { DEFENDER_DRAFT, DEFENDER_GYM_TYPES, type DefenderGymType } from '../../data/defender';
import { createParty } from '../party';
import type { Rng } from '../rng';
import type { RunState } from '../run';
import type { PokemonSpec } from '../types';
import { generateDefenderDraft, type DefenderDraft } from './draft';

/**
 * The defender half of `RunState`.
 *
 * `draft` is what the seed produced and never changes; `gymType` and
 * `draftPicks` are what the player did about it. The same split as
 * `segments` against `localeChoices`, for the same reason: a replay needs the
 * unpicked options in place to resolve the same index to the same mon.
 */
export interface DefenderRunState {
  draft: DefenderDraft;
  gymType: DefenderGymType | null;
  /** One option index per pick answered, in pick order. */
  draftPicks: number[];
}

export function createDefenderState(rng: Rng): DefenderRunState {
  return { draft: generateDefenderDraft(rng), gymType: null, draftPicks: [] };
}

/** The gym types offered, in offer order. */
export function gymTypeOptions(): readonly string[] {
  return DEFENDER_GYM_TYPES;
}

function defenderOf(state: RunState): DefenderRunState {
  if (!state.defender) throw new Error('Not a defender run');
  return state.defender;
}

export function chooseGymType(state: RunState, index: number): RunState {
  const defender = defenderOf(state);
  if (defender.gymType !== null) throw new Error(`The gym type is already ${defender.gymType}`);
  const gymType = DEFENDER_GYM_TYPES[index];
  if (!gymType) throw new RangeError(`Gym type ${index} out of range (${DEFENDER_GYM_TYPES.length} offered)`);
  return { ...state, defender: { ...defender, gymType } };
}

/**
 * The mons the next draft pick offers, or none once the draft is done or
 * before a gym type is chosen.
 */
export function draftOptions(state: RunState): readonly PokemonSpec[] {
  const defender = state.defender;
  if (!defender || defender.gymType === null) return [];
  if (defender.draftPicks.length >= DEFENDER_DRAFT.picks) return [];
  return defender.draft[defender.gymType][defender.draftPicks.length] ?? [];
}

/** Take one drafted mon into the party. The draft order is the party order. */
export function chooseDraftPick(state: RunState, index: number): RunState {
  const defender = defenderOf(state);
  const offered = draftOptions(state);
  if (offered.length === 0) throw new Error('No draft pick is open');
  const spec = offered[index];
  if (!spec) throw new RangeError(`Draft pick ${index} out of range (${offered.length} offered)`);
  return {
    ...state,
    party: [...state.party, ...createParty([spec])],
    defender: { ...defender, draftPicks: [...defender.draftPicks, index] },
  };
}

export function defenderOpeningComplete(defender: DefenderRunState): boolean {
  return defender.gymType !== null && defender.draftPicks.length >= DEFENDER_DRAFT.picks;
}
