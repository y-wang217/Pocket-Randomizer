/**
 * Building a battle. Checkpoint 1 has the layout only: units and enemies on
 * their tiles, every card in the draw pile in deck order, no hand, no
 * telegraph. The shuffle, the starting steps and the first hand join it at
 * checkpoint 2 as `createBattle`.
 */
import { CARDS, DECKS } from '../../cardData/cards';
import { ENCOUNTERS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import type { BattleState, CardInstance } from './state';

/** The unshuffled battle for an encounter, or `null` for an unknown id. */
export function layoutBattle(encounterId: string, seed: string): BattleState | null {
  const encounter = Object.hasOwn(ENCOUNTERS, encounterId) ? ENCOUNTERS[encounterId] : undefined;
  const deck = encounter && Object.hasOwn(DECKS, encounter.deckId) ? DECKS[encounter.deckId] : undefined;
  if (!encounter || !deck) return null;

  const cards: Record<string, CardInstance> = {};
  const draw: string[] = [];
  deck.cards.forEach((def, index) => {
    const iid = `c${index}`;
    cards[iid] = { iid, def, owner: CARDS[def]!.owner };
    draw.push(iid);
  });

  return {
    seed,
    encounterId: encounter.id,
    deckId: deck.id,
    rngDraws: 0,
    round: 0,
    phase: 'plan',
    units: encounter.units.map(({ def, pos }) => ({
      id: def,
      pos: { ...pos },
      hp: UNITS[def].hp,
      maxHp: UNITS[def].hp,
      shield: 0,
      baseShield: UNITS[def].baseShield,
      mp: RULES.mp.start,
      fainted: false,
      pendingMp: [],
    })),
    enemies: encounter.enemies.map(({ def, pos }, spawnIndex) => ({
      id: `e${spawnIndex}`,
      def,
      spawnIndex,
      pos: { ...pos },
      hp: ENEMIES[def].hp,
      shield: 0,
      baseShield: ENEMIES[def].baseShield,
      step: 0,
      intent: null,
    })),
    cards,
    piles: { draw, hand: [], discard: [], spent: [], removed: [] },
    plan: [],
    pendingDraws: [],
  };
}
