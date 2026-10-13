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

/**
 * The card run's starting deck's own cards (`cardrunTables.ts` `STARTING_DECK`):
 * a basic hit for the Commander and a Brace for each unit, nothing fancy
 * (`docs/spec/gymrun-card-run-shapes-prompt.md`). A Brace is one card per
 * owner so each unit holds its own; all three read "Brace".
 */
const BASIC: Readonly<Record<string, CardDef>> = {
  baton: card({ id: 'baton', name: 'Baton', owner: 'A', cost: 1, type: null, effects: [{ k: 'strike', n: 1 }], art: 'attack' }),
  // The Commander's MP, as a card instead of a passive (the author's ruling of 2026-10-13):
  // free, once a wave, and spendable by the cards the plan plays after it.
  spark: card({ id: 'spark', name: 'Spark', owner: 'A', cost: 0, type: null, effects: [{ k: 'gainMpNow', n: 1 }], uses: 1, art: 'resupply' }),
  'brace-a': card({ id: 'brace-a', name: 'Brace', owner: 'A', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }], art: 'prep' }),
  'brace-b': card({ id: 'brace-b', name: 'Brace', owner: 'B', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }], art: 'prep' }),
  'brace-c': card({ id: 'brace-c', name: 'Brace', owner: 'C', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }], art: 'prep' }),
};

/** New cards: a Town quest's reward offers three of these. */
const TOWN: Readonly<Record<string, CardDef>> = {
  fortify: card({ id: 'fortify', name: 'Fortify', owner: 'A', cost: 2, type: null, effects: [{ k: 'shield', n: 2, to: 'friendly' }] }),
  orders: card({ id: 'orders', name: 'Orders', owner: 'A', cost: 2, type: null, effects: [{ k: 'grantMove', n: 2 }] }),
  snipe: card({ id: 'snipe', name: 'Snipe', owner: 'B', cost: 2, type: null, effects: [{ k: 'pierce', n: 2 }] }),
  volley: card({ id: 'volley', name: 'Volley', owner: 'B', cost: 2, type: null, effects: [{ k: 'blast', n: 1 }, { k: 'target', n: 1 }] }),
  cleave: card({ id: 'cleave', name: 'Cleave', owner: 'C', cost: 2, type: null, effects: [{ k: 'slash', n: 2 }] }),
  'guard-up': card({ id: 'guard-up', name: 'Guard Up', owner: 'C', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }] }),
  sprint: card({ id: 'sprint', name: 'Sprint', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'move', n: 2 }] }),
  jab: card({ id: 'jab', name: 'Jab', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'strike', n: 1 }] }),
  // Group A (`docs/spec/gymrun-card-run-shapes-prompt.md`, checkpoint 3).
  // Whirlwind is the Dasher's first ult. Both it and Rally are a move with a
  // follow-up, as first drafted, since checkpoint 4b taught the engine one.
  whirlwind: card({ id: 'whirlwind', name: 'Whirlwind', owner: 'C', cost: 3, type: null, effects: [{ k: 'move', n: 1 }, { k: 'slash', n: 3 }], ult: true, art: 'slash' }),
  rally: card({ id: 'rally', name: 'Rally', owner: 'A', cost: 2, type: null, effects: [{ k: 'grantMove', n: 1 }, { k: 'shield', n: 1, to: 'friendly' }], art: 'command' }),
  'mark-target': card({ id: 'mark-target', name: 'Mark Target', owner: 'A', cost: 1, type: null, effects: [{ k: 'strike', n: 1 }, { k: 'target', n: 1 }], art: 'moon-strike' }),
  suppress: card({ id: 'suppress', name: 'Suppress', owner: 'B', cost: 3, type: null, effects: [{ k: 'blast', n: 1 }, { k: 'target', n: 1 }, { k: 'shield', n: 1, to: 'self' }], art: 'fire' }),
  'second-wind': card({ id: 'second-wind', name: 'Second Wind', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'gainMp', n: 1 }, { k: 'drawNext', n: 1, filter: 'notOwner' }], art: 'resupply' }),
  // Group B (checkpoint 4): the four effects that were reserved, each with its resolver now.
  shove: card({ id: 'shove', name: 'Shove', owner: 'C', cost: 1, type: null, effects: [{ k: 'slash', n: 1 }, { k: 'push', n: 1 }], art: 'dash' }),
  'patch-up': card({ id: 'patch-up', name: 'Patch Up', owner: 'A', cost: 2, type: null, effects: [{ k: 'repair', n: 1 }], art: 'call-medic' }),
  // Checkpoint 5a: Cover and Stun.
  'guard-duty': card({ id: 'guard-duty', name: 'Guard Duty', owner: 'C', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }, { k: 'cover', n: 1 }], art: 'prep' }),
  concuss: card({ id: 'concuss', name: 'Concuss', owner: 'B', cost: 2, type: null, effects: [{ k: 'strike', n: 1 }, { k: 'stun', n: 1 }], art: 'shoot' }),
  // Checkpoint 5b: a card for each shape that had none of its own yet.
  // The Commander's nuke, for "only nukes and mana".
  overcharge: card({ id: 'overcharge', name: 'Overcharge', owner: 'A', cost: 3, type: null, effects: [{ k: 'strike', n: 3 }], art: 'moon-strike' }),
  // The Gunner's massive artillery, from the danger zone the others walk it into.
  // Most of the shared pool: every ult is 3 at most since the shared mana ruling.
  barrage: card({ id: 'barrage', name: 'Barrage', owner: 'B', cost: 3, type: null, effects: [{ k: 'blast', n: 3 }], ult: true, art: 'artillery' }),
  // Floor 2 (2026-10-13): lifts what the floor's enemies leave, for the whole team.
  cleanse: card({ id: 'cleanse', name: 'Cleanse', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'cleanse', n: 2 }] }),
  // The Dasher steps beside the one it defends.
  interpose: card({ id: 'interpose', name: 'Interpose', owner: 'C', cost: 1, type: null, effects: [{ k: 'move', n: 1 }, { k: 'cover', n: 1 }], art: 'dash' }),
};

