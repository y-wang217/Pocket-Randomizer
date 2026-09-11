/**
 * Held items: where the run keeps them, and how they reach the engine.
 *
 * This file is short on purpose. Items are a native Showdown concept — the sim
 * implements Leftovers, the Choice lock and the rest correctly and has for
 * twenty years — so there are no mechanics here to write. What there is instead
 * is one storage decision and one seam, and both are load-bearing.
 *
 * **Storage: `PokemonState.item` is the single source of truth.** Not
 * `PokemonSpec.item`, even though the spec has had that field since Stage 0 and
 * the sim reads it. The reason is the sentence in core/types.ts: `spec` is the
 * unchanging identity and everything alongside it is the run's damage to it. A
 * held item is something the run *did* — it is acquired, swapped and lost —
 * which puts it on the same side of that line as HP and PP. Writing it onto the
 * spec would mean the identity of a Pokemon changed when it picked something
 * up, and `applyBattleState` matches party members by spec, so it would have
 * changed underneath the one function that has to recognise it.
 *
 * **Seam: `battleSpecFor` merges the two, and nothing else may.** The sim is
 * handed `{...spec, item}` at the moment a battle starts, and the merged object
 * exists only for the duration of that battle. Everywhere else — the party
 * panel, the reward screen, the run log — reads `PokemonState.item`.
 *
 * ## Stage 4.5.1: the backpack, and the rule it retires
 *
 * Stage 3 wrote "there is no inventory and the swapped-out item is gone", and
 * gated the reversal on there being a party to spread items across. There is
 * one now, so the rule is **retired rather than flagged off** — an item is
 * never destroyed except by an explicit discard.
 *
 * That turns one decision into two, and the split is the point. *Which item do
 * I own* is settled at the reward screen against a finite capacity; *who holds
 * it* is settled on the party screen and is free to change between every fight.
 * The first is irreversible and the second is not, which is why only the first
 * has a cost attached.
 *
 * The backpack holds ids, not entries. An id is what the log carries, what
 * `PokemonState.item` carries and what the sim is handed, and resolving to an
 * `ItemEntry` is a lookup any reader can do — storing entries would mean the
 * run state held a copy of `data/items.ts` that a pool edit could not reach.
 */
import type { ItemId, ItemPlan, PokemonSpec, PokemonState } from './types';
import { itemById, type ItemEntry } from '../data/items';
import type { Tuning } from '../data/tuning';

/**
 * The spec to hand the sim for a party member, with its held item merged in.
 *
 * A new object every call, deliberately: the merged spec is a battle-time
 * artifact and must never be mistaken for the member's identity. `party.ts`
 * calls this and `core/battle/driver.ts` consumes the result; nothing else
 * needs it.
 *
 * An unknown item id is dropped rather than passed through. The sim would
 * silently treat an unrecognised item as no item at all, which is the same
 * outcome arrived at without anyone being able to tell it happened.
 */
export function battleSpecFor(member: PokemonState): PokemonSpec {
  if (!member.item || !itemById(member.item)) return member.spec;
  return { ...member.spec, item: member.item };
}

/**
 * Give a party member an item, replacing whatever it was holding.
 *
 * **The displaced item is returned, not destroyed** — that is the Stage 3 rule
 * being retired rather than flagged off. Callers hand it back to the backpack;
 * `applyItemPlan` is the only caller that matters and does exactly that.
 *
 * An unknown id is refused rather than equipped, and reports itself as
 * displacing nothing, so a pool edit that removes an item cannot silently strip
 * a Pokemon of the one it was holding.
 *
 * Returns new state. Nothing in a run is mutated in place — a run is replayed
 * from a decision log, and shared mutable party state is the fastest way to
 * make a replay disagree with the run it replays.
 */
export function giveItem(
  member: PokemonState,
  itemId: ItemId,
): { member: PokemonState; displaced: ItemId | null } {
  if (!itemById(itemId)) return { member, displaced: null };
  return { member: { ...member, item: itemId }, displaced: member.item ?? null };
}

/** Take a member's item off, handing it back. The inverse of `giveItem`. */
export function takeItem(member: PokemonState): { member: PokemonState; displaced: ItemId | null } {
  if (!member.item) return { member, displaced: null };
  const without = { ...member };
  delete without.item;
  return { member: without, displaced: member.item };
}

// ---------------------------------------------------------------------------
// The backpack
// ---------------------------------------------------------------------------

