/**
 * The badge a defender battle runs under. **Defender Mode v0, step 4.**
 *
 * Built here, in `core/`, from the battle team and the gym type, and executed
 * by the adapter (`battle/format.ts`). A member gets the badge exactly when its
 * species carries the gym type (`typeLock.carriesGymType`), so the off-type
 * slot gets nothing; eligibility is read off the species, never a battle's
 * live types, so Burn Up or Soak cannot switch it off mid-fight (ruling R7).
 * Whether the badge is installed at all is `badgesActive`, below.
 */
import { DEFENDER_BADGE, DEFENDER_OFF_TYPE_RELIC } from '../../data/defender';
import { entryOfSpecies, hasEvolution } from '../../data/evolution';
import { toId } from '../../data/blacklists';
import type { BadgeMember, BattleBadge, PokemonSpec, PokemonState, TeamSpec } from '../types';
import type { DefenderRunState } from './opening';
import { carriesGymType, offTypeCount } from './typeLock';

/** What `badgesActive` reads: the party, the held relics and the gym type. */
export type BadgeState = {
  party: readonly Pick<PokemonState, 'spec'>[];
  relics: readonly string[];
  defender?: Pick<DefenderRunState, 'gymType'> | null;
};

/**
 * Whether the badge is lit for this run. **2026-10-06.** A defender run's
 * badge is on while every party member carries the gym type, or while the
 * Stranger's Pass is held; an off-type member without the Pass puts it out for
 * the whole team, typed members included. The one reading `playNode` and the
 * screens share, so a card cannot draw a lit flame the battle would not
 * honour. Read off species and the held list, never a battle's live types.
 */
export function badgesActive(state: BadgeState): boolean {
  const gymType = state.defender?.gymType;
  if (!gymType) return false;
  if (state.relics.includes(DEFENDER_OFF_TYPE_RELIC)) return true;
  return offTypeCount(state.party.map((member) => member.spec), gymType) === 0;
}

/** Peck while the species can still evolve, Pluck at its final stage. */
export function fifthMoveFor(spec: Pick<PokemonSpec, 'species'>): string {
  const entry = entryOfSpecies(spec.species);
  return entry && hasEvolution(entry) ? DEFENDER_BADGE.fifthMove.canEvolve : DEFENDER_BADGE.fifthMove.finalStage;
}

function memberBadge(spec: PokemonSpec, gymType: string): BadgeMember | null {
  if (!carriesGymType(spec, gymType)) return null;
  const highlighted = spec.highlightSlot === undefined ? undefined : spec.moves[spec.highlightSlot];
  return {
    highlight: gymType === 'Fire' && highlighted ? toId(highlighted) : null,
    fifthMove: gymType === 'Flying' ? fifthMoveFor(spec) : null,
  };
}

export function battleBadgeFor(team: TeamSpec, gymType: string): BattleBadge {
  return { gymType, members: team.map((spec) => memberBadge(spec, gymType)) };
}

/**
 * The slot the Fire badge highlights on `spec` under `gymType`, or null when
 * no flame is drawn: another gym type, or a member that does not carry Fire.
 * The one reading the screens share with `memberBadge`, so a card cannot show
 * a flame the battle would not honour.
 */
export function flameSlotFor(spec: PokemonSpec, gymType: string | null): number | null {
  if (gymType !== 'Fire' || !carriesGymType(spec, gymType)) return null;
  return spec.highlightSlot ?? null;
}
