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
 */
import type { PokemonSpec, PokemonState } from './types';
import { itemById, type ItemEntry } from '../data/items';

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
 * **One item per Pokemon, and the swapped-out item is gone.** There is no
 * inventory and no bag, which is a refusal rather than an omission: a bag needs
 * a screen, a capacity rule, and an answer to what happens to it on a wipe, and
 * none of those are interesting decisions until there is a party to spread
 * items across. Stage 4 is the conversation; until then, taking an item is a
 * choice with a cost, which is the more useful version anyway.
 *
 * Returns a new state. Nothing in a run is mutated in place — a run is replayed
 * from a decision log, and shared mutable party state is the fastest way to
 * make a replay disagree with the run it replays.
 */
export function giveItem(member: PokemonState, itemId: string): PokemonState {
  if (!itemById(itemId)) return member;
  return { ...member, item: itemId };
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