/**
 * Whether this state has anything for an item plan to do.
 *
 * **The single definition, shared by the question in `playRun` and the replay
 * that answers it** — the same discipline `rewards.isTargeted` follows, and for
 * the same reason. A boundary where the question is asked live but skipped on
 * replay puts the log one entry out of step, and the symptom is a battle
 * decision being read as a node decision several nodes later.
 *
 * It is derived purely from state, which replay reconstructs identically, so it
 * is safe to gate on. What it must never gate on is anything the *player* varies
 * independently of the log.
 */
export function needsItemPlan(state: {
  backpack: readonly ItemId[];
  party: readonly PokemonState[];
}): boolean {
  return state.backpack.length > 0 || state.party.some((member) => member.item !== undefined);
}

/**
 * How many loose items the run may hold. Held items are not counted.
 *
 * **Takes the party slots rather than reading them, and that is the Stage 4.8
 * fix.** Party capacity grows on the gym schedule, so the bag has to grow with
 * it; the slots are passed in because this file sits below `core/run.ts`, which
 * is where "how many gyms has this run cleared" is answered, and a capacity
 * function that reached upward for it would be an import cycle. Callers pass
 * `partyCapacity(state)`, which is the only thing that computes it.
 *
 * See `tuning.backpackSlack` for why the derived half cannot live on `Tuning`.
 */
export function backpackCapacity(partySlots: number, tuning: Tuning): number {
  return Math.max(0, Math.floor(partySlots + tuning.backpackSlack));
}

/**
 * Put an item in the backpack. Over capacity is *allowed here* and resolved later.
 *
 * The transient overflow is deliberate. A node can hand over three items at once
 * — a reward, a shop basket and an event all resolve in one `resolveNode` — and
 * asking the player to discard between each of them would be asking them to
 * choose without knowing what else is arriving. So acquisition always succeeds,
 * the backpack is briefly over its limit, and the boundary's item plan is what
 * brings it back down. `applyItemPlan` refuses to leave it over.
 *
 * Nothing is dropped and nothing is refused, which is the spec's rule stated as
 * a postcondition rather than an intention.
 */
export function stow(backpack: readonly ItemId[], itemId: ItemId): ItemId[] {
  if (!itemById(itemId)) return [...backpack];
  return [...backpack, itemId];
}

/**
 * Stow several, in order. **Stage 4.6a, and it exists because a capture can
 * free two items at once**: a captured Pokemon's own held item, and the item of
 * the member released to make room for it.
 *
 * A fold over `stow` rather than a second implementation, so the unknown-item
 * guard and the transient overflow rule are stated exactly once.
 */
export function stowAll(backpack: readonly ItemId[], itemIds: readonly ItemId[]): ItemId[] {
  return itemIds.reduce<ItemId[]>((carried, itemId) => stow(carried, itemId), [...backpack]);
}

/**
 * Spend the items a battle used up: off the party, out of the bag, gone.
 *
 * **Stage 4.6b, and "gone" is the whole rule.** A consumed berry is destroyed
 * — it does not restock between nodes, and it does not come back to the
 * backpack the way an unassigned item does. That is what makes it a resource
 * rather than an ability with a cooldown, and it is why the fade the berry
 * table describes is a fade rather than a plateau.
 *
 * Removed from the *holder* first, and from the backpack only if it was not
 * held. The sim spends a held item, so the holder is where it almost always
 * is; the backpack branch covers the one case that is not, an item the run
 * gained and lost inside the same node.
 *
 * Ids the whitelist does not know are still removed. `readConsumedItems` is
 * deliberately forgiving about what the protocol names, and an item that
 * reached a Pokemon can leave it whatever this file knows about it.
 */
export function spendItems<S extends { party: PokemonState[]; backpack: ItemId[] }>(
  state: S,
  consumed: readonly ItemId[],
): S {
  if (consumed.length === 0) return state;

  const party = [...state.party];
  const backpack = [...state.backpack];

  for (const itemId of consumed) {
    const holder = party.findIndex((member) => member.item === itemId);
    if (holder !== -1) {
      const member = party[holder];
      if (member) {
        // A copy without the item, rather than `delete`: every party
        // transition in this codebase returns new objects, and a mutated
        // member would be shared with the state the caller still holds.
        const rest = { ...member };
        delete rest.item;
        party[holder] = rest;
      }
      continue;
    }
    const loose = backpack.indexOf(itemId);
    if (loose !== -1) backpack.splice(loose, 1);
  }

  return { ...state, party, backpack };
}

