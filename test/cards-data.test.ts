/**
 * The card engine's data tables against the design snapshot, Appendix A of
 * `docs/spec/gymrun-card-battle-engine-prompt.md`, and the author's card
 * sheet. **Card battle engine, checkpoint 1.**
 */
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS } from '../src/cardData/cards';
import { CLASS_SLOTS } from '../src/cardData/classes';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { UNITS } from '../src/cardData/units';
import { layoutBattle } from '../src/core/cards/create';
import { RESERVED_EFFECTS } from '../src/core/cards/defs';

describe('card data', () => {
  it('ships no card that uses a reserved effect', () => {
    for (const card of Object.values(CARDS)) {
      for (const effect of card.effects) {
        expect((RESERVED_EFFECTS as readonly string[]).includes(effect.k), `${card.id} uses ${effect.k}`).toBe(false);
      }
    }
  });

  it('matches the snapshot card table: owner, cost and Once', () => {
    const table: [string, string, number, boolean][] = [
      ['call-medic', 'A', 1, false],
      ['command', 'A', 1, false],
      ['focus', 'A', 1, false],
      ['moon-strike', 'A', 4, false],
      ['shoot', 'B', 0, false],
      ['resupply', 'B', 1, false],
      ['artillery', 'B', 4, false],
      ['fire', 'B', 1, false],
      ['dash', 'C', 1, false],
      ['slash', 'C', 1, false],
      ['need-help', 'C', 1, false],
      ['prep', 'C', 1, true],
      ['move', 'neutral', 0, false],
      ['dig-in', 'neutral', 0, true],
      ['attack', 'neutral', 1, false],
    ];
    expect(Object.keys(CARDS).sort()).toEqual(table.map(([id]) => id).sort());
    for (const [id, owner, cost, once] of table) {
      expect([CARDS[id]!.owner, CARDS[id]!.cost, CARDS[id]!.once === true], id).toEqual([owner, cost, once]);
    }
  });

  it('builds the Puppeteer deck from one copy of every card', () => {
    expect([...DECKS['puppeteer']!.cards].sort()).toEqual(Object.keys(CARDS).sort());
  });

  it('matches the snapshot units and classes', () => {
    expect(CLASS_SLOTS).toEqual({ special: 1, ranged: 2, melee: 3 });
    expect([UNITS.A.class, UNITS.A.hp, UNITS.A.baseShield]).toEqual(['special', 1, 1]);
    expect([UNITS.B.class, UNITS.B.hp, UNITS.B.baseShield]).toEqual(['ranged', 2, 1]);
    expect([UNITS.C.class, UNITS.C.hp, UNITS.C.baseShield]).toEqual(['melee', 3, 2]);
  });

  it('matches the snapshot enemies', () => {
    expect([ENEMIES.drone.hp, ENEMIES.drone.baseShield, ENEMIES.drone.script.steps.length]).toEqual([3, 1, 6]);
    expect([ENEMIES.lancer.hp, ENEMIES.lancer.baseShield, ENEMIES.lancer.script.steps.length]).toEqual([2, 0, 3]);
  });

  it('places the first encounter as the snapshot does', () => {
    const state = layoutBattle('test', 'S')!;
    expect(state.units.map((u) => [u.id, u.pos])).toEqual([
      ['A', { lane: 1, col: 2 }],
      ['B', { lane: 2, col: 2 }],
      ['C', { lane: 3, col: 2 }],
    ]);
    expect(state.enemies.map((e) => [e.def, e.pos])).toEqual([
      ['drone', { lane: 1, col: 5 }],
      ['lancer', { lane: 2, col: 5 }],
      ['drone', { lane: 3, col: 5 }],
    ]);
    expect(ENCOUNTERS['test']!.deckId).toBe('puppeteer');
  });

  it('carries the rule defaults it is asked to', () => {
    expect(RULES.mp.cap).toBe(5);
    expect(RULES.handSize).toBe(5);
    expect(RULES.huntTieBreak).toEqual(['nearestLane', 'lowestHp', 'upperLane']);
    expect(RULES.advance).toEqual({ cols: 1, limitCol: 3, ifBlocked: 'wait' });
  });

  it('lays out a battle whose state is plain JSON', () => {
    const state = layoutBattle('test', 'S')!;
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state.piles.draw).toHaveLength(15);
    expect(layoutBattle('nope', 'S')).toBeNull();
    expect(layoutBattle('__proto__', 'S')).toBeNull();
  });
});
