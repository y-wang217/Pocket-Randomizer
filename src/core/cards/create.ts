/**
 * Building a battle. `layoutBattle` is the board before anything is drawn:
 * units and enemies on their tiles, every card in the draw pile in deck order.
 * `createBattle` rolls each enemy's starting step (E6), shuffles, and runs the
 * enemy move, telegraph and next-hand phases once, so the battle opens on
 * round 1 with a hand and every enemy's intent lit.
 */
import { CARDS, DECKS } from '../../cardData/cards';
import { ENCOUNTERS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import { enemyMovesAndTelegraph } from './enemies';
import type { BattleEvent } from './events';
import type { Ctx } from './keywords';
import { nextHand } from './resolve';
import { shuffled, withStream } from './random';
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
      conds: {},
      intent: null,
    })),
    cards,
    piles: { draw, hand: [], discard: [], spent: [], removed: [] },
    plan: [],
    pendingDraws: [],
  };
}

export type CreateResult = { ok: true; state: BattleState; events: BattleEvent[] } | { ok: false; reason: 'unknownEncounter' };

/** A battle ready for its first plan, or a rejection for an unknown encounter. Never throws. */
export function createBattle(encounterId: string, seed: string): CreateResult {
  const s = typeof encounterId === 'string' && typeof seed === 'string' ? layoutBattle(encounterId, seed) : null;
  if (!s) return { ok: false, reason: 'unknownEncounter' };
  const ctx: Ctx = { s, events: [] };
  withStream(s, (stream) => {
    // E6: each enemy's starting step, in spawn order, then the opening shuffle.
    for (const enemy of s.enemies) enemy.step = stream.nextInt(ENEMIES[enemy.def].script.steps.length);
    s.piles.draw = shuffled(stream, s.piles.draw);
  });
  // Battle start runs phases 6, 7 and 8 once, on the rolled step.
  enemyMovesAndTelegraph(ctx, false);
  nextHand(ctx);
  return { ok: true, state: s, events: ctx.events };
}
