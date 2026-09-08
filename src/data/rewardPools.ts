/**
 * What each tier pays out. **This is the other half of the risk gradient, and
 * it is the file a balance pass edits.**
 *
 * The rule the whole stage rests on: *elite pools contain strictly better
 * entries, not merely more entries.* A pool that is the normal pool with extra
 * rolls produces no gradient at all — the expected value of three draws from
 * one table is the expected value of that table, however many times you shake
 * it — and the simulator would correctly report the tier as noise. So the three
 * pools below share almost nothing. Normal hands out near-duds and small
 * change; elite hands out the items that decide fights.
 *
 * If `npm run sim -- --policy tier-greedy` comes back behind `tier-averse`,
 * **this file is the fix, not `core/rewards.ts`.** The generator is a weighted
 * draw over a table; if the numbers are wrong the table is wrong.
 *
 * ## Keyed by tier *and* by segment band
 *
 * Two dimensions because they answer different questions. Tier is "how much did
 * you risk"; the segment band is "how far into the run are you". A Leftovers at
 * segment 0 is a different reward from a Leftovers at segment 6 — the first
 * reshapes the whole run, the second arrives after most of the attrition has
 * already happened — so the bands shift *which* entries a tier offers as the
 * run goes on, not just how much of them.
 *
 * The visible shape of that: the opening bands keep Choice items out (a
 * whole-battle move lock is a trap for a player who has not yet learned what
 * their moveset does), and the late bands drop pure currency down and push
 * healing up, because by segment 6 a shop is further away than the next gym.
 */
import type { Tier } from '../core/types';
import { CHOICE_ITEMS, GOOD_ITEMS, MODEST_ITEMS, PREMIUM_ITEMS, TYPE_ITEMS } from './items';

/**
 * One drawable entry in a pool: a weight, and enough parameters for
 * `core/rewards.ts` to resolve it into a concrete `Reward` with one draw.
 *
 * A **template**, not a reward. The distinction is what keeps pool contents
 * entirely in this file while the drawing stays in core: this says "an item
 * from these ten" and core says which one. An entry that carried a resolved
 * reward would mean every possible payout had to be enumerated by hand.
 */
export type RewardEntry =
  /** One item, drawn from `items` (ids from data/items.ts). */
  | { kind: 'item'; weight: number; items: readonly string[] }
  /** Run currency, drawn from an inclusive range and scaled by segment. */
  | { kind: 'currency'; weight: number; min: number; max: number }
  /** A damaging move added to the party, from the node's bands plus `bandOffset`. */
  | { kind: 'tm'; weight: number; bandOffset: number }
  /** The same mechanism, aimed higher. See the note on why both exist. */
  | { kind: 'tutor'; weight: number; bandOffset: number }
  /** Restore this fraction of max HP and PP. */
  | { kind: 'heal'; weight: number; fraction: number }
  /** Replace the party member's species. Gated by `tuning.allowSpeciesRewards`. */
  | { kind: 'species'; weight: number; bandOffset: number };

/** A stretch of the run, and what a tier offers across it. */
export interface RewardBand {
  /** The last segment index this row covers. Rows are read in order. */
  throughSegment: number;
  /** At least three entries, or an offer of three distinct options is impossible. */
  entries: readonly RewardEntry[];
}

const ids = (entries: readonly { id: string }[]): readonly string[] => entries.map((entry) => entry.id);

const TYPE_ITEM_IDS = ids(TYPE_ITEMS);
const MODEST_ITEM_IDS = ids(MODEST_ITEMS);
const GOOD_ITEM_IDS = ids(GOOD_ITEMS);
const PREMIUM_ITEM_IDS = ids(PREMIUM_ITEMS);
const CHOICE_ITEM_IDS = ids(CHOICE_ITEMS);

/*
 * **The tier gradient is carried by moves and money, not by items, and the
 * simulator is what settled that.**
 *
 * The obvious design is for the elite pool to be the good-items pool. It does
 * not work, for a structural reason: at `PARTY_SIZE` 1 a Pokemon holds exactly
 * one item, so the *second* item a run is offered is worth almost nothing. A
 * risk-greedy player's advantage therefore saturates after one good card, while
 * the risk keeps compounding every node — and the report showed exactly that,
 * with `tier-greedy` losing 3-4 points of per-segment survival and gaining
 * nothing back after its first Leftovers.
 *
 * Moves do not saturate: there are four slots, `teachMove` replaces the weakest
 * attack, and a run that takes six tutors is meaningfully stronger than one that
 * took two. Neither does money, which converts to healing at every shop. So the
 * higher tiers below weight *tutors* and currency up and items down, and the
 * items they do offer are the four that change a fight rather than a longer list
 * of ones that nudge it.
 *
 * TM and tutor are the same mechanism pointed at different bands, and that is
 * on purpose rather than a missing distinction.
 *
 * Both add a damaging move through `party.teachMove`. What separates them is
 * where the move comes from: a TM draws from the node's own band window, so it
 * is a sidegrade or a small upgrade and mostly buys *coverage*; a tutor draws
 * one or two bands above, so it is an upgrade to the player's best attack and
 * mostly buys *power*. Keeping them as two named kinds rather than one kind
 * with a number matters for the report — "reward take rate by kind" can only
 * tell them apart if they are apart.
 */

