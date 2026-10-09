/**
 * The Puppeteer deck: fifteen cards, one copy each. Appendix A, Cards, checked
 * against the author's card sheet (`docs/spec/assets/card-battle-puppeteer-card-sheet.jpg`).
 *
 * Every `type` is `null` until the typed list arrives. A's mana card is
 * unnamed on both; it ships as "Focus", the prompt's placeholder.
 */
import type { CardDef, DeckDef } from '../core/cards/defs';

const card = (def: CardDef): CardDef => def;

export const CARDS: Readonly<Record<string, CardDef>> = {
  'call-medic': card({ id: 'call-medic', name: 'Call Medic', owner: 'A', cost: 1, type: null, effects: [{ k: 'shield', n: 1, to: 'friendly' }] }),
  command: card({ id: 'command', name: 'Command', owner: 'A', cost: 1, type: null, effects: [{ k: 'grantMove', n: 1 }] }),
  focus: card({ id: 'focus', name: 'Focus', owner: 'A', cost: 1, type: null, effects: [{ k: 'mpNextTurns', n: 1, turns: 2 }] }),
  'moon-strike': card({ id: 'moon-strike', name: 'Moon Strike', owner: 'A', cost: 4, type: null, effects: [{ k: 'strike', n: 2 }, { k: 'target', n: 1 }] }),
  shoot: card({ id: 'shoot', name: 'Shoot', owner: 'B', cost: 0, type: null, effects: [{ k: 'strike', n: 1 }] }),
  resupply: card({ id: 'resupply', name: 'Resupply', owner: 'B', cost: 1, type: null, effects: [{ k: 'gainMp', n: 2 }] }),
  artillery: card({ id: 'artillery', name: 'Artillery', owner: 'B', cost: 4, type: null, effects: [{ k: 'blast', n: 2 }, { k: 'target', n: 1 }] }),
  fire: card({ id: 'fire', name: 'Fire!', owner: 'B', cost: 1, type: null, effects: [{ k: 'blast', n: 1 }] }),
  dash: card({ id: 'dash', name: 'Dash', owner: 'C', cost: 1, type: null, effects: [{ k: 'move', n: 2 }] }),
  slash: card({ id: 'slash', name: 'Slash', owner: 'C', cost: 1, type: null, effects: [{ k: 'slash', n: 1 }] }),
  'need-help': card({ id: 'need-help', name: 'Need Help', owner: 'C', cost: 1, type: null, effects: [{ k: 'drawNext', n: 1, filter: 'notOwner' }] }),
  prep: card({ id: 'prep', name: 'Prep', owner: 'C', cost: 1, type: null, effects: [{ k: 'shield', n: 2, to: 'self' }], uses: 1 }),
  move: card({ id: 'move', name: 'Move', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'move', n: 1 }] }),
  'dig-in': card({ id: 'dig-in', name: 'Dig In', owner: 'neutral', cost: 0, type: null, effects: [{ k: 'shield', n: 1, to: 'self' }], uses: 1, face: 'shovel' }),
  attack: card({ id: 'attack', name: 'Attack', owner: 'neutral', cost: 1, type: null, effects: [{ k: 'strike', n: 1 }] }),
  // Part D: not in any deck. The Colossus grants it when its wave arrives.
  harpoon: card({ id: 'harpoon', name: 'Harpoon', owner: 'neutral', cost: 2, type: null, effects: [{ k: 'harpoon', pin: 2, range: 3 }], uses: 2, retain: true, face: 'harpoon' }),
};

export const DECKS: Readonly<Record<string, DeckDef>> = {
  puppeteer: {
    id: 'puppeteer',
    name: 'Puppeteer',
    units: ['A', 'B', 'C'],
    cards: [
      'call-medic', 'command', 'focus', 'moon-strike',
      'shoot', 'resupply', 'artillery', 'fire',
      'dash', 'slash', 'need-help', 'prep',
      'move', 'dig-in', 'attack',
    ],
  },
};
