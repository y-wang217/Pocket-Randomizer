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
import { applyReward, concreteReward, isTargeted, resolveRewardEntry, type Reward } from './rewards';
import type { RelicId } from '../data/relics';
import type { RngStream } from './rng';
import type { RunState } from './run';
import type { NodeSpec } from './encounters';
import { currencyScaleFor, NODE_PAYOUT, priceAt, shopEntriesFor, TIER_PAYOUT } from '../data/shop';
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
export function nodePayout(node: NodeSpec, segment: number): number {
  if (!isBattleKind(node.kind)) return 0;
  const base = NODE_PAYOUT[node.kind];
  const tier = node.tier ? TIER_PAYOUT[node.tier] : TIER_PAYOUT.normal;
  return Math.round(base * tier * currencyScaleFor(segment));
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
}

/**
 * Draw a shop's stock.
 *
 * From the `rewards` stream at map generation, same rule and same reason as a
 * reward offer: drawing at node entry would make the shelf depend on how the
 * player got there.
 *
 * Entries are drawn **with** replacement — a shop selling two different items is
 * good, and forcing five distinct entry kinds would need a bigger table than
 * the shelf — but the *resolved* results are deduplicated, so two rolls of the
 * same heal collapse into one and the shelf is shorter rather than repetitive.
 * The draw count stays fixed either way, which is what keeps the stream
 * position independent of what came out of it.
 */
export function generateShopStock(
  nodeId: string,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): ShopStock {
  const entries = shopEntriesFor(segment);
  const size = stream.inRange(tuning.shopStockSize);

  const items: ShopItem[] = [];
  const seen = new Set<string>();
  const takenItems = new Set<string>();
  const takenMoves = new Set<string>();

  for (let slot = 0; slot < size; slot++) {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    if (total <= 0) break;
    let roll = stream.nextFloat() * total;
    let chosen = entries.filter((entry) => entry.weight > 0).at(-1);
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight);
      if (roll < 0) {
        chosen = entry;
        break;
      }
    }
    if (!chosen) break;

    // A shop sells at `normal` tier bands: the shelf is a function of how far
    // into the run you are, not of the node you fought to get here. A shop node
    // has no tier of its own, so there is nothing else it could use.
    const reward = resolveRewardEntry(chosen, segment, 'normal', stream, takenItems, takenMoves, entries);
    if (!reward) continue;

    const signature = JSON.stringify(reward);
    if (seen.has(signature)) continue;
    seen.add(signature);
    items.push({ reward, price: priceAt(chosen.price, segment) });
  }

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
  if (!stock.items.some((item) => item.reward.kind === 'relic')) return stock;
  return {
    ...stock,
    items: stock.items.map((item) => ({ ...item, reward: concreteReward(item.reward, relics) })),
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
 * `replaceSlot` a 0-based move slot or null when nothing is displaced. It rides
 * with the purchase rather than being asked at application time because
 * `applyPurchases` is a state transition and asking a question is not something
 * a state transition may do.
 */
export interface MovePurchaseChoice {
  target: number;
  replaceSlot: number | null;
}

/**
 * The rewards a basket buys, in the order they are applied.
 *
 * **Shelf order, not click order, and it is shared rather than recomputed.**
 * `applyPurchases` folds them in this order and `playRun` walks the same list to
 * ask who a bought TM goes to — two loops over one ordering. If each derived
 * its own, a basket holding two TMs would answer the questions in one order and
 * apply them in the other, and the second TM would land on the member chosen
 * for the first.
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
  moveChoices: readonly MovePurchaseChoice[] = [],
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
   * From Stage 4.5.1 the order carries a second job: a shop can sell a TM, and
   * a TM needs a recipient and a displaced move like any other taught move.
   * `playRun` asks those questions by walking `purchasedRewards` and hands the
   * answers back here in the same order, so `moveChoices` is consumed
   * positionally against the move rewards in this fold.
   */
  let next: RunState = { ...state, currency: state.currency - cost };
  let move = 0;
  for (const reward of purchasedRewards(stock, indexes)) {
    if (isTargeted(reward)) {
      const choice = moveChoices[move];
      move++;
      if (!choice) {
        throw new RangeError(
          `Shop basket buys a ${reward.kind} but carries no recipient for it. ` +
            'A taught move needs a target and, unless a slot is free, a move to displace.',
        );
      }
      next = applyReward(next, reward, choice.target, choice.replaceSlot);
      continue;
    }
    next = applyReward(next, reward);
  }
  return next;
}
