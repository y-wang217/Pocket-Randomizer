/**
 * The economy: what a node pays, what a shop stocks, and what it charges.
 *
 * **Every currency number in the game is in this file.** That is the point of
 * it: an economy is only ever balanced as a *ratio* — what a fight pays against
 * what a Leftovers costs — and two numbers that have to agree should not live in
 * two files. `core/economy.ts` is the arithmetic; this is the table.
 *
 * The failure mode the simulator watches for is stated in the spec and is worth
 * repeating here, because it is what these numbers are tuned against: *if
 * players are always broke or always flush, the prices are wrong.* A currency
 * nobody can spend is a dead reward kind occupying a third of every offer, and
 * a currency that buys everything makes the shop node a formality. The
 * "currency curve" row of the balance report is the read-out.
 */
import type { Tier } from '../core/types';
import type { RewardEntry } from './rewardPools';
import { CHOICE_ITEMS, MODEST_ITEMS, STAPLE_ITEMS, TYPE_ITEMS } from './items';
import type { BattleKind, Range } from './tuning';

// ---------------------------------------------------------------------------
// Earning
// ---------------------------------------------------------------------------

/**
 * How currency scales with progress.
 *
 * A flat table rather than a formula, so the *shape* of the payout curve is one
 * thing to read rather than something to derive. It multiplies both sides —
 * payouts and prices — which is what makes "40 coins" mean the same share of a
 * shop at segment 6 as it did at segment 1. Moving it therefore does **not**
 * change purchasing power; to do that, move payouts and prices apart.
 *
 * Lives here rather than in `data/rewardPools.ts`, where it started, because a
 * currency reward and a shop price are the two ends of one number.
 */
export const CURRENCY_SCALE: readonly number[] = [1, 1.15, 1.35, 1.55, 1.8, 2.05, 2.3, 2.6];

export function currencyScaleFor(segment: number): number {
  return CURRENCY_SCALE[Math.min(Math.max(0, segment), CURRENCY_SCALE.length - 1)] ?? 1;
}

/**
 * What a won fight pays, before the tier multiplier and the segment scale.
 *
 * A gym pays more than a trainer pays more than a wild, which is the same
 * ordering as the difficulty and is the whole reason the numbers differ. Rest,
 * shop and event nodes are not in this table and pay nothing — `BattleKind`
 * makes that a type-level fact rather than a row of zeroes.
 */
export const NODE_PAYOUT: Record<BattleKind, number> = {
  wild: 14,
  trainer: 24,
  gym: 70,
};

/**
 * The tier multiplier on a fight's payout.
 *
 * **This is half of the risk gradient and the more honest half.** A reward pool
 * is a lottery — an elite card is better *on average* — whereas this is the part
 * a player can count. Elite pays a bit over twice normal, and if the balance
 * report says elite paths are underpaying, this is the first number to move,
 * because moving it changes nothing else about the game.
 */
export const TIER_PAYOUT: Record<Tier, number> = {
  normal: 1,
  hard: 1.55,
  elite: 2.2,
};

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------

/**
 * One thing a shop may stock: a reward template, a weight, and a price.
 *
 * `RewardEntry & { price }` rather than a parallel type, so a shop sells the
 * same things a reward pays out and `core/rewards.ts` resolves both with one
 * function. A shop with its own inventory system would be a second table of
 * items to keep in balance with the first, and the first divergence between
 * them would be invisible.
 *
 * The `weight` on the underlying entry is what the stock draw uses; `price` is
 * before the segment scale.
 */
export type ShopEntry = RewardEntry & { price: number };

/** What a shop sells over a stretch of the run, and nothing about who buys it. */
export interface ShopBand {
  throughSegment: number;
  entries: readonly ShopEntry[];
}

const ids = (entries: readonly { id: string }[]): readonly string[] => entries.map((entry) => entry.id);

/*
 * A shop sells rewards, and deliberately not currency or species.
 *
 * Currency is obvious — a shop that sells money is a rounding error with a
 * screen. Species is excluded because it is gated off everywhere else and a
 * shop is the worst possible place to test a mechanic that can end a run: the
 * player has already paid for it.
 *
 * What is left is the interesting three. Items are the reason to save; healing
 * is the reason to spend *now*; a TM is the reason to spend when neither of the
 * other two is worth it. With one item per Pokemon and no inventory, a shop
 * visit is usually one item plus a heal, which is a real budget decision rather
 * than a shopping list.
 */
const SHOP_STOCK: readonly ShopBand[] = [
  {
    throughSegment: 2,
    entries: [
      { kind: 'item', weight: 4, price: 55, items: [...ids(MODEST_ITEMS), ...ids(TYPE_ITEMS)] },
      { kind: 'item', weight: 3, price: 130, items: ids(STAPLE_ITEMS) },
      { kind: 'heal', weight: 4, price: 40, fraction: 0.5 },
      { kind: 'heal', weight: 2, price: 85, fraction: 1 },
      { kind: 'tm', weight: 3, price: 70, bandOffset: 0 },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { kind: 'item', weight: 4, price: 145, items: ids(STAPLE_ITEMS) },
      { kind: 'item', weight: 2, price: 165, items: ids(CHOICE_ITEMS) },
      { kind: 'heal', weight: 4, price: 60, fraction: 0.5 },
      { kind: 'heal', weight: 3, price: 120, fraction: 1 },
      { kind: 'tm', weight: 3, price: 110, bandOffset: 1 },
    ],
  },
];

/**
 * The stock table a shop in this segment draws from.
 *
 * Falls back to the last band rather than throwing, for the same reason
 * `tierWeightsFor` and `rewardEntriesFor` do: a `SEGMENT_COUNT` raised without a
 * matching row should keep generating rather than crash a run.
 */
export function shopEntriesFor(segment: number): readonly ShopEntry[] {
  const row = SHOP_STOCK.find((band) => segment <= band.throughSegment) ?? SHOP_STOCK[SHOP_STOCK.length - 1];
  if (!row) throw new RangeError('No shop stock defined');
  return row.entries;
}

/** A price, scaled to the segment it is being charged in. Always at least 1. */
export function priceAt(base: number, segment: number): number {
  return Math.max(1, Math.round(base * currencyScaleFor(segment)));
}

/** Inclusive bounds a run's currency is expected to sit inside. Report only. */
export const HEALTHY_BALANCE: Range = { min: 40, max: 400 };