/**
 * Equipment: use once, then gone from the run's deck for good. A City's
 * market sells it for supplies; a ? event can hand one over. Neutral and free
 * to play, so whoever holds the slot can use it.
 */
const EQUIPMENT: Readonly<Record<string, CardDef>> = {
  ration: card({ id: 'ration', name: 'Ration', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'gainMp', n: 2 }], uses: 1, equipment: true }),
  'stim-pack': card({ id: 'stim-pack', name: 'Stim Pack', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'mpNextTurns', n: 1, turns: 3 }], uses: 1, equipment: true }),
  sandbags: card({ id: 'sandbags', name: 'Sandbags', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'shield', n: 2, to: 'friendly' }], uses: 1, equipment: true }),
  'tower-shield': card({ id: 'tower-shield', name: 'Tower Shield', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'shield', n: 3, to: 'self' }], uses: 1, equipment: true }),
  grenade: card({ id: 'grenade', name: 'Grenade', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'blast', n: 2 }], uses: 1, equipment: true }),
  flare: card({ id: 'flare', name: 'Flare', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'drawNext', n: 2, filter: 'notOwner' }], uses: 1, equipment: true }),
  // Group A, checkpoint 3.
  flashbang: card({ id: 'flashbang', name: 'Flashbang', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'blast', n: 1 }, { k: 'drawNext', n: 1, filter: 'notOwner' }], uses: 1, equipment: true }),
  // Group B, checkpoint 4.
  grapple: card({ id: 'grapple', name: 'Grapple', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'pull', n: 2 }], uses: 1, equipment: true, face: 'harpoon' }),
  smoke: card({ id: 'smoke', name: 'Smoke', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'stealth', n: 1 }], uses: 1, equipment: true }),
  // Checkpoint 5b: crowd control for the Gunner's equipment.
  // Floor 2 (2026-10-13): the City's cure for Root and Frail, once, for the run.
  antidote: card({ id: 'antidote', name: 'Antidote', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'cleanse', n: 9 }], uses: 1, equipment: true }),
  'riot-net': card({ id: 'riot-net', name: 'Riot Net', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'blast', n: 1 }, { k: 'stun', n: 1 }], uses: 1, equipment: true }),
};

