/**
 * The card run's cards (`docs/spec/gymrun-card-run-prompt.md`): what a Town
 * quest offers, what a City sells, and the upgrade of every card that has
 * one. Built from the engine's existing effect vocabulary only, so nothing
 * here needs a resolver of its own.
 *
 * Every number is provisional, a first draft for the author to playtest
 * (`docs/generation.md` 125r). `cards.ts` merges this table into `CARDS`, so
 * the engine looks a run card up the same way as a Puppeteer card.
 */
import type { CardDef } from '../core/cards/defs';

const card = (def: CardDef): CardDef => def;

/** New cards: a Town quest's reward offers three of these. */
const TOWN: Readonly<Record<string, CardDef>> = {
  fortify: card({ id: 'fortify', name: 'Fortify', owner: 'A', cost: 2, type: null, effects: [{ k: 'shield', n: 2, to: 'friendly' }] }),
  orders: card({ id: 'orders', name: 'Orders', owner: 'A', cost: 2, type: null, effects: [{ k: 'grantMove', n: 2 }] }),
  snipe: card({ id: 'snipe', name: 'Snipe', owner: 'B', cost: 2, type: null, effects: [{ k: 'pierce', n: 2 }] }),
  volley: card({ id: 'volley', name: 'Volley', owner: 'B', cost: 2, type: null, effects: [{ k: 'blast', n: 1 }, { k: 'target', n: 1 }] }),
  cleave: card({ id: 'cleave', name: 'Cleave', owner: 'C', cost: 2, type: null, effects: [{ k: 'slash', n: 2 }] }),
  'guard-up': card({ id: 'guard-up', name: 'Guard Up', owner: 'C', cost: 0, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }] }),
  sprint: card({ id: 'sprint', name: 'Sprint', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'move', n: 2 }] }),
  jab: card({ id: 'jab', name: 'Jab', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'strike', n: 1 }] }),
};

/**
 * Equipment: use once, then gone from the run's deck for good. A City's
 * market sells it for supplies; a ? event can hand one over. Neutral and free
 * to play, so whoever holds the slot can use it.
 */
const EQUIPMENT: Readonly<Record<string, CardDef>> = {
  ration: card({ id: 'ration', name: 'Ration', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'gainMp', n: 2 }], uses: 1, equipment: true }),
  'stim-pack': card({ id: 'stim-pack', name: 'Stim Pack', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'mpNextTurns', n: 1, turns: 3 }], uses: 1, equipment: true }),
  sandbags: card({ id: 'sandbags', name: 'Sandbags', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'shield', n: 2, to: 'friendly' }], uses: 1, equipment: true }),
  'tower-shield': card({ id: 'tower-shield', name: 'Tower Shield', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'shield', n: 3, to: 'self' }], uses: 1, equipment: true }),
  grenade: card({ id: 'grenade', name: 'Grenade', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'blast', n: 2 }], uses: 1, equipment: true }),
  flare: card({ id: 'flare', name: 'Flare', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'drawNext', n: 2, filter: 'notOwner' }], uses: 1, equipment: true }),
};

/** One upgrade per card: the same card, better. It wears its base card's art and keeps its owner. */
const up = (base: CardDef, change: Partial<Pick<CardDef, 'cost' | 'effects'>>): CardDef => ({
  ...base,
  ...change,
  id: `${base.id}+`,
  name: `${base.name}+`,
  art: base.art ?? base.id,
});

/** The upgrades of the Puppeteer's cards and the Town's, keyed by the card they upgrade. */
export function upgradesOf(cards: Readonly<Record<string, CardDef>>): Record<string, CardDef> {
  const c = (id: string): CardDef => cards[id]!;
  const list: CardDef[] = [
    up(c('call-medic'), { effects: [{ k: 'shield', n: 2, to: 'friendly' }] }),
    up(c('command'), { effects: [{ k: 'grantMove', n: 2 }] }),
    up(c('focus'), { effects: [{ k: 'mpNextTurns', n: 1, turns: 3 }] }),
    up(c('moon-strike'), { cost: 3 }),
    up(c('shoot'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('resupply'), { effects: [{ k: 'gainMp', n: 3 }] }),
    up(c('artillery'), { cost: 3 }),
    up(c('fire'), { effects: [{ k: 'blast', n: 2 }] }),
    up(c('dash'), { cost: 0 }),
    up(c('slash'), { effects: [{ k: 'slash', n: 2 }] }),
    up(c('need-help'), { effects: [{ k: 'drawNext', n: 2, filter: 'notOwner' }] }),
    up(c('prep'), { effects: [{ k: 'shield', n: 3, to: 'self' }] }),
    up(c('move'), { effects: [{ k: 'move', n: 2 }] }),
    up(c('dig-in'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('attack'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('fortify'), { cost: 1 }),
    up(c('orders'), { cost: 1 }),
    up(c('snipe'), { effects: [{ k: 'pierce', n: 3 }] }),
    up(c('volley'), { effects: [{ k: 'blast', n: 2 }, { k: 'target', n: 1 }] }),
    up(c('cleave'), { effects: [{ k: 'slash', n: 3 }] }),
    up(c('guard-up'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('sprint'), { cost: 0 }),
    up(c('jab'), { effects: [{ k: 'strike', n: 2 }] }),
  ];
  return Object.fromEntries(list.map((def) => [def.id, def]));
}

export const TOWN_CARDS = TOWN;
export const EQUIPMENT_CARDS = EQUIPMENT;
