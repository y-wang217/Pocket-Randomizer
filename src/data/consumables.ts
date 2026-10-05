/**
 * Out-of-battle healing items. **Defender Mode v0, step 5.**
 *
 * Potion, Super Potion and Hyper Potion: single use, between battles only,
 * never in one. They heal a flat amount of one party member's HP and cannot
 * revive a fainted one. They share backpack capacity with held items and
 * berries (`core/items.ts` `inventoryLoad`).
 *
 * **Not `ItemEntry`s, and not in `data/items.ts`.** That table is what a
 * Pokemon may *hold*, `ItemEntry.consumable` already means "a berry the sim
 * eats", and the sim knows no Potion (`@pkmn/sim` reports all three as
 * `exists: false`), so a Potion in the backpack would be offered as a held item
 * and handed to a battle that cannot read it. A list of its own, beside `tms`,
 * is the shape the TM precedent set.
 *
 * Gen 9's own amounts. Every number here is a balance number.
 */
export interface ConsumableEntry {
  id: string;
  name: string;
  /** HP restored, flat, capped at the member's max. */
  heal: number;
}

export const CONSUMABLES: readonly ConsumableEntry[] = [
  { id: 'potion', name: 'Potion', heal: 20 },
  { id: 'superpotion', name: 'Super Potion', heal: 60 },
  { id: 'hyperpotion', name: 'Hyper Potion', heal: 120 },
];

const BY_ID = new Map(CONSUMABLES.map((entry) => [entry.id, entry]));

/** The consumable with this id, or null. */
export function consumableById(id: string): ConsumableEntry | null {
  return BY_ID.get(id) ?? null;
}
