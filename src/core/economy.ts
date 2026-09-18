/**
 * The economy: what a node pays, what a shop stocks, and the one rule about
 * spending.
 *
 * Pure, like `randomizer.ts` and `rewards.ts`, and takes an explicit stream.
 * Every number is in `data/shop.ts`; this is the arithmetic and the validation.
 *
 * ## The rule
 *
 * **Currency can never go below zero, and that is enforced here rather than at
 * the shop screen.** A UI that greys out the buttons you cannot afford is a
 * good UI and is not a guarantee: the same purchase arrives from a replayed log
 * and from the balance simulator, neither of which has buttons. So the check
 * lives on the transition, `applyPurchases` refuses a basket it cannot pay for,
 * and the screen's greying-out becomes a courtesy rather than the mechanism.
 *
 * The refusal is a throw rather than a silent skip, and that is deliberate. In
 * a faithful replay an unaffordable purchase is *impossible* — the same seed and
 * the same decisions produce the same balance — so a log that asks for one is a
 * corrupt log, and quietly dropping the item would reconstruct a run the player
 * never played. That is the exact failure the whole replay design exists to
 * prevent.
 */
import { applyReward, concreteReward, newOfferDraw, resolveRewardEntry, type Reward } from './rewards';
import type { RelicId } from '../data/relics';
import { applyRelicPassives, NO_RELIC_EFFECTS, type RelicEffects } from './relics';
import type { RngStream } from './rng';
import type { RunState } from './run';
import type { NodeSpec } from './encounters';
import {
  currencyScaleFor,
  NODE_PAYOUT,
  priceAt,
  shopEntriesFor,
  type ShopEntry,
  shopSlotsFor,
  TIER_PAYOUT,
} from '../data/shop';
import type { BattleKind } from '../data/tuning';
import type { Tuning } from '../data/tuning';

// ---------------------------------------------------------------------------
// Earning
// ---------------------------------------------------------------------------

/** True for the node kinds that pay out. Narrows to `BattleKind` for the table. */
export function isBattleKind(kind: NodeSpec['kind']): kind is BattleKind {
  return kind === 'wild' || kind === 'trainer' || kind === 'gym';
}

/**
 * What winning at this node pays.
 *
 * Kind, then tier, then the segment scale — in that order and all multiplied,
 * so a hard trainer at segment 6 is worth more than a normal one for two
 * separate reasons rather than one compounded one. Rest, shop and event nodes
 * pay nothing and cannot reach the table: `isBattleKind` is what makes that a
 * narrowing rather than a lookup that returns zero.
 *
 * A gym has no tier, so it pays at the `normal` multiplier. That is not a
 * shortfall — a gym's payout is already the largest in the table, and giving it
 * a tier would be the second dial on the segment's difficulty that
 * `generateGymTeam` refuses for the same reason.
 */
