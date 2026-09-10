/**
 * The move that opens each capability, and the two entries no generated pool
 * contains.
 *
 * ## Why this is an overlay and not a regeneration
 *
 * The obvious move is to widen `scripts/gen-pools.ts` until Cut and Flash come
 * through, and it is the wrong one twice over.
 *
 * **The exclusions that drop them are correct and worth keeping.** Cut is
 * `isNonstandard: 'Unobtainable'` in gen 9 and Flash is `'Past'`; that filter
 * is dex hygiene that should survive every future regeneration. Fly and Dive —
 * cut from the capability set entirely — carry `flags.charge`, and that
 * exclusion exists because @smogon/calc scores one turn of a two-turn move, so
 * a policy holding one looks twice as strong as it plays. Relaxing a filter
 * that protects a number in the balance report, in order to reach two moves, is
 * a bad trade.
 *
 * **Opponents holding Flash would be a dilution with no upside.** A regenerated
 * pool feeds `rollMoveset`, so every trainer and gym leader in the game would
 * start rolling Cut and Flash into their four slots. Flash drops accuracy by
 * one stage and Cut is a 50 BP Normal attack: on an opponent they are close to
 * a wasted slot, which makes an encounter easier for a reason the player cannot
 * see and the report cannot attribute. The whole point of these two moves is
 * that they are moves a *player* would not otherwise keep — that is where the
 * capability mechanic has a real cost — and that only works if the player is
 * the one being offered them.
 *
 * So the overlay is drawn by **reward offers, shop stock and starter preslots,
 * and by nothing else**. Opponent and gym generation read the generated pools
 * exactly as they did before this file existed.
 *
 * This is a narrowing of the 4.6 amendment, which said capability moves join
 * `data/movePools.ts`. That file's first line is `GENERATED FILE — do not
 * hand-edit`, so the amendment as written could only have meant a regeneration.
 * The intent — capability moves are ordinary moves, banded and displaced like
 * any other — is preserved exactly. See `docs/generation.md`.
 *
 * ## Three of the five were already there
 *
 * Rock Smash, Strength and Surf are in `DAMAGING_MOVES` today and always have
 * been, so the overlay is the delta and not the set: two rows, Cut and Flash.
 * Opponents can roll Surf, and could before this stage; nothing here changes
 * that and nothing should.
 *
 * ## They are ordinary moves
 *
 * There is no item class, no permanence, no backpack exemption and no teaching
 * flow. A capability move is acquired as a preslotted starter move, a move
 * reward or a shop TM; it bands through `bandOf`/`bandOfMove` like anything
 * else; and a displaced capability move is gone exactly like any other
 * displaced move. Losing Cut to a better attack is the decision the mechanic
 * is made of.
 */
import type { CapabilityId } from './capabilityTypes';
import { DAMAGING_MOVES, STATUS_MOVES, type MoveEntry } from './movePools';

/**
 * Which move opens which capability.
 *
 * By move id, because that is what `MoveEntry.id`, `Reward.move` and
 * `describeMove` all agree on.
 */
export const CAPABILITY_MOVE: Readonly<Record<CapabilityId, string>> = {
  cut: 'cut',
  flash: 'flash',
  rockSmash: 'rocksmash',
  strength: 'strength',
  surf: 'surf',
};

/**
 * The entries the generated pools do not carry.
 *
 * Hand-written, and every field mirrors `Dex.forGen(9)` exactly — the same
 * contract `data-tables.test.ts` holds the generated pools to, asserted for
 * these two in `test/capabilities.test.ts`. Bands are `POWER_CUTS` applied by
 * hand: Cut at 50 BP is band 1.
 *
 * `accuracy: 101` would mean "never misses"; neither of these does, so both
 * carry their real numbers.
 *
 * Flash is a status move, so it has no band and carries an `impact` instead.
 * `pressure` is the group it belongs to — it drops the target's accuracy a
 * stage, which is what Screech, Fake Tears and Eerie Impulse do to other stats,
 * and every one of those is tagged `pressure` in `scripts/gen-pools.ts`.
 *
 * Both play correctly in `gen9customgame`: Custom Game applies no team
 * validator, so `isNonstandard` keeps them out of the *generator* without
 * keeping them out of the *engine*. @smogon/calc scores both, so the greedy AI
 * ranks them like any other move.
 */
export const CAPABILITY_ONLY_MOVES: readonly MoveEntry[] = [
  { id: 'cut', name: 'Cut', type: 'Normal', category: 'Physical', basePower: 50, accuracy: 95, band: 1, impact: null },
  { id: 'flash', name: 'Flash', type: 'Normal', category: 'Status', basePower: 0, accuracy: 100, band: null, impact: 'pressure' },
];

const POOLED = new Map([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => [move.id, move]));
const OVERLAY = new Map(CAPABILITY_ONLY_MOVES.map((move) => [move.id, move]));

/**
 * Every move a capability can be opened with, generated pool and overlay
 * together.
 *
 * The generated entry wins where both have one, so a regeneration that ever
 * *does* bring Cut through takes over from the hand-written row rather than
 * being shadowed by it. Today nothing overlaps.
 */
export function capabilityMoveEntry(capability: CapabilityId): MoveEntry {
  const id = CAPABILITY_MOVE[capability];
  const entry = POOLED.get(id) ?? OVERLAY.get(id);
  if (!entry) {
    // Unreachable while the table above is consistent, and `test/capabilities.test.ts`
    // asserts it is. Thrown rather than returned as null because a capability
    // with no move is a gate that can never be opened, and a screen rendering
    // "requires <nothing>" is worse than a build that stops.
    throw new Error(`Capability "${capability}" names move "${id}", which no pool contains`);
  }
  return entry;
}

/** An overlay entry by move id, for the lookups in `data/moveOverrides.ts`. */
export function capabilityOnlyMove(id: string): MoveEntry | null {
  return OVERLAY.get(id) ?? null;
}

/**
 * The capability a move id opens, or null.
 *
 * This is the slot half of `resolveCapability`: a party member knows a
 * capability when one of its four move slots answers here.
 */
export function capabilityOfMove(moveId: string): CapabilityId | null {
  const wanted = moveId.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [capability, id] of Object.entries(CAPABILITY_MOVE)) {
    if (id === wanted) return capability as CapabilityId;
  }
  return null;
}
