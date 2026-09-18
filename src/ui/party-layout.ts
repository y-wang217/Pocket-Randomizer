/**
 * What each party slot is holding — and now knows — *right now*, plan included.
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
import { partyAfterTeaches } from '../core/party';
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

/**
 * The party with the plan's teaches folded in. **The learn-move refresh patch.**
 *
 * The same lag as `itemLayoutOf` and the same argument, one field further down
 * the plan: a teach is composed on the party screen and spent at the next node
 * boundary, and until this existed every surface in between drew the moveset
 * the member had before the player taught it. There is no other signal that a
 * move was replaced — no confirmation, no before-and-after — so a moveset still
 * listing the displaced move is the only answer the player gets to "did that
 * work", and it is the wrong one.
 *
 * Why it is a whole party rather than a per-slot list like `itemLayoutOf`: an
 * item is a field on a member and a moveset is not. Teaching rebuilds the spec,
 * recomputes the derived move views, and carries PP per move id — `teachMove`
 * is the one reading of that and `ui/` must not grow a second one.
 *
 * **Read-only surfaces and the read half of the party screen.** A party screen
 * reorder or release writes against *run* slots, so those handlers keep reading
 * `view.party`; what this feeds is what is drawn, and the teach questions, which
 * have to be asked against the same running party the boundary will apply the
 * plan to.
 */
export function partyWithPlan(
  party: readonly PokemonState[],
  plan: ItemPlan | null,
): readonly PokemonState[] {
  return plan ? partyAfterTeaches(party, plan.teaches) : party;
}