/**
 * The normal pool: small money, coverage, and a coin-flip on a type item.
 *
 * Deliberately unexciting. A normal node is the option you take when you cannot
 * afford the fight next to it, and it should feel like that. The type items are
 * the load-bearing weak entry — they pay out only when they match your typing,
 * which is roughly a one-in-four shot, and `core/items.ts` makes the reward
 * screen say so rather than hiding it.
 */
const NORMAL: readonly RewardBand[] = [
  {
    throughSegment: 2,
    entries: [
      { kind: 'item', weight: 4, items: TYPE_ITEM_IDS },
      { kind: 'currency', weight: 2, min: 14, max: 24 },
      { kind: 'tm', weight: 3, bandOffset: 0 },
      { kind: 'heal', weight: 3, fraction: 0.4 },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { kind: 'item', weight: 3, items: TYPE_ITEM_IDS },
      { kind: 'currency', weight: 2, min: 20, max: 32 },
      { kind: 'tm', weight: 3, bandOffset: 0 },
      // Healing climbs late: by segment 6 the next shop is further off than the
      // next gym, so HP stops being convertible into anything else.
      { kind: 'heal', weight: 3, fraction: 0.5 },
    ],
  },
];

/**
 * The hard pool: real items, real money, a move worth having.
 *
 * Every entry here is strictly better than its counterpart in `NORMAL` — that
 * is the property, not a tendency. The item entry is the modest boosters plus
 * a slice of the staples, so the worst outcome is a guaranteed 1.1x rather than
 * a one-in-four 1.2x.
 */
const HARD: readonly RewardBand[] = [
  {
    throughSegment: 2,
    entries: [
      { kind: 'item', weight: 3, items: [...MODEST_ITEM_IDS, ...GOOD_ITEM_IDS] },
      { kind: 'currency', weight: 2, min: 30, max: 48 },
      { kind: 'tm', weight: 4, bandOffset: 1 },
      { kind: 'heal', weight: 5, fraction: 0.85 },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { kind: 'item', weight: 3, items: GOOD_ITEM_IDS },
      { kind: 'currency', weight: 2, min: 42, max: 66 },
      { kind: 'tutor', weight: 4, bandOffset: 1 },
      { kind: 'heal', weight: 6, fraction: 0.95 },
    ],
  },
];

/**
 * The elite pool: the fight-deciding items, a full heal, and the best moves in
 * the segment's reach.
 *
 * There is no type item and no small-change entry anywhere in it. That is the
 * "strictly better entries" rule taken literally — an elite node should never
 * offer a card that a normal node could have offered, because the moment it can,
 * the player who took the elite fight has been charged for a coin flip.
 *
 * Choice items appear only from segment 3, and the reason is the whole-battle
 * lock: with `PARTY_SIZE` 1 there is no switching out to reset it, so a Choice
 * item is a commitment to one move for an entire fight. That is a real decision
 * for a player who knows their moveset and a trap for one three nodes into
 * their first run. Whether it is a trap *at all* is a question for the
 * simulator in checkpoint 4 — and if the answer is yes, the fix is deleting one
 * line here rather than touching any code.
 */
const ELITE: readonly RewardBand[] = [
  {
    throughSegment: 2,
    entries: [
      { kind: 'item', weight: 4, items: PREMIUM_ITEM_IDS },
      { kind: 'tutor', weight: 4, bandOffset: 2 },
      { kind: 'currency', weight: 2, min: 62, max: 95 },
      { kind: 'heal', weight: 6, fraction: 1 },
      { kind: 'species', weight: 2, bandOffset: 1 },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { kind: 'item', weight: 4, items: [...PREMIUM_ITEM_IDS, ...CHOICE_ITEM_IDS] },
      { kind: 'tutor', weight: 4, bandOffset: 2 },
      { kind: 'currency', weight: 2, min: 85, max: 135 },
      { kind: 'heal', weight: 7, fraction: 1 },
      { kind: 'species', weight: 2, bandOffset: 1 },
    ],
  },
];

export const REWARD_POOLS: Record<Tier, readonly RewardBand[]> = {
  normal: NORMAL,
  hard: HARD,
  elite: ELITE,
};

/**
 * The entries a node of this tier, in this segment, may draw from.
 *
 * Falls back to the last band rather than throwing, for the same reason
 * `tierWeightsFor` does: a `SEGMENT_COUNT` raised without a matching row should
 * keep generating rather than crash a run.
 */
export function rewardEntriesFor(tier: Tier, segment: number): readonly RewardEntry[] {
  const bands = REWARD_POOLS[tier];
  const row = bands.find((band) => segment <= band.throughSegment) ?? bands[bands.length - 1];
  if (!row) throw new RangeError(`No reward pool for tier ${tier}`);
  return row.entries;
}

/*
 * The currency scale used to live here and now lives in `data/shop.ts`, with
 * the prices it has to agree with. A payout and a price are the two ends of one
 * number, and keeping them in separate files is how an economy drifts.
 */