/**
 * Apply a whole item plan: reassignments first, then discards.
 *
 * **Ordering matters and is fixed here rather than left to the caller.** An
 * item taken off a Pokemon lands in the backpack, and the player may well have
 * meant to discard *that* one — resolving assignments first is what makes
 * "unequip the Charcoal and throw it away" expressible as one plan.
 *
 * Assignments are applied as a transaction against a pool that starts as the
 * backpack plus everything the named slots were holding. That is what makes the
 * plan a *destination* rather than a sequence: swapping the items on slots 0 and
 * 1 is two assignments that would each be illegal on their own, and are legal
 * together because both items are in the pool before either is placed.
 *
 * Throws on anything illegal — an unknown slot, an item the run does not own,
 * a discard of something absent, or a plan that leaves the backpack over
 * capacity. Loud, because every one of those is either a UI bug or a hand-edited
 * log, and a silently trimmed backpack would replay as a different run.
 */
export function applyItemPlan<S extends { party: PokemonState[]; backpack: ItemId[]; tuning: Tuning }>(
  state: S,
  plan: ItemPlan,
  /**
   * The capacity the plan has to come in under, from
   * `backpackCapacity(partyCapacity(state), state.tuning)`.
   *
   * Passed rather than derived for the reason that function gives: the slot count
   * is a fact about gyms cleared, which lives a layer up. Required rather than
   * defaulted, because every sensible default here — the party's current length,
   * the opening slot count — is the frozen literal this patch exists to remove,
   * and a default would let a caller keep the old behaviour by saying nothing.
   */
  capacity: number,
): S {
  const seen = new Set<number>();
  for (const assignment of plan.assignments) {
    if (!state.party[assignment.slot]) {
      throw new RangeError(
        `Item assignment names slot ${assignment.slot}, but the party has ${state.party.length}`,
      );
    }
    if (seen.has(assignment.slot)) {
      throw new RangeError(`Item plan assigns slot ${assignment.slot} twice`);
    }
    seen.add(assignment.slot);
  }

  // The pool: the backpack, plus whatever the touched slots were holding. Both
  // sources go in before anything comes out, which is what lets two members
  // trade items in one plan.
  const pool = [...state.backpack];
  const party = [...state.party];
  for (const assignment of plan.assignments) {
    const { member, displaced } = takeItem(party[assignment.slot]!);
    party[assignment.slot] = member;
    if (displaced) pool.push(displaced);
  }

  for (const assignment of plan.assignments) {
    if (assignment.item === null) continue;
    const index = pool.indexOf(assignment.item);
    if (index === -1) {
      throw new RangeError(
        `Item plan gives slot ${assignment.slot} a ${assignment.item}, which the run does not hold`,
      );
    }
    pool.splice(index, 1);
    const { member } = giveItem(party[assignment.slot]!, assignment.item);
    party[assignment.slot] = member;
  }

  for (const discarded of plan.discards) {
    const index = pool.indexOf(discarded);
    if (index === -1) {
      throw new RangeError(`Item plan discards a ${discarded}, which is not in the backpack`);
    }
    pool.splice(index, 1);
  }

  if (pool.length > capacity) {
    throw new RangeError(
      `Item plan leaves ${pool.length} items in a backpack that holds ${capacity}. ` +
        'Over-capacity is resolved by discarding, never by dropping the overflow.',
    );
  }

  return { ...state, party, backpack: pool };
}

/** What a member is holding, resolved to its whitelist entry. Null if nothing. */
export function heldItem(member: PokemonState): ItemEntry | null {
  return member.item ? itemById(member.item) : null;
}

/**
 * Whether an item does anything for this particular Pokemon.
 *
 * Only type-boosting items can be dead weight, and only when the type does not
 * match. This exists so the reward screen can say so out loud rather than
 * letting the player find out over the next four fights — a near-dud that
 * announces itself is a legible low-tier reward, and one that hides is a
 * lottery. The simulator uses the same function to score an offer, so the bot
 * and the player judge a card by the same rule.
 *
 * Takes the types explicitly rather than deriving them, because deriving a
 * species' types means reaching into the sim and this file may not.
 */
export function itemSuitsTypes(entry: ItemEntry, types: readonly string[]): boolean {
  return entry.boostsType === null || types.includes(entry.boostsType);
}
