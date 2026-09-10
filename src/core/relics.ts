/**
 * What the run's relics add up to.
 *
 * Pure, no RNG, no dex. Two jobs: say whether a relic is held, and fold the
 * held set's passives into one set of run-layer numbers.
 *
 * ## One fold, not scattered checks
 *
 * `applyRelicPassives` exists so that no other file ever writes
 * `if (hasRelic(state, 'ironbound-gauntlet'))`. A scattered check is how a
 * relic ends up applying twice in one place and not at all in another, and the
 * bug it produces is a number that is subtly wrong for the rest of a run rather
 * than an error anyone sees.
 *
 * Every passive is additive and order-independent, so the fold is a sum and
 * there is no precedence rule to get wrong when a relic is added. Two relics
 * granting `nodeCurrency` grant the total; holding the same relic twice is not
 * a state the run can reach, and if it somehow were, the fold ignores the
 * duplicate rather than doubling it.
 *
 * ## Unknown ids are ignored, not fatal
 *
 * `relicById` returns null for an id the table does not have, and this file
 * skips it. That case arises from exactly one place — a saved run from a build
 * whose relic table has since changed — and the two version guards already
 * refuse such a log up front. Throwing here as well would turn a guarded,
 * reported failure into an unguarded crash somewhere further in.
 */
import { relicById, type RelicId, type RelicPassive } from '../data/relics';
import type { Capability } from '../data/capabilities';

/**
 * The run-layer numbers the held relics contribute.
 *
 * Deltas, not final values. Nothing here is a tuning number on its own — each
 * field is what relics *add* to one, so a run holding nothing gets this shape
 * with every field at zero and every consumer behaves exactly as it did before
 * relics existed.
 */
export interface RelicEffects {
  /** Percent of max HP restored on entering each node, 0..1. */
  nodeHealPercent: number;
  /** Currency granted per completed battle node. */
  nodeCurrency: number;
  /** Backpack slots on top of `tuning.backpackCapacity`. */
  backpackSlots: number;
  /** Added to `tuning.reviveHpPercent`. */
  reviveBonus: number;
  /** Fraction off shop prices, clamped to 0..1. */
  shopDiscount: number;
}

/** What a run holding no relics gets. Every consumer's unchanged behaviour. */
export const NO_RELIC_EFFECTS: RelicEffects = {
  nodeHealPercent: 0,
  nodeCurrency: 0,
  backpackSlots: 0,
  reviveBonus: 0,
  shopDiscount: 0,
};

/** Whether the run holds this exact relic. */
export function hasRelic(relics: readonly RelicId[], id: RelicId): boolean {
  return relics.includes(id);
}

/** Whether any held relic grants `capability`. This is the `known` band. */
export function grantsCapability(relics: readonly RelicId[], capability: Capability): boolean {
  return relics.some((id) => relicById(id)?.grants === capability);
}

/** Every capability the run has a relic for, in the order the relics were taken. */
export function grantedCapabilities(relics: readonly RelicId[]): Capability[] {
  const granted: Capability[] = [];
  for (const id of relics) {
    const capability = relicById(id)?.grants;
    if (capability && !granted.includes(capability)) granted.push(capability);
  }
  return granted;
}

/**
 * Fold the held relics into their run-layer numbers.
 *
 * Takes the id list rather than a `RunState`, so the fold cannot read anything
 * else about the run and a test can hand it a bare array. Duplicates in the
 * input are ignored rather than summed, which makes the function idempotent in
 * the only sense that matters: the same *set* always folds to the same numbers,
 * however the list is ordered or repeated.
 */
export function applyRelicPassives(relics: readonly RelicId[]): RelicEffects {
  const effects: RelicEffects = { ...NO_RELIC_EFFECTS };

  for (const id of [...new Set(relics)]) {
    const passive = relicById(id)?.passive;
    if (passive) add(effects, passive);
  }

  // Clamped last, once, rather than per relic: two discounts that sum past 1
  // should floor the price at free, not wrap into paying the shop.
  effects.shopDiscount = Math.min(1, Math.max(0, effects.shopDiscount));
  return effects;
}

function add(effects: RelicEffects, passive: RelicPassive): void {
  switch (passive.kind) {
    case 'nodeHeal':
      effects.nodeHealPercent += passive.percent;
      return;
    case 'nodeCurrency':
      effects.nodeCurrency += passive.amount;
      return;
    case 'backpackSlots':
      effects.backpackSlots += passive.count;
      return;
    case 'reviveBonus':
      effects.reviveBonus += passive.percent;
      return;
    case 'shopDiscount':
      effects.shopDiscount += passive.percent;
      return;
    case 'none':
      return;
  }
}