export function nodePayout(
  node: NodeSpec,
  segment: number,
  /**
   * What the run's relics add to a cleared battle node. **Flat, and added
   * after the scale**, because it is a flat number on the card — "something
   * turns up in the cleared brush after every fight" — rather than a share of
   * the purse, and scaling it would make an early relic worth a fraction of a
   * late one for no reason the player could read.
   *
   * Nothing is added to a node that is not a fight, because the passive is per
   * *battle* node and the early return below is what says so.
   */
  effects: RelicEffects = NO_RELIC_EFFECTS,
): number {
  if (!isBattleKind(node.kind)) return 0;
  const base = NODE_PAYOUT[node.kind];
  const tier = node.tier ? TIER_PAYOUT[node.tier] : TIER_PAYOUT.normal;
  return Math.round(base * tier * currencyScaleFor(segment)) + Math.max(0, effects.nodeCurrency);
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/** One thing on a shop's shelf: what it is, and what it costs here. */
export interface ShopItem {
  reward: Reward;
  /** Already scaled to the segment. The number the player is shown. */
  price: number;
}

/** A shop node's shelf, drawn when the map was built. */
export interface ShopStock {
  nodeId: string;
  segment: number;
  items: ShopItem[];
  /**
   * The shop discount already taken off these prices, or absent on a shelf as
   * it was drawn. **Present so that resolving twice is not charging twice.**
   *
   * `resolveStock` is idempotent by contract — `playRun` resolves a shop to
   * ask what to buy and the stock travels on to be applied — and a discount is
   * the first thing it ever did that would compound. The stamp is what makes
   * the second call a no-op on price rather than a second markdown.
   *
   * Not logged, and it does not need to be: a run log stores shelf indexes, so
   * a replay re-derives the shelf and re-resolves it against the relics the
   * replayed run holds at that node.
   */
  discount?: number;
}

/**
 * Draw a shop's stock.
 *
 * From the `rewards` stream at map generation, same rule and same reason as a
 * reward offer: drawing at node entry would make the shelf depend on how the
 * player got there.
 *
 * **One draw per guaranteed category, then `shopExtraSlots` free rows.** It was
 * one weighted walk over a single flat table, repeated a drawn number of times,
 * and a shelf could legally come back as three heals — `data/shop.ts` carries
 * the argument for why that is not a shop. Each category now rolls *within
 * itself*, so the question a slot asks is "which heal" rather than "a heal at
 * all", and the extra rows on top are still the old free-for-all.
 *
 * Every slot draws exactly once whether or not it has anything to choose
 * between: a single-entry category still spends its `nextFloat`. That is the
 * same discipline `rollMoveset` follows, and the same reason — retuning a
 * weight, or giving a category a second price point, must never change how many
 * times the stream is read, or every roll after it in the seed moves with it.
 *
 * The *resolved* results are deduplicated, so an extra row that repeats a
 * guaranteed one collapses and the shelf is shorter rather than repetitive.
 * The draw count stays fixed either way, which is what keeps the stream
 * position independent of what came out of it.
 */
export function generateShopStock(
  nodeId: string,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): ShopStock {
  const slots = shopSlotsFor(segment);
  const entries = shopEntriesFor(segment);
  const extra = stream.inRange(tuning.shopExtraSlots);

  const items: ShopItem[] = [];
  const seen = new Set<string>();
  /*
   * **A shelf keeps distinctness the same way an offer does, and since R19
   * that is one object rather than two sets.** A shop is not a three-card
   * offer — its rows are one per category and duplicates are caught by
   * `seen` — so `OfferDraw.kinds` does nothing here beyond being stamped. What
   * it does buy is that a relic on the shelf resolves its fallback under the
   * same rule a relic card does, which is the point of a shop drawing through
   * `resolveRewardEntry` at all.
   */
  const taken = newOfferDraw();

  /** One weighted pick from `from`. Always exactly one draw. */
  const choose = (from: readonly ShopEntry[]): ShopEntry | null => {
    const total = from.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    // The draw happens before the guard so that an empty or zero-weight list —
    // a data bug, not a path — costs the stream the same as a full one.
    const roll = stream.nextFloat() * (total > 0 ? total : 1);
    if (total <= 0) return null;
    let remaining = roll;
    for (const entry of from) {
      remaining -= Math.max(0, entry.weight);
      if (remaining < 0) return entry;
    }
    return from.filter((entry) => entry.weight > 0).at(-1) ?? null;
  };

  const stock = (chosen: ShopEntry | null): void => {
    if (!chosen) return;
    // A shop sells at `normal` tier bands: the shelf is a function of how far
    // into the run you are, not of the node you fought to get here. A shop node
    // has no tier of its own, so there is nothing else it could use.
    const reward = resolveRewardEntry(chosen, segment, 'normal', stream, taken, entries);
    if (!reward) return;

    const signature = JSON.stringify(reward);
    if (seen.has(signature)) return;
    seen.add(signature);
    items.push({ reward, price: priceAt(chosen.price, segment) });
  };

  for (const slot of slots) stock(choose(slot.entries));
  for (let row = 0; row < extra; row++) stock(choose(entries));

  return { nodeId, segment, items };
}

/**
 * A shelf with every relic collapsed against what the run already holds.
 *
 * The shop's half of `resolveOffer`, and it exists for the same reason: a
 * relic card is drawn abstract at map generation, and the shelf a player is
 * shown has to be the shelf that gets charged for. `playRun` calls this once
 * and puts the result on the `NodeResult`, because a shop is read twice — once
 * to ask what to buy and once to apply it — and resolving separately at each
 * site is how the two would come to disagree the day a player buys a relic and
 * the second resolution skips past it.
 *
 * Pure, no RNG, idempotent, and returns the stock unchanged when no relic is
 * on the shelf.
 */
export function resolveStock(stock: ShopStock, relics: readonly RelicId[]): ShopStock {
  /*
   * **Two resolutions against the held set, not one, and both belong here.**
   *
   * The relic card has always collapsed here. The shop discount now applies
   * here too, for the same argument the comment above makes about doing it
   * once: `playRun` resolves a shop twice — once to ask what to buy and once
   * to apply it — and a price that was discounted on the screen and charged
   * undiscounted at the till is the shape that argument exists to prevent.
   *
   * The discounted price is the one the player is shown, so `basketCost`,
   * `canAfford` and `applyPurchases` all read it without knowing a relic was
   * involved. `applyRelicPassives` already clamps the discount to 0..1, so a
   * stack of discounts floors the price at free rather than paying the shop.
   */
  const effects = applyRelicPassives(relics);
  const cards = stock.items.some((item) => item.reward.kind === 'relic');
  // Priced already, by an earlier call on this same shelf. The stamp is the
  // whole of what keeps this function idempotent now that it changes prices.
  const priced = stock.discount !== undefined;
  const cut = priced ? 0 : effects.shopDiscount;
  if (!cards && cut <= 0) return priced ? stock : { ...stock, discount: 0 };
  return {
    ...stock,
    discount: priced ? stock.discount : effects.shopDiscount,
    items: stock.items.map((item) => ({
      reward: cards ? concreteReward(item.reward, relics) : item.reward,
      price: Math.max(0, Math.round(item.price * (1 - cut))),
    })),
  };
}

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------

/** What a basket costs. Public so a screen can total it before committing. */
export function basketCost(stock: ShopStock, indexes: readonly number[]): number {
  return indexes.reduce((total, index) => {
    const item = stock.items[index];
    if (!item) throw new RangeError(`Shop slot ${index} does not exist (${stock.items.length} on the shelf)`);
    return total + item.price;
  }, 0);
}

/** Whether this basket is affordable right now. */
export function canAfford(state: RunState, stock: ShopStock, indexes: readonly number[]): boolean {
  return basketCost(stock, indexes) <= state.currency;
}

/**
 * Buy a basket. Throws rather than overdrawing, and rejects the whole basket.
 *
 * Whole-basket rather than item-by-item, because a partial purchase is a
 * decision nobody made: a player who selected three things and could afford two
 * of them has not told anyone *which* two. The screen prevents it, the
 * simulator's policy prevents it, and this refuses it — which means the run log
 * only ever records baskets that were paid for in full.
 *
 * Duplicates in `indexes` are rejected for the same reason: buying shelf slot 2
 * twice is one item and two charges, and the version of that which "works" is
 * the version that silently overcharges.
 */
/**
 * Who a bought TM goes to, and what it costs them.
 *
 * The same pair `playRun` records for a reward card — `target` a party slot,
/**
 * The rewards a basket buys, in the order they are applied.
 *
 * **Shelf order, not click order.** A basket is a set and not a sequence, so
 * two players who tapped the same three things in different orders buy the same
 * three things.
 *
 * The second job this ordering used to carry is gone: a bought TM needed a
 * recipient and a displaced move, `playRun` walked this same list to ask, and
 * the answers came back positionally. A TM goes into the bag now, so there is
 * one loop over this ordering rather than two that had to agree.
 */
export function purchasedRewards(stock: ShopStock, indexes: readonly number[]): Reward[] {
  return [...indexes]
    .sort((a, b) => a - b)
    .flatMap((index) => {
      const item = stock.items[index];
      return item ? [item.reward] : [];
    });
}

export function applyPurchases(
  state: RunState,
  stock: ShopStock,
  indexes: readonly number[],
): RunState {
  if (indexes.length === 0) return state;
  if (new Set(indexes).size !== indexes.length) {
    throw new RangeError(`Shop basket buys the same slot twice: [${indexes.join(', ')}]`);
  }

  const cost = basketCost(stock, indexes);
  if (cost > state.currency) {
    throw new RangeError(
      `Shop basket costs ${cost} but the run holds ${state.currency}. ` +
        'Currency may never go negative, including through a replayed log.',
    );
  }

  /*
   * Applied in shelf order rather than in the order the player clicked, so a
   * basket is a set and not a sequence.
   *
   * Every kind folds the same way now. A bought TM used to branch here on
   * `isTargeted` and consume a recipient answer positionally, which made the
   * shop the one place where the reward fold had to agree with a second loop
   * somewhere else about what order it was walking in. It pays a TM into the
   * bag like a card does, so the branch and the agreement are both gone.
   */
  let next: RunState = { ...state, currency: state.currency - cost };
  for (const reward of purchasedRewards(stock, indexes)) {
    next = applyReward(next, reward);
  }
  return next;
}