/** One upgrade per card: the same card, better. It wears its base card's art and keeps its owner. */
const up = (base: CardDef, change: Partial<Pick<CardDef, 'cost' | 'effects' | 'uses'>>): CardDef => ({
  ...base,
  ...change,
  id: `${base.id}+`,
  name: `${base.name}+`,
  art: base.art ?? base.id,
});

/** The upgrades of the Puppeteer's cards, the basic deck's and the Town's, keyed by the card they upgrade. */
export function upgradesOf(cards: Readonly<Record<string, CardDef>>): Record<string, CardDef> {
  const c = (id: string): CardDef => cards[id]!;
  const list: CardDef[] = [
    // Spark+ fires twice a wave rather than paying more at once.
    up(c('spark'), { uses: 2 }),
    up(c('call-medic'), { effects: [{ k: 'shield', n: 2, to: 'friendly' }] }),
    up(c('command'), { effects: [{ k: 'grantMove', n: 2 }] }),
    up(c('focus'), { effects: [{ k: 'mpNextTurns', n: 1, turns: 3 }] }),
    up(c('moon-strike'), { cost: 2 }),
    up(c('shoot'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('resupply'), { effects: [{ k: 'gainMp', n: 3 }] }),
    up(c('artillery'), { cost: 2 }),
    up(c('fire'), { effects: [{ k: 'blast', n: 2 }] }),
    // No card is free since the no-free-cards ruling: the upgrades that made one free go further instead.
    up(c('dash'), { effects: [{ k: 'move', n: 3 }] }),
    up(c('slash'), { effects: [{ k: 'slash', n: 2 }] }),
    up(c('need-help'), { effects: [{ k: 'drawNext', n: 2, filter: 'notOwner' }] }),
    up(c('prep'), { effects: [{ k: 'shield', n: 3, to: 'self' }] }),
    up(c('move'), { effects: [{ k: 'move', n: 2 }] }),
    up(c('dig-in'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('attack'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('baton'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('brace-a'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('brace-b'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('brace-c'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('fortify'), { cost: 1 }),
    up(c('orders'), { cost: 1 }),
    up(c('snipe'), { effects: [{ k: 'pierce', n: 3 }] }),
    up(c('volley'), { effects: [{ k: 'blast', n: 2 }, { k: 'target', n: 1 }] }),
    up(c('cleave'), { effects: [{ k: 'slash', n: 3 }] }),
    up(c('guard-up'), { effects: [{ k: 'shield', n: 2, to: 'self' }] }),
    up(c('sprint'), { effects: [{ k: 'move', n: 3 }] }),
    up(c('jab'), { effects: [{ k: 'strike', n: 2 }] }),
    up(c('whirlwind'), { cost: 2 }),
    up(c('rally'), { cost: 1 }),
    up(c('mark-target'), { effects: [{ k: 'strike', n: 2 }, { k: 'target', n: 1 }] }),
    up(c('suppress'), { effects: [{ k: 'blast', n: 1 }, { k: 'target', n: 1 }, { k: 'shield', n: 2, to: 'self' }] }),
    up(c('second-wind'), { effects: [{ k: 'gainMp', n: 2 }, { k: 'drawNext', n: 1, filter: 'notOwner' }] }),
    up(c('shove'), { effects: [{ k: 'slash', n: 1 }, { k: 'push', n: 2 }] }),
    up(c('patch-up'), { effects: [{ k: 'repair', n: 2 }] }),
    up(c('guard-duty'), { effects: [{ k: 'shield', n: 2, to: 'self' }, { k: 'cover', n: 1 }] }),
    up(c('concuss'), { effects: [{ k: 'strike', n: 2 }, { k: 'stun', n: 1 }] }),
    up(c('overcharge'), { cost: 2 }),
    up(c('barrage'), { cost: 2 }),
    up(c('cleanse'), { effects: [{ k: 'cleanse', n: 3 }] }),
    up(c('interpose'), { effects: [{ k: 'move', n: 2 }, { k: 'cover', n: 1 }] }),
  ];
  return Object.fromEntries(list.map((def) => [def.id, def]));
}

export const BASIC_CARDS = BASIC;
export const TOWN_CARDS = TOWN;
export const EQUIPMENT_CARDS = EQUIPMENT;
