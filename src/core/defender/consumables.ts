/**
 * Using a consumable. **Defender Mode v0, step 5.**
 *
 * A party edit, `{ kind: 'consume', id, slot }`, so using one is a logged
 * decision placed exactly where the player made it, and a replay applies it at
 * the same point. Between battles only: the run refuses one while a battle is
 * in progress (`core/run.ts`), loudly. Single use: the item leaves the list.
 */
import { consumableById } from '../../data/consumables';
import type { PokemonState } from '../types';

export interface ConsumableHolder {
  party: PokemonState[];
  consumables?: string[];
}

/** Why this use is refused, or null. A refusal names the item and the member. */
export function consumableRefusal(state: ConsumableHolder, id: string, slot: number): string | null {
  const entry = consumableById(id);
  if (!entry) return `${id} is not a consumable`;
  if (!(state.consumables ?? []).includes(id)) return `the bag holds no ${entry.name}`;
  const member = state.party[slot];
  if (!Number.isInteger(slot) || !member) return `${entry.name} on slot ${slot}, outside a party of ${state.party.length}`;
  if (member.fainted || member.hp <= 0) return `${entry.name} cannot revive ${member.spec.nickname ?? member.spec.species}`;
  if (member.hp >= member.maxHp) return `${member.spec.nickname ?? member.spec.species} is already at full HP`;
  return null;
}

/** Heal one member by the item's flat amount, capped at max, and spend the item. */
export function useConsumable<T extends ConsumableHolder>(state: T, id: string, slot: number): T {
  const refusal = consumableRefusal(state, id, slot);
  if (refusal) throw new RangeError(`Consumable refused: ${refusal}`);
  const heal = consumableById(id)!.heal;
  const held = state.consumables ?? [];
  const spent = held.indexOf(id);
  return {
    ...state,
    party: state.party.map((member, index) =>
      index === slot ? { ...member, hp: Math.min(member.maxHp, member.hp + heal) } : member,
    ),
    consumables: [...held.slice(0, spent), ...held.slice(spent + 1)],
  };
}
