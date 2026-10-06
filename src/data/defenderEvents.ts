/**
 * Defender Mode's question marks. **2026-10-06.**
 *
 * The defender design message: *"make ? event nodes possible to have any
 * number of results, not just acquire something for a price. e.g. battle,
 * make a decision, get something special, a special store, or a rest spot.
 * could be a free relic on rare occasions"*, and *"mimic slay the spire
 * events"*. A defender run had no event nodes at all; it has one per rank from
 * rank 1, a step of its own before the intermission, always visited.
 *
 * ## Six shapes, and what each borrows
 *
 * Slay the Spire rolls a `?` room's kind when the player enters it, with pity
 * counters nudging the odds. This game draws nothing at entry, so the shape is
 * drawn at generation and the counters are a weight table by rank. The shapes:
 *
 *   - **dilemma** (Big Fish, Living Wall): three things to take, each a
 *     drawn cost and grant. A choice, nothing hidden.
 *   - **gamble** (Wheel of Change, The Joust): a wager with its odds on the
 *     button, won or lost by a roll made at generation, and a way to leave.
 *   - **ambush** (Masked Bandits, Mysterious Sphere): a fight offered. Win
 *     it and the node pays its three cards and the option's grant; pay the
 *     price instead for a small sure thing; or leave.
 *   - **bazaar** (Designer In-Spire, The Woman in Blue): a shelf of its own,
 *     heals, berries and consumables. Asks no question; the shop screen does.
 *   - **shrine** (Shining Light, The Cleric): a rest that is not a rest node:
 *     a free partial heal, or a full one for a stated price.
 *   - **cache** (Lab): something to take for nothing. The rare free relic
 *     lives here, and its rarity is the shape's weight and its rank floor.
 *
 * ## What the rules forbid
 *
 * A `pay` option never contains a fight: `docs/generation.md` section 14's
 * Toll ruling stands, a stated price buys a known thing. A gate reads only
 * what the player sees, so no option is hidden or disabled on a drawn
 * outcome; a `pay` the run cannot afford stays on the menu, dimmed. No price
 * is a relic: a relic never leaves the held set. And the attacker's four
 * archetypes are untouched; this is its own table and its own instance type.
 *
 * ## Every number here is a balance number
 *
 * Inside `contentHash`. The copy a player reads is in `defenderEventCopy.ts`,
 * which is not.
 */
import type { Tier } from '../core/types';
import { CONSUMABLES } from './consumables';
import type { EventEffect, OutcomeTier } from './eventPools';
import type { TollPrice } from './events';
import { BERRIES, GOOD_ITEMS, MODEST_ITEMS, PREMIUM_ITEMS } from './items';
import type { ShopSlot } from './shop';

export type DefenderEventShape = 'dilemma' | 'gamble' | 'ambush' | 'bazaar' | 'shrine' | 'cache';

/** Every shape, in weight-table order. **A draw order.** */
export const DEFENDER_EVENT_SHAPES: readonly DefenderEventShape[] = ['dilemma', 'gamble', 'ambush', 'bazaar', 'shrine', 'cache'];

/**
 * What pressing an option does.
 *
 *   - `take`: pays the outcome, cost then grant. Free.
 *   - `pay`: charges `toll`, a stated price, then pays the grant. The one role
 *     with a price, and the one the screen can dim.
 *   - `fight`: plays the node's encounter; the grant lands on a win, with the
 *     node's cards. Free to press, and the fight is the cost.
 *   - `wager`: `odds` to win, shown; the outcome on a win, `lose` on a loss,
 *     both drawn at generation along with the roll.
 *   - `leave`: pays nothing and ends the node.
 */
export type DefenderOptionRole = 'take' | 'pay' | 'fight' | 'wager' | 'leave';

export interface DefenderEventOptionDef {
  role: DefenderOptionRole;
  /**
   * The reward-tier pips the button wears: how big what it pays is, as the
   * attacker's event buttons wear theirs (bible D33). Null on `leave`, which
   * pays nothing and wears none.
   */
  tier: OutcomeTier | null;
  /** The stated price. `pay` only. */
  toll?: TollPrice;
  /** The chance to win, 0 to 1. `wager` only. */
  odds?: number;
  /** What it takes before it gives. Drawn at generation. */
  cost?: readonly EventEffect[];
  /** What it pays: on a win for `fight` and `wager`, outright otherwise. */
  grant: readonly EventEffect[];
  /** What a lost `wager` takes. */
  lose?: readonly EventEffect[];
}

