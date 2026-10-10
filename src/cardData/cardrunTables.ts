/**
 * The card run's tables (`docs/spec/gymrun-card-run-prompt.md`): its acts,
 * what each stop pays, what the market sells, the ? events and the boss
 * upgrades. Every number a tuning pass would touch is here, none in
 * `core/cards/cardrun.ts`. All of it is a first draft for a playtest
 * (`docs/generation.md` 125r).
 */
import type { UnitBoost, UnitDefId } from '../core/cards/defs';

export const RUN_RULES = {
  /** Supplies, the run's currency: at the start, for each main fight won, for each boss. */
  supplies: { start: 0, fight: 2, boss: 4 },
  /** What the camp charges to upgrade one card. */
  upgradePrice: 4,
  /**
   * The Wild pays at least `upgradePrice`, so one Wild always buys an upgrade
   * (the prompt's guarantee), and rolls a ? event at `eventChance`.
   */
  wild: { supplies: { min: 4, max: 6 }, eventChance: 0.5 },
  /** A Town quest pays supplies on top of its card. */
  town: { supplies: { min: 2, max: 3 } },
  /** Every offer is three distinct options (`CLAUDE.md`, Rewards). */
  offer: 3,
  /** A card can be removed only while the deck holds more than this. */
  minDeck: 10,
} as const;

/** One act: two main fights, then its boss. A stop sits between every two fights. */
export interface ActDef {
  fights: readonly [string, string];
  boss: string;
  /** What a Town quest and a ? ambush fight in this act, drawn from at generation. */
  townQuests: readonly string[];
  /** What a City's defense quest fights in this act. */
  defenseQuests: readonly string[];
}

/**
 * The scenarios stitched into a row, each act harder than the last, every
 * third fight a boss. The last boss is Siege: three waves ending in the
 * Colossus.
 */
export const ACTS: readonly ActDef[] = [
  { fights: ['test', 'staggered'], boss: 'colossus-lair', townQuests: ['bandit-camp', 'stray-drones'], defenseQuests: ['gatehouse'] },
  { fights: ['skirmish', 'turret-alley'], boss: 'colossus-escort', townQuests: ['outriders', 'gun-nest'], defenseQuests: ['the-walls'] },
  { fights: ['the-pack', 'wall-and-gun'], boss: 'siege', townQuests: ['raiders', 'warband'], defenseQuests: ['last-stand'] },
];

/** What a Town quest's card offer draws from. */
export const TOWN_POOL: readonly string[] = ['fortify', 'orders', 'snipe', 'volley', 'cleave', 'guard-up', 'sprint', 'jab'];

/** What a City's market sells, at what price in supplies. */
export const MARKET: Readonly<Record<string, number>> = {
  ration: 2,
  'stim-pack': 3,
  sandbags: 2,
  'tower-shield': 3,
  grenade: 3,
  flare: 2,
};

export type BoostKind = keyof Required<UnitBoost>;

/** How much one boss upgrade adds, by kind. */
export const BOOST_AMOUNT: Readonly<Record<BoostKind, number>> = { slots: 1, hp: 1, baseShield: 1, mp: 1 };

/**
 * The boss upgrade's kinds and their weights. A card slot, the prompt's
 * example of the most impactful, is drawn most often.
 */
export const BOOST_WEIGHTS: Readonly<Record<BoostKind, number>> = { slots: 3, hp: 1, baseShield: 1, mp: 1 };

/** The units a boss upgrade is offered for, one offer each, in this order. */
export const BOOST_UNITS: readonly UnitDefId[] = ['A', 'B', 'C'];

/**
 * What a ? event option does. `equipment`, `card` and `fight` take what the
 * Wild drew for them at generation; `upgrade` and `remove` ask the player
 * which card.
 */
export type EventEffect =
  | { k: 'supplies'; n: number }
  | { k: 'equipment' }
  | { k: 'card' }
  | { k: 'upgrade' }
  | { k: 'remove' }
  | { k: 'fight' };

export interface EventOption {
  label: string;
  /** A price in supplies: charged, or the option is disabled (`CLAUDE.md`, Prices). */
  price?: number;
  effects: readonly EventEffect[];
}

export interface EventDef {
  id: string;
  name: string;
  text: string;
  options: readonly EventOption[];
}

export const EVENTS: Readonly<Record<string, EventDef>> = {
  cache: {
    id: 'cache',
    name: 'Abandoned Cache',
    text: 'A crate under a tarp, half buried. There is room to carry one thing.',
    options: [
      { label: 'Take the supplies (+3)', effects: [{ k: 'supplies', n: 3 }] },
      { label: 'Take the equipment', effects: [{ k: 'equipment' }] },
    ],
  },
  smith: {
    id: 'smith',
    name: 'Wandering Smith',
    text: 'A smith by the road offers to sharpen one card for nothing.',
    options: [
      { label: 'Upgrade a card', effects: [{ k: 'upgrade' }] },
      { label: 'Move on', effects: [] },
    ],
  },
  shrine: {
    id: 'shrine',
    name: 'Quiet Shrine',
    text: 'Leave a card at the shrine and travel lighter.',
    options: [
      { label: 'Leave a card', effects: [{ k: 'remove' }] },
      { label: 'Move on', effects: [] },
    ],
  },
  peddler: {
    id: 'peddler',
    name: 'Peddler',
    text: 'A peddler has one card for sale, face up.',
    options: [
      { label: 'Buy the card', price: 2, effects: [{ k: 'card' }] },
      { label: 'Move on', effects: [] },
    ],
  },
  ambush: {
    id: 'ambush',
    name: 'Ambush',
    text: 'Raiders block the trail. Fight them for their loot, or pay them off.',
    options: [
      { label: 'Fight', effects: [{ k: 'fight' }] },
      { label: 'Pay them off', price: 3, effects: [] },
    ],
  },
};
