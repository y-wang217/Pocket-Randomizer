/**
 * Building a battle. `layoutBattle` is the board before anything is drawn:
 * units on their default tiles, enemies the encounter places on theirs, every
 * card in the draw pile in deck order. An enemy the encounter does not place
 * has no tile yet.
 *
 * `createBattle` makes every draw the battle makes at creation, in one pass
 * and a fixed order: each enemy's starting step (E6), then a spawn tile for
 * each unplaced enemy in spawn order, then the shuffle. The count depends only
 * on the encounter. A starting step is one draw for every enemy, a Fast one
 * included (it draws among the one step it may start on), so opening grace
 * and Fast move no spawn tile and no card of the shuffle. It then deals the round 1 hand and opens in `deploy`, so
 * the player places its units seeing the hand and the enemies; `start`
 * (`deploy.ts`) runs the enemies' opening move and telegraph.
 */
import { CARDS, DECKS } from '../../cardData/cards';
import { ENCOUNTERS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import { openingSteps } from './enemies';
import type { BattleEvent } from './events';
import type { Ctx } from './keywords';
import { nextHand } from './resolve';
import { shuffled, withStream } from './random';
import type { BattleState, CardInstance } from './state';
import { allTiles, samePos, zoneOf } from './zones';

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
      pos: pos ? { ...pos } : null,
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
    // E6 and A1: each enemy's starting step, in spawn order, among the steps it may open on.
    for (const enemy of s.enemies) {
      const steps = openingSteps(ENEMIES[enemy.def]);
      enemy.step = steps[stream.nextInt(steps.length)]!;
    }
    // Spawns: each unplaced enemy, in spawn order, on a free tile of the spawn zone.
    for (const enemy of s.enemies) {
      if (enemy.pos) continue;
      const free = allTiles().filter((t) => zoneOf(t) === RULES.spawnZone && !s.enemies.some((e) => samePos(e.pos, t)));
      enemy.pos = { ...free[stream.nextInt(free.length)]! };
    }
    s.piles.draw = shuffled(stream, s.piles.draw);
  });
  // The round 1 hand. The enemies move and telegraph once the player starts.
  nextHand(ctx);
  s.phase = 'deploy';
  return { ok: true, state: s, events: ctx.events };
}
