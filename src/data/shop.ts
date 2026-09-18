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
import { BERRIES, CHOICE_ITEMS, MODEST_ITEMS, STAPLE_ITEMS, TYPE_ITEMS } from './items';
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
  wild: 8,
  trainer: 14,
  gym: 40,
};

/**
 * The tier multiplier on a fight's payout.
 *
 * **This is half of the risk gradient and the more honest half.** It only pays,
 * though, if money is scarce enough to be worth having: the first tuning pass
 * ran payouts almost twice as high and measured 19-24% of shop arrivals *flush*
 * with a median of 170 coins left unspent at the end of a run. A risk-greedy
 * player earning 2.2x of a currency nobody can spend is earning nothing, which
 * is why the base payouts above came down before this multiplier went up. A reward pool
 * is a lottery — an elite card is better *on average* — whereas this is the part
 * a player can count. Elite pays a bit over twice normal, and if the balance
 * report says elite paths are underpaying, this is the first number to move,
 * because moving it changes nothing else about the game.
 */
export const TIER_PAYOUT: Record<Tier, number> = {
  normal: 1,
  hard: 1.6,
  elite: 2.4,
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

/**
 * One row of a shelf: what kind of thing it is, and what may fill it.
 *
 * **A shelf is a list of categories, not a list of draws, and that is the
 * change.** It was one weighted walk over a single table, `shopStockSize` times
 * — which meant a shelf could legally come out as three heals and no move at
 * all. A shop that sometimes sells nothing you can use is not a decision, it is
 * a node you walk past, and the player has already paid a step to stand there.
 *
 * The shape is Slay the Spire's, named as the mapping the brief asked for:
 * cards, colorless cards, potions, relics and the removal. Here that is a
 * battle move, a status move, a berry, a relic and a heal — see
 * `../../docs/spec/gymrun-patch-shop-and-moveset-variance.md`.
 *
 * `entries` is drawn *within* the slot, so a category with two price points —
 * a half heal against a full one — is still a roll, and the roll is over what
 * *kind of that thing* rather than over whether you get one.
 */
export interface ShopSlot {
  category: ShopCategory;
  entries: readonly ShopEntry[];
}

/** The categories a shelf guarantees. One row each, in this order. */
export type ShopCategory = 'move' | 'technique' | 'berry' | 'heal' | 'item' | 'relic';

/** What a shop sells over a stretch of the run, and nothing about who buys it. */
export interface ShopBand {
  throughSegment: number;
  slots: readonly ShopSlot[];
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
 * What is left is the five, and each is a different *reason to spend*. An item
 * is the reason to save. A heal is the reason to spend now. A battle move is
 * the reason to spend when neither of the other two is worth it. A berry is the
 * denomination that makes a near-empty wallet still worth something. And a
 * technique is the one thing on the shelf that no fight in the game will ever
 * hand you — which is the point of it, and the answer to section 2 of
 * `../../docs/reports/moveset-pool-validation.md`.
 */
const SHOP_STOCK: readonly ShopBand[] = [
  {
    throughSegment: 2,
    slots: [
      { category: 'move', entries: [{ kind: 'tm', weight: 1, price: 70, bandOffset: 0 }] },
      /*
       * **Priced at two band steps above the battle move beside it. The R19
       * rulings; it was 60, just under the TM.**
       *
       * The superseded argument, because it was wrong in a way worth keeping:
       * *"A TM moves the number the player hits with. A Swords Dance moves how
       * they get to use it, and costs a turn to do it. Cheaper, therefore, but
       * not much cheaper."* That reasoning was sound and untested — status
       * moves were **structurally unreachable** until `generation.md` section
       * 31, because all four routes that hand a player a move called
       * `damagingInBands`, so this shelf row is the first place their price has
       * ever been visible. The first playtest to see one said it was wrong.
       *
       * ## Where 150 comes from
       *
       * The ask was a range rather than a number — *"around the same value as a
       * +2 band move or a relic, maybe less than a relic"* — and **the shop
       * sells no +2 band move at any price**, so there is no row to copy. The
       * only move-against-move comparison this table contains is its own two
       * TMs: `bandOffset: 0` at 70 here, `bandOffset: 1` at 110 in the band
       * below. That is the shop's own price for one band, **+40**, and two of
       * them is 150.
       *
       * So the number is read off the table rather than invented, it is
       * "around a +2 band move" by the table's own arithmetic, and it is under
       * the relic's 260, which is the range as stated.
       *
       * ## Two things this costs, named rather than buried
       *
       * At segment 0 this is 150 flat against a `NODE_PAYOUT` of 8 for a wild
       * fight and 40 for a gym, and at segment 2 it is 203 against the 190 the
       * reporting playtester was carrying — just out of reach. And the
       * technique slot is **guaranteed**, not drawn: `shopSlotsFor` returns
       * every slot in the band, so an unaffordable row is a permanently dead
       * row rather than an occasionally expensive one.
       *
       * Both are accepted deliberately. The ruling holds the number loose —
       * *"We can tune this number later"* — and by `CLAUDE.md` balance is not a
       * gate: the number is recorded and the pass keeps going. The cheaper
       * answers, if a later report wants one, are a one-band step (110 here,
       * 150 below) or moving the technique behind a weight rather than a slot.
       */
      { category: 'technique', entries: [{ kind: 'technique', weight: 1, price: 150 }] },
      /*
       * Berries, at the bottom of the price list, which is where 4.6b put them
       * in the reward pools and where they have never been purchasable.
       *
       * Cheap enough that a wallet too thin for anything else still buys one,
       * which is the whole job of a low denomination. `docs/README.md` open
       * item 2 records a berry clog past gym 6 — this slot does not make that
       * worse, because a clog is bag pressure and every berry here is bought
       * rather than given.
       */
      { category: 'berry', entries: [{ kind: 'item', weight: 1, price: 25, items: ids(BERRIES) }] },
      {
        category: 'heal',
        entries: [
          { kind: 'heal', weight: 4, price: 40, fraction: 0.5 },
          { kind: 'heal', weight: 2, price: 85, fraction: 1 },
        ],
      },
      {
        category: 'item',
        entries: [
          { kind: 'item', weight: 4, price: 55, items: [...ids(MODEST_ITEMS), ...ids(TYPE_ITEMS)] },
          { kind: 'item', weight: 3, price: 130, items: ids(STAPLE_ITEMS) },
        ],
      },
    ],
  },
  {
    throughSegment: 7,
    slots: [
      { category: 'move', entries: [{ kind: 'tm', weight: 1, price: 110, bandOffset: 1 }] },
      /*
       * The same two band steps above this band's own TM: 110 + 80. Under the
       * relic on the shelf beside it (260), which is the half of the ask that
       * only this band can satisfy — band 1 stocks no relic to be under.
       */
      { category: 'technique', entries: [{ kind: 'technique', weight: 1, price: 190 }] },
      { category: 'berry', entries: [{ kind: 'item', weight: 1, price: 35, items: ids(BERRIES) }] },
      {
        category: 'heal',
        entries: [
          { kind: 'heal', weight: 4, price: 60, fraction: 0.5 },
          { kind: 'heal', weight: 3, price: 120, fraction: 1 },
        ],
      },
      {
        category: 'item',
        entries: [
          { kind: 'item', weight: 4, price: 145, items: ids(STAPLE_ITEMS) },
          { kind: 'item', weight: 2, price: 165, items: ids(CHOICE_ITEMS) },
        ],
      },
      /*
       * A relic on the shelf, priced past a staple item.
       *
       * Not in the opening band: a relic costs more than a run has at segment
       * 0-2, so stocking one there would be a slot that reads as a shelf full
       * of nothing. From segment 3 it is a real decision against two heals
       * and a TM.
       */
      { category: 'relic', entries: [{ kind: 'relic', weight: 1, price: 260 }] },
    ],
  },
];

/**
 * The slots a shop in this segment guarantees, in shelf order.
 *
 * Falls back to the last band rather than throwing, for the same reason
 * `tierWeightsFor` and `rewardEntriesFor` do: a `SEGMENT_COUNT` raised without a
 * matching row should keep generating rather than crash a run.
 */
export function shopSlotsFor(segment: number): readonly ShopSlot[] {
  const row = SHOP_STOCK.find((band) => segment <= band.throughSegment) ?? SHOP_STOCK[SHOP_STOCK.length - 1];
  if (!row) throw new RangeError('No shop stock defined');
  return row.slots;
}

/**
 * Everything a shop in this segment may stock, flattened out of the slots.
 *
 * Two callers, and they want it for different reasons. `generateShopStock`
 * draws the *extra* rows from it — `tuning.shopExtraSlots`, the bonus on top of
 * the guarantees — so an extra is a roll over the whole shelf rather than a
 * second row of one category. And a test asking "can a segment-0 shop sell a
 * relic" wants one list to ask rather than six.
 */
export function shopEntriesFor(segment: number): readonly ShopEntry[] {
  return shopSlotsFor(segment).flatMap((slot) => slot.entries);
}

/** A price, scaled to the segment it is being charged in. Always at least 1. */
export function priceAt(base: number, segment: number): number {
  return Math.max(1, Math.round(base * currencyScaleFor(segment)));
}

/** Inclusive bounds a run's currency is expected to sit inside. Report only. */
export const HEALTHY_BALANCE: Range = { min: 40, max: 400 };
