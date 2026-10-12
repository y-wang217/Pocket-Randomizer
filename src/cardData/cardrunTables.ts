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
  /** A card can be removed only while the deck holds more than this: two under the starting ten. */
  minDeck: 8,
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
 * third fight a boss. Every fight is three waves (`RUN_FIGHTS`), HP carried
 * between them; the last boss is Siege, three waves ending in the Colossus.
 */
export const ACTS: readonly ActDef[] = [
  { fights: ['run-test', 'run-staggered'], boss: 'run-colossus-lair', townQuests: ['run-bandit-camp', 'run-stray-drones'], defenseQuests: ['run-gatehouse'] },
  { fights: ['run-skirmish', 'run-turret-alley'], boss: 'run-warlord-guard', townQuests: ['run-outriders', 'run-gun-nest'], defenseQuests: ['run-the-walls'] },
  { fights: ['run-the-pack', 'run-wall-and-gun'], boss: 'run-siege', townQuests: ['run-raiders', 'run-warband'], defenseQuests: ['run-last-stand'] },
];

/**
 * The run's starting deck: ten cards that do nothing fancy
 * (`docs/spec/gymrun-card-run-shapes-prompt.md`). Each unit's basic hit and
 * its Brace, two Moves, an Attack and a Dig In.
 */
export const STARTING_DECK: readonly string[] = ['baton', 'brace-a', 'shoot', 'brace-b', 'slash', 'brace-c', 'move', 'move', 'attack', 'dig-in'];

/**
 * The four shapes a deck can grow into (`docs/spec/gymrun-card-run-shapes-prompt.md`,
 * the author's three examples and the Puppeteer). Every reward card belongs to
 * exactly one. A Town's and an ambush's three cards come from three different
 * shapes, so a run chasing one usually sees a card for it.
 */
export type ShapeId = 'puppeteer' | 'bodyguard' | 'escort' | 'control';

export interface ShapeDef {
  id: ShapeId;
  name: string;
  /** The plan, in a line, as the author put it. */
  plan: string;
  cards: readonly string[];
}

export const SHAPES: Readonly<Record<ShapeId, ShapeDef>> = {
  puppeteer: {
    id: 'puppeteer',
    name: 'Puppeteer',
    plan: 'The Commander moves and shields the others',
    // The Puppeteer's cards the starting deck leaves out come back here (133).
    cards: ['call-medic', 'command', 'focus', 'need-help', 'resupply', 'orders', 'fortify', 'rally', 'patch-up'],
  },
  bodyguard: {
    id: 'bodyguard',
    name: 'Bodyguard and Battery',
    plan: 'The Dasher builds tanky and blocks; the Commander only nukes and banks mana',
    cards: ['moon-strike', 'mark-target', 'overcharge', 'second-wind', 'prep', 'guard-up', 'guard-duty'],
  },
  escort: {
    id: 'escort',
    name: 'Escort Artillery',
    plan: 'The Commander walks the Gunner into the danger zone, the Dasher defends, the Gunner lays artillery',
    cards: ['artillery', 'fire', 'volley', 'snipe', 'suppress', 'barrage', 'dash', 'sprint', 'interpose'],
  },
  control: {
    id: 'control',
    name: 'Control and Sweep',
    plan: 'The Gunner runs equipment and holds enemies; the Dasher sweeps them down',
    cards: ['concuss', 'shove', 'cleave', 'whirlwind', 'jab'],
  },
};

/** Every reward card, shape by shape: the Peddler's pool, and what the shapes divide. */
export const TOWN_POOL: readonly string[] = Object.values(SHAPES).flatMap((shape) => shape.cards);

/** The shape a reward card belongs to; `null` for a card no offer draws. */
export function shapeOf(card: string): ShapeDef | null {
  const base = card.endsWith('+') ? card.slice(0, -1) : card;
  return Object.values(SHAPES).find((shape) => shape.cards.includes(base)) ?? null;
}

/** What a City's market sells, at what price in supplies. */
export const MARKET: Readonly<Record<string, number>> = {
  ration: 2,
  'stim-pack': 3,
  sandbags: 2,
  'tower-shield': 3,
  grenade: 3,
  flare: 2,
  flashbang: 3,
  grapple: 3,
  smoke: 3,
  'riot-net': 4,
};

/** A stat a boss upgrade adds to; a talent is offered in its place (`talents.ts`). */
export type BoostKind = Exclude<keyof Required<UnitBoost>, 'talents'>;

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
