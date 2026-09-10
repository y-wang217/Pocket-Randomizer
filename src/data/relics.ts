/**
 * Relics: the permanent objects a run accumulates, and the capabilities they
 * grant.
 *
 * A relic is acquired once and held to the end of the run. It cannot be
 * discarded, swapped, sold, lost on a faint, or removed by any path — that is
 * not a convenience, it is the whole point. The engagement pattern this stage
 * exists to produce is the accumulating passive that is not always applicable:
 * an object that does nothing for six fights and wins the seventh is a better
 * object than a move slot that is dead weight in all seven.
 *
 * It is not held by a Pokemon and it does not occupy backpack capacity. It
 * belongs to the run, so it lives in `RunState.relics` rather than on a party
 * member or in the bag.
 *
 * ## Two halves, and why both are here
 *
 * Each relic grants exactly one **capability**, which is what gates events, and
 * one small always-on **passive**, which is what makes it feel like a relic
 * rather than a key. A pure key would be a fine gate and a dull object; the
 * passive is what makes taking the elite node memorable three segments later.
 *
 * ## Passives are declarative, never callbacks
 *
 * Same posture as event outcomes, and for the same two reasons: a passive has
 * to serialize into the log, and the balance simulator has to be able to
 * *score* a relic without executing it. A policy that had to run a function to
 * find out what an object does could not compare two objects, and every relic
 * number in the report would be measuring a coin toss.
 *
 * ## In-battle passives are deliberately absent
 *
 * Every passive here changes a run-layer number. None of them touches damage,
 * speed, or status resolution, because a relic that did would have to reach
 * into the battle driver and the sim spec — a separate pass with its own
 * balance report. `{ kind: 'none' }` exists so a relic can ship as pure
 * capability until that pass lands, and two relics use it rather than being
 * given a passive they did not earn.
 *
 * ## Tuning
 *
 * Every number in this file is a balance number. Ten relics across eight
 * capabilities, so two capabilities carry a spare — deliberate, because it is
 * what exercises the already-held filter and its fallback during real runs
 * rather than only in a test.
 */
import type { Capability } from './capabilities';

export type RelicId = string;

/**
 * One always-on effect, as data.
 *
 * All five numeric kinds are **additive and order-independent**, so two relics
 * granting the same kind sum and `applyRelicPassives` needs no precedence rule.
 * That is a property worth keeping: a precedence rule is a thing to get wrong
 * every time a relic is added.
 */
export type RelicPassive =
  /** Percent of max HP restored on entering each node, 0..1. */
  | { kind: 'nodeHeal'; percent: number }
  /** Currency granted per completed battle node. */
  | { kind: 'nodeCurrency'; amount: number }
  /** Extra backpack slots, on top of `tuning.backpackCapacity`. */
  | { kind: 'backpackSlots'; count: number }
  /** Added to `tuning.reviveHpPercent`, so a faint costs less. */
  | { kind: 'reviveBonus'; percent: number }
  /** Fraction off shop prices, 0..1. */
  | { kind: 'shopDiscount'; percent: number }
  /** Capability and nothing else. Honest, and reserved for the battle pass. */
  | { kind: 'none' };

export interface Relic {
  id: RelicId;
  name: string;
  grants: Capability;
  passive: RelicPassive;
  /**
   * What the player is told. An attribute, never a verdict.
   *
   * Says what the relic does and what it opens. Never "useful", never "strong",
   * never a comparison to another relic — the Part 4 editorial rule applies to
   * a permanent object at least as hard as it applies to a reward card, because
   * this one is on screen for the rest of the run.
   */
  playerDescription: string;
}

export const RELICS: readonly Relic[] = [
  {
    id: 'rusted-machete',
    name: 'Rusted Machete',
    grants: 'cut',
    passive: { kind: 'nodeCurrency', amount: 3 },
    playerDescription: 'Opens the way through anything overgrown. Something turns up in the cleared brush after every fight.',
  },
  {
    id: 'woodsmans-hatchet',
    name: "Woodsman's Hatchet",
    grants: 'cut',
    passive: { kind: 'none' },
    playerDescription: 'Opens the way through anything overgrown.',
  },
  {
    id: 'tidecaller-shell',
    name: 'Tidecaller Shell',
    grants: 'surf',
    passive: { kind: 'nodeHeal', percent: 0.04 },
    playerDescription: 'Carries the party across open water. The sound inside it mends a little at every stop.',
  },
  {
    id: 'ferrymans-oar',
    name: "Ferryman's Oar",
    grants: 'surf',
    passive: { kind: 'nodeCurrency', amount: 4 },
    playerDescription: 'Carries the party across open water. Other travellers pay for the crossing.',
  },
  {
    id: 'ironbound-gauntlet',
    name: 'Ironbound Gauntlet',
    grants: 'strength',
    passive: { kind: 'backpackSlots', count: 1 },
    playerDescription: 'Moves what will not be moved. One more thing fits in the bag while you are wearing it.',
  },
  {
    id: 'prospectors-hammer',
    name: "Prospector's Hammer",
    grants: 'rockSmash',
    passive: { kind: 'nodeCurrency', amount: 5 },
    playerDescription: 'Breaks stone that blocks a path. What falls out of the rubble is worth something.',
  },
  {
    id: 'windrider-feather',
    name: 'Windrider Feather',
    grants: 'fly',
    passive: { kind: 'none' },
    playerDescription: 'Carries the party over anything on the ground.',
  },
  {
    id: 'cascade-talisman',
    name: 'Cascade Talisman',
    grants: 'waterfall',
    passive: { kind: 'reviveBonus', percent: 0.15 },
    playerDescription: 'Climbs water that falls. A Pokemon that goes down comes back with more left in it.',
  },
  {
    id: 'abyssal-lens',
    name: 'Abyssal Lens',
    grants: 'dive',
    passive: { kind: 'shopDiscount', percent: 0.12 },
    playerDescription: 'Goes down where the light stops. Shopkeepers name a lower price when you are holding it.',
  },
  {
    id: 'everburning-lantern',
    name: 'Everburning Lantern',
    grants: 'flash',
    passive: { kind: 'nodeHeal', percent: 0.05 },
    playerDescription: 'Lights a place that has none. The party rests easier near it.',
  },
];

/** Every relic id, in table order. */
export const RELIC_IDS: readonly RelicId[] = RELICS.map((relic) => relic.id);

const BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]));

/** The relic with this id, or null. Null rather than a throw: see `core/relics.ts`. */
export function relicById(id: RelicId): Relic | null {
  return BY_ID.get(id) ?? null;
}

/** Every relic granting `capability`, in table order. */
export function relicsGranting(capability: Capability): readonly Relic[] {
  return RELICS.filter((relic) => relic.grants === capability);
}
