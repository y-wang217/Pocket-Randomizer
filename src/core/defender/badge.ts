/**
 * The badge a defender battle runs under. **Defender Mode v0, step 4.**
 *
 * Built here, in `core/`, from the battle team and the gym type, and executed
 * by the adapter (`battle/format.ts`). A member gets the badge exactly when its
 * species carries the gym type (`typeLock.carriesGymType`), so the off-type
 * slot gets nothing; eligibility is read off the species, never a battle's
 * live types, so Burn Up or Soak cannot switch it off mid-fight (ruling R7).
 */
import { DEFENDER_BADGE } from '../../data/defender';
import { entryOfSpecies, hasEvolution } from '../../data/evolution';
import { toId } from '../../data/blacklists';
import type { BadgeMember, BattleBadge, PokemonSpec, TeamSpec } from '../types';
import { carriesGymType } from './typeLock';

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
