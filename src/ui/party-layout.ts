/**
 * What each party slot is holding *right now*, plan included.
 *
 * Stage 4.7. Three surfaces need this and none of them owns it: the drawer, the
 * pre-gym screen, and the party screen that composes the plan in the first
 * place.
 *
 * **The plan is the reason this is not just `member.item`.** An item layout is
 * collected on the party screen and applied at the next node boundary, so
 * between those two moments the run's own state still shows the old
 * arrangement. A read-only surface that showed `member.item` would tell the
 * player their Leftovers were still on the Squirtle they just moved them off,
 * which is a readout contradicting a decision the player has already made — the
 * exact failure the drawer exists to remove.
 */
import type { ItemId, ItemPlan, PokemonState } from '../core/types';

/**
 * One entry per party slot: the item that slot will hold, or null.
 *
 * With no plan this is simply what each member is holding. With one, the plan
 * wins — an assignment names a slot, and a slot with no assignment in the plan
 * is holding nothing, because a plan is a *destination* rather than a diff.
 * `core/items.ts` says why the plan is shaped that way.
 */
export function itemLayoutOf(
  party: readonly PokemonState[],
  plan: ItemPlan | null,
): (ItemId | null)[] {
  if (!plan) return party.map((member) => member.item ?? null);
  return party.map(
    (_, slot) => plan.assignments.find((entry) => entry.slot === slot)?.item ?? null,
  );
}