export interface DefenderEventDef {
  id: string;
  shape: DefenderEventShape;
  /** Inclusive, zero-based ranks this event may be drawn at. */
  ranks: { min: number; max: number };
  /** In button order. Empty on a `bazaar`, which asks nothing. */
  options: readonly DefenderEventOptionDef[];
}

/** How many question-mark steps each rank has, before its intermission. */
export const DEFENDER_EVENT_STEPS: readonly number[] = [0, 1, 1, 1, 1, 1, 1, 1];

/** The shape draw's weights over a stretch of ranks. Rows are read in order. */
export const DEFENDER_EVENT_SHAPE_WEIGHTS: readonly { throughRank: number; weights: Readonly<Record<DefenderEventShape, number>> }[] = [
  { throughRank: 3, weights: { dilemma: 4, gamble: 3, ambush: 3, bazaar: 2, shrine: 3, cache: 1 } },
  { throughRank: 7, weights: { dilemma: 3, gamble: 3, ambush: 4, bazaar: 2, shrine: 3, cache: 2 } },
];

/** The ambush's fight: a hard-tier untyped trainer of the rank, and the AI tier it plays at. */
export const DEFENDER_AMBUSH = { tier: 'hard' } as const satisfies { tier: Tier };

const ids = (entries: readonly { id: string }[]): readonly string[] => entries.map((entry) => entry.id);
const BERRY_IDS = ids(BERRIES);
const CONSUMABLE_IDS = ids(CONSUMABLES);

/**
 * The bazaar's shelf: heals, berries and consumables, a little under the
 * intermission's prices, and nothing a fight would hand you. Read by
 * `generateShopStock` in place of the segment's shelf.
 */
export const DEFENDER_BAZAAR_SHELF: readonly ShopSlot[] = [
  {
    category: 'heal',
    entries: [
      { kind: 'heal', weight: 3, price: 30, fraction: 0.5 },
      { kind: 'heal', weight: 2, price: 65, fraction: 1 },
    ],
  },
  { category: 'berry', entries: [{ kind: 'item', weight: 1, price: 20, items: BERRY_IDS }] },
  {
    category: 'item',
    entries: [
      { kind: 'consumable', weight: 3, price: 45, ids: CONSUMABLE_IDS },
      { kind: 'item', weight: 2, price: 110, items: ids(GOOD_ITEMS) },
    ],
  },
];

const leave: DefenderEventOptionDef = { role: 'leave', tier: null, grant: [] };

/**
 * The events, two per shape. **Order is a draw order**: the picker draws among
 * the eligible unused ones in this order.
 */
export const DEFENDER_EVENTS: readonly DefenderEventDef[] = [
  // --- dilemma -------------------------------------------------------------
  {
    id: 'd-wayside-offerings',
    shape: 'dilemma',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'take', tier: 'T1', grant: [{ kind: 'heal', percent: 0.35, target: 'party' }] },
      { role: 'take', tier: 'T1', grant: [{ kind: 'currency', amount: 60 }] },
      {
        role: 'take',
        tier: 'T2',
        cost: [{ kind: 'damage', percent: 0.15, target: 'party' }],
        grant: [{ kind: 'item', pool: ids(GOOD_ITEMS), count: 1 }],
      },
    ],
  },
  {
    id: 'd-abandoned-camp',
    shape: 'dilemma',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'take', tier: 'T1', grant: [{ kind: 'item', pool: BERRY_IDS, count: 2 }] },
      { role: 'take', tier: 'T2', cost: [{ kind: 'discard', count: 1 }], grant: [{ kind: 'item', pool: ids(GOOD_ITEMS), count: 1 }] },
      { role: 'take', tier: 'T1', grant: [{ kind: 'currency', amount: 40 }] },
    ],
  },
  // --- gamble --------------------------------------------------------------
  {
    id: 'd-rigged-wheel',
    shape: 'gamble',
    ranks: { min: 1, max: 7 },
    options: [
      {
        role: 'wager',
        tier: 'T2',
        odds: 0.5,
        grant: [
          { kind: 'item', pool: ids(GOOD_ITEMS), count: 1 },
          { kind: 'currency', amount: 50 },
        ],
        lose: [{ kind: 'damage', percent: 0.2, target: 'party' }],
      },
      leave,
    ],
  },
  {
    id: 'd-shell-game',
    shape: 'gamble',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'wager', tier: 'T1', odds: 0.7, grant: [{ kind: 'currency', amount: 45 }], lose: [{ kind: 'currencyFraction', fraction: 0.15, floor: 10 }] },
      { role: 'wager', tier: 'T3', odds: 0.3, grant: [{ kind: 'currency', amount: 160 }], lose: [{ kind: 'currencyFraction', fraction: 0.35, floor: 25 }] },
      leave,
    ],
  },
  // --- ambush --------------------------------------------------------------
  {
    id: 'd-masked-challengers',
    shape: 'ambush',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'fight', tier: 'T2', grant: [{ kind: 'currency', amount: 80 }] },
      { role: 'pay', tier: 'T1', toll: { kind: 'goldFixed', amount: 40 }, grant: [{ kind: 'item', pool: BERRY_IDS, count: 1 }] },
      leave,
    ],
  },
  {
    id: 'd-sealed-sphere',
    shape: 'ambush',
    ranks: { min: 2, max: 7 },
    options: [
      {
        role: 'fight',
        tier: 'T3',
        grant: [
          { kind: 'item', pool: ids(GOOD_ITEMS), count: 1 },
          { kind: 'currency', amount: 60 },
        ],
      },
      leave,
    ],
  },
  // --- bazaar --------------------------------------------------------------
  // Two faces on one shelf, so a run that draws the shape twice meets two
  // merchants rather than one twice.
  { id: 'd-travelling-bazaar', shape: 'bazaar', ranks: { min: 1, max: 7 }, options: [] },
  { id: 'd-night-market', shape: 'bazaar', ranks: { min: 2, max: 7 }, options: [] },
  // --- shrine --------------------------------------------------------------
  {
    id: 'd-hot-spring',
    shape: 'shrine',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'take', tier: 'T1', grant: [{ kind: 'heal', percent: 0.4, target: 'party' }] },
      { role: 'pay', tier: 'T2', toll: { kind: 'goldFixed', amount: 50 }, grant: [{ kind: 'heal', percent: 1, target: 'party' }] },
      leave,
    ],
  },
  {
    id: 'd-healers-tent',
    shape: 'shrine',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'pay', tier: 'T1', toll: { kind: 'goldFixed', amount: 30 }, grant: [{ kind: 'heal', percent: 1, target: 'lead' }] },
      { role: 'take', tier: 'T1', grant: [{ kind: 'heal', percent: 0.25, target: 'party' }] },
      leave,
    ],
  },
  // --- cache ---------------------------------------------------------------
  {
    id: 'd-forgotten-cache',
    shape: 'cache',
    ranks: { min: 1, max: 7 },
    options: [
      { role: 'take', tier: 'T1', grant: [{ kind: 'consumable', pool: CONSUMABLE_IDS, count: 2 }] },
      { role: 'take', tier: 'T2', grant: [{ kind: 'item', pool: ids(GOOD_ITEMS), count: 1 }] },
    ],
  },
  {
    // The free relic, on rare occasions: the cache's weight is the smallest
    // and this one needs rank 3, so it is the rarest thing a question mark pays.
    id: 'd-dusty-reliquary',
    shape: 'cache',
    ranks: { min: 3, max: 7 },
    options: [
      { role: 'take', tier: 'T3', grant: [{ kind: 'relic', fallback: { kind: 'item', pool: ids(PREMIUM_ITEMS), count: 1 } }] },
      { role: 'take', tier: 'T1', grant: [{ kind: 'item', pool: ids(MODEST_ITEMS), count: 1 }] },
    ],
  },
];

/** The shape weights at `rank`. */
export function defenderEventShapeWeights(rank: number): Readonly<Record<DefenderEventShape, number>> {
  const row = DEFENDER_EVENT_SHAPE_WEIGHTS.find((band) => rank <= band.throughRank) ?? DEFENDER_EVENT_SHAPE_WEIGHTS[DEFENDER_EVENT_SHAPE_WEIGHTS.length - 1];
  if (!row) throw new RangeError('No defender event shape weights defined');
  return row.weights;
}

/** The events of `shape` a question mark at `rank` may be. In table order. */
export function defenderEventsOf(shape: DefenderEventShape, rank: number): readonly DefenderEventDef[] {
  return DEFENDER_EVENTS.filter((event) => event.shape === shape && event.ranks.min <= rank && rank <= event.ranks.max);
}

/** The event with this id, or null. */
export function defenderEventById(id: string): DefenderEventDef | null {
  return DEFENDER_EVENTS.find((event) => event.id === id) ?? null;
}
